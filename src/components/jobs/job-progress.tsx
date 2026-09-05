"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ui/progress";

export interface JobStatus {
  id: string;
  status: "QUEUED" | "PROCESSING" | "VALIDATING" | "COMPLETED" | "FAILED";
  progress: number;
  message: string | null;
  error: string | null;
  result: unknown;
}

export function useJobPolling(jobId: string | null, onComplete?: (job: JobStatus) => void) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Failed to check job status.");
        const data: JobStatus = await res.json();
        if (cancelled) return;
        setJob(data);
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          onCompleteRef.current?.(data);
          return;
        }
        timer = setTimeout(poll, 1200);
      } catch {
        if (!cancelled) timer = setTimeout(poll, 2000);
      }
    }
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  return job;
}

export function JobProgressCard({ job }: { job: JobStatus | null }) {
  const [resuming, setResuming] = useState(false);

  if (!job) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Starting...</p>
      </div>
    );
  }

  const isStalled = job.status !== "COMPLETED" && job.status !== "FAILED" && job.message?.startsWith("Paused");

  async function resume() {
    setResuming(true);
    try {
      await fetch(`/api/jobs/${job!.id}/resume`, { method: "POST" });
    } finally {
      setResuming(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">{job.message ?? job.status}</p>
        <span className="text-xs text-slate-500">{job.progress}%</span>
      </div>
      <ProgressBar value={job.progress} />
      {job.status === "FAILED" && <p className="mt-2 text-sm text-red-600">{job.error}</p>}
      {isStalled && (
        <button
          type="button"
          onClick={resume}
          disabled={resuming}
          className="mt-2 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {resuming ? "Resuming…" : "Resume generation"}
        </button>
      )}
    </div>
  );
}
