"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { useJobPolling, JobProgressCard } from "@/components/jobs/job-progress";

export interface CoverData {
  title: string;
  subtitle: string | null;
  author: string;
  spineWidthIn: number;
  fullWidthIn: number;
  fullHeightIn: number;
  colors: string[];
}

export function CoverEditor({ projectId, initialCover }: { projectId: string; initialCover: CoverData | null }) {
  const [title, setTitle] = useState(initialCover?.title ?? "");
  const [subtitle, setSubtitle] = useState(initialCover?.subtitle ?? "");
  const [author, setAuthor] = useState(initialCover?.author ?? "");
  const [colorA, setColorA] = useState(initialCover?.colors[0] ?? "#1E3A8A");
  const [colorB, setColorB] = useState(initialCover?.colors[1] ?? "#F59E0B");
  const [cover, setCover] = useState<CoverData | null>(initialCover);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const job = useJobPolling(jobId, async (finished) => {
    setSubmitting(false);
    setJobId(null);
    if (finished.status === "COMPLETED") {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.project.book?.cover) {
          const c = data.project.book.cover;
          setCover({ title: c.title, subtitle: c.subtitle, author: c.author, spineWidthIn: c.spineWidthIn, fullWidthIn: c.fullWidthIn, fullHeightIn: c.fullHeightIn, colors: JSON.parse(c.colors) });
        }
      }
    } else {
      setError(finished.error ?? "Cover generation failed.");
    }
  });

  async function handleGenerate() {
    if (!author.trim()) {
      setError("Author name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/cover/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title: title || undefined, subtitle: subtitle || undefined, author, colors: [colorA, colorB] }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not start cover generation.");
      setSubmitting(false);
      return;
    }
    setJobId(data.jobId);
  }

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-2">
      <div>
        <Link href={`/projects/${projectId}`} className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Back to editor
        </Link>
        <h1 className="mb-4 text-2xl font-semibold text-slate-900">Cover</h1>
        <Card>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="c-title">Title (optional override)</Label>
              <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Uses the book title if left blank" />
            </div>
            <div>
              <Label htmlFor="c-subtitle">Subtitle</Label>
              <Input id="c-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="c-author">Author name</Label>
              <Input id="c-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your pen name" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-colorA">Primary color</Label>
                <input id="c-colorA" type="color" value={colorA} onChange={(e) => setColorA(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300" />
              </div>
              <div>
                <Label htmlFor="c-colorB">Accent color</Label>
                <input id="c-colorB" type="color" value={colorB} onChange={(e) => setColorB(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300" />
              </div>
            </div>
            <FieldError>{error}</FieldError>
            {jobId ? <JobProgressCard job={job} /> : (
              <Button onClick={handleGenerate} disabled={submitting} className="w-full">
                {cover ? "Regenerate Cover" : "Generate Cover"}
              </Button>
            )}
            <p className="text-xs text-slate-500">
              No ISBN barcode is added automatically — Amazon KDP assigns and places the barcode during their cover review.
            </p>
          </CardBody>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-medium text-slate-500">Preview</h2>
        {cover ? (
          <div className="space-y-3">
            <div
              className="flex overflow-hidden rounded-lg border border-slate-200 shadow-sm"
              style={{ aspectRatio: `${cover.fullWidthIn} / ${cover.fullHeightIn}` }}
            >
              <div className="flex flex-1 items-center justify-center p-3 text-center text-[10px] text-white" style={{ background: colorA }}>
                Back cover
              </div>
              <div style={{ width: `${(cover.spineWidthIn / cover.fullWidthIn) * 100}%`, background: colorB }} />
              <div className="flex flex-[1.2] flex-col items-center justify-center gap-2 p-4 text-center text-white" style={{ background: colorA }}>
                <p className="text-lg font-bold">{cover.title}</p>
                {cover.subtitle && <p className="text-xs opacity-90">{cover.subtitle}</p>}
                <p className="mt-4 text-sm font-medium">{cover.author}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Full cover: {cover.fullWidthIn.toFixed(3)}&quot; x {cover.fullHeightIn.toFixed(3)}&quot; (spine {cover.spineWidthIn.toFixed(3)}&quot;)
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Generate a cover to see the preview.</p>
        )}
      </div>
    </div>
  );
}
