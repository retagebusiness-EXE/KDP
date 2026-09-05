import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { runGenerationJob } from "./pipeline";

export type JobRunner = () => Promise<void>;

/**
 * Queue seam. `InProcessJobQueue` runs jobs on the same Node process via
 * Next's `after()`, which is enough for a single-instance deployment and
 * keeps the browser from blocking on a long generation request (the caller
 * gets a job id back immediately and polls `GET /api/jobs/:id`).
 *
 * `after()` (not `queueMicrotask`) matters on Vercel: a serverless function
 * is frozen once the response is sent, killing any unawaited work still in
 * flight — `after()` is the platform's hook to keep the invocation alive
 * until the callback settles.
 *
 * To move to a real queue (BullMQ + Redis), implement this same `JobQueue`
 * interface backed by `Queue.add(...)`, and run `runBookGenerationJob` /
 * the other job runners inside a BullMQ `Worker` instead of inline here —
 * no other code in the app needs to change.
 */
export interface JobQueue {
  enqueue(run: JobRunner): void;
}

export class InProcessJobQueue implements JobQueue {
  enqueue(run: JobRunner): void {
    after(() =>
      run().catch((err) => {
        console.error("[job] unhandled job error", err);
      }),
    );
  }
}

let queue: JobQueue = new InProcessJobQueue();

export function getJobQueue(): JobQueue {
  return queue;
}

/** Test-only seam to swap in a synchronous/deterministic queue. */
export function setJobQueue(next: JobQueue): void {
  queue = next;
}

/** Creates a GenerationJob row and hands it to the queue. Returns the job id immediately for polling. */
export async function enqueueGenerationJob(projectId: string, type: string, input: unknown): Promise<string> {
  const job = await prisma.generationJob.create({
    data: { projectId, type, status: "QUEUED", input: JSON.stringify(input ?? {}) },
  });
  getJobQueue().enqueue(() => runGenerationJob(job.id));
  return job.id;
}
