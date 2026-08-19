"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOK_TYPES, BOOK_TYPE_IDS, type BookTypeId } from "@/lib/generation/book-types";
import { KDP_TRIM_SIZES } from "@/lib/pdf/dimensions";
import type { BookTemplate } from "@/lib/generation/templates";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { useJobPolling, JobProgressCard, type JobStatus } from "@/components/jobs/job-progress";
import { cn } from "@/lib/utils/cn";

type Difficulty = "EASY" | "MEDIUM" | "HARD";

interface WizardState {
  bookType: BookTypeId;
  title: string;
  topic: string;
  audience: string;
  description: string;
  difficulty: Difficulty;
  pageCount: number;
  trimSizeId: string;
  bleed: boolean;
  interiorColor: "BW" | "COLOR";
  paperType: "WHITE" | "CREAM";
  coverFinish: "MATTE" | "GLOSSY";
}

const STEPS = ["Book Type", "Topic", "Audience", "Pages & Difficulty", "Size & Print", "Generate"] as const;

function initialState(template?: BookTemplate): WizardState {
  return {
    bookType: template?.bookType ?? "word_search",
    title: template ? `${template.topic} ${BOOK_TYPES[template.bookType].label}` : "",
    topic: template?.topic ?? "",
    audience: template?.audience ?? "",
    description: "",
    difficulty: template?.difficulty ?? "MEDIUM",
    pageCount: template?.pageCount ?? 40,
    trimSizeId: KDP_TRIM_SIZES.find((t) => t.widthIn === (template?.trimWidthIn ?? 8.5) && t.heightIn === (template?.trimHeightIn ?? 11))?.id ?? "8.5x11",
    bleed: false,
    interiorColor: "BW",
    paperType: "WHITE",
    coverFinish: "MATTE",
  };
}

export function BookWizard({ template }: { template?: BookTemplate }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(() => initialState(template));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const trimSize = useMemo(() => KDP_TRIM_SIZES.find((t) => t.id === state.trimSizeId) ?? KDP_TRIM_SIZES[0], [state.trimSizeId]);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function canAdvance(): boolean {
    if (step === 0) return Boolean(state.bookType);
    if (step === 1) return state.topic.trim().length > 0 && state.title.trim().length > 0;
    if (step === 2) return state.audience.trim().length > 0;
    if (step === 3) return state.pageCount > 0;
    return true;
  }

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    try {
      const projectRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: state.title, bookType: state.bookType }),
      });
      const projectData = await projectRes.json();
      if (!projectRes.ok) throw new Error(projectData.error ?? "Could not create project.");
      setProjectId(projectData.project.id);

      const bookRes = await fetch("/api/books/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectData.project.id,
          title: state.title,
          topic: state.topic,
          audience: state.audience,
          bookType: state.bookType,
          pageCount: Number(state.pageCount),
          difficulty: state.difficulty,
          trimWidthIn: trimSize.widthIn,
          trimHeightIn: trimSize.heightIn,
          bleed: state.bleed,
          interiorColor: state.interiorColor,
          paperType: state.paperType,
          coverFinish: state.coverFinish,
          description: state.description || undefined,
        }),
      });
      const bookData = await bookRes.json();
      if (!bookRes.ok) throw new Error(bookData.error ?? "Could not start generation.");
      setJobId(bookData.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  function handleJobComplete(job: JobStatus) {
    if (job.status === "COMPLETED" && projectId) {
      router.push(`/projects/${projectId}`);
    } else {
      setSubmitting(false);
    }
  }

  const polledJob = useJobPolling(jobId, handleJobComplete);

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-8 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              i === step ? "bg-indigo-600 text-white" : i < step ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <Card>
        <CardBody className="space-y-5">
          {step === 0 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-slate-900">What type of book?</h2>
              <p className="mb-4 text-sm text-slate-500">Choose the kind of KDP book you want to build.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BOOK_TYPE_IDS.map((id) => {
                  const cfg = BOOK_TYPES[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update("bookType", id)}
                      className={cn(
                        "rounded-lg border p-3 text-left text-sm transition-colors",
                        state.bookType === id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <p className="font-medium">{cfg.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{cfg.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">What is the topic?</h2>
              <div>
                <Label htmlFor="title">Book title</Label>
                <Input id="title" value={state.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Sports Word Search" />
              </div>
              <div>
                <Label htmlFor="topic">Topic</Label>
                <Input id="topic" value={state.topic} onChange={(e) => update("topic", e.target.value)} placeholder="e.g. Sports" />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" rows={3} value={state.description} onChange={(e) => update("description", e.target.value)} placeholder="Anything else the AI should know about this book" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Who is it for?</h2>
              <div>
                <Label htmlFor="audience">Audience</Label>
                <Input id="audience" value={state.audience} onChange={(e) => update("audience", e.target.value)} placeholder="e.g. Adults, Kids ages 6-10, Seniors" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">How many pages?</h2>
              <div>
                <Label htmlFor="pageCount">Page count</Label>
                <Input id="pageCount" type="number" min={1} max={300} value={state.pageCount} onChange={(e) => update("pageCount", Number(e.target.value))} />
                <p className="mt-1 text-xs text-slate-500">This is the number of puzzle/content pages. Title and answer-key pages are added automatically.</p>
              </div>
              <div>
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select id="difficulty" value={state.difficulty} onChange={(e) => update("difficulty", e.target.value as Difficulty)}>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </Select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Choose size</h2>
              <div>
                <Label htmlFor="trim">Trim size</Label>
                <Select id="trim" value={state.trimSizeId} onChange={(e) => update("trimSizeId", e.target.value)}>
                  {KDP_TRIM_SIZES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interiorColor">Interior color</Label>
                  <Select id="interiorColor" value={state.interiorColor} onChange={(e) => update("interiorColor", e.target.value as "BW" | "COLOR")}>
                    <option value="BW">Black & white</option>
                    <option value="COLOR">Color</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paperType">Paper type</Label>
                  <Select id="paperType" value={state.paperType} onChange={(e) => update("paperType", e.target.value as "WHITE" | "CREAM")}>
                    <option value="WHITE">White</option>
                    <option value="CREAM">Cream</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="coverFinish">Cover finish</Label>
                  <Select id="coverFinish" value={state.coverFinish} onChange={(e) => update("coverFinish", e.target.value as "MATTE" | "GLOSSY")}>
                    <option value="MATTE">Matte</option>
                    <option value="GLOSSY">Glossy</option>
                  </Select>
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <input id="bleed" type="checkbox" checked={state.bleed} onChange={(e) => update("bleed", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  <Label htmlFor="bleed" className="mb-0">
                    Enable bleed
                  </Label>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Review & Generate</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-500">Book type</dt>
                <dd className="text-slate-900">{BOOK_TYPES[state.bookType].label}</dd>
                <dt className="text-slate-500">Title</dt>
                <dd className="text-slate-900">{state.title}</dd>
                <dt className="text-slate-500">Topic</dt>
                <dd className="text-slate-900">{state.topic}</dd>
                <dt className="text-slate-500">Audience</dt>
                <dd className="text-slate-900">{state.audience}</dd>
                <dt className="text-slate-500">Pages</dt>
                <dd className="text-slate-900">{state.pageCount}</dd>
                <dt className="text-slate-500">Difficulty</dt>
                <dd className="text-slate-900">{state.difficulty}</dd>
                <dt className="text-slate-500">Trim size</dt>
                <dd className="text-slate-900">{trimSize.label}</dd>
              </dl>
              <FieldError>{error}</FieldError>
              {jobId ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Generating content... building puzzles... validating pages... creating answer keys...
                  </p>
                  <JobProgressCard job={polledJob} />
                </div>
              ) : (
                <Button onClick={handleGenerate} disabled={submitting} className="w-full" size="lg">
                  {submitting ? "Starting..." : "Generate Book"}
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {step < 5 && (
        <div className="mt-4 flex justify-between">
          <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canAdvance()}>
            Next
          </Button>
        </div>
      )}
      {step === 5 && !jobId && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
