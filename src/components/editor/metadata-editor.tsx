"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { useJobPolling, JobProgressCard } from "@/components/jobs/job-progress";

export interface MetadataData {
  title: string;
  subtitle: string | null;
  description: string | null;
  keywords: string[];
  categories: string[];
  features: string[];
  backCoverText: string | null;
}

export function MetadataEditor({ projectId, initial }: { projectId: string; initial: MetadataData | null }) {
  const [data, setData] = useState<MetadataData | null>(initial);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const job = useJobPolling(jobId, async (finished) => {
    setSubmitting(false);
    setJobId(null);
    if (finished.status === "COMPLETED") {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const resData = await res.json();
        const m = resData.project.book?.metadata;
        if (m) {
          setData({
            title: m.title,
            subtitle: m.subtitle,
            description: m.description,
            keywords: JSON.parse(m.keywords),
            categories: JSON.parse(m.categories),
            features: JSON.parse(m.features),
            backCoverText: m.backCoverText,
          });
        }
      }
    } else {
      setError(finished.error ?? "Metadata generation failed.");
    }
  });

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/metadata/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const resData = await res.json();
    if (!res.ok) {
      setError(resData.error ?? "Could not start metadata generation.");
      setSubmitting(false);
      return;
    }
    setJobId(resData.jobId);
  }

  function update<K extends keyof MetadataData>(key: K, value: MetadataData[K]) {
    setData((d) => (d ? { ...d, [key]: value } : d));
    setSaved(false);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
    } else {
      const resData = await res.json();
      setError(resData.error ?? "Could not save your edits.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href={`/projects/${projectId}`} className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Back to editor
      </Link>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Metadata</h1>
        {jobId ? null : (
          <Button onClick={handleGenerate} disabled={submitting}>
            {data ? "Regenerate" : "Generate Metadata"}
          </Button>
        )}
      </div>

      {jobId && <JobProgressCard job={job} />}
      <FieldError>{error}</FieldError>

      {data && (
        <Card className="mt-4">
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="m-title">Title</Label>
              <Input id="m-title" value={data.title} onChange={(e) => update("title", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-subtitle">Subtitle</Label>
              <Input id="m-subtitle" value={data.subtitle ?? ""} onChange={(e) => update("subtitle", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-description">Description</Label>
              <Textarea id="m-description" rows={5} value={data.description ?? ""} onChange={(e) => update("description", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-keywords">Keywords (up to 7, comma-separated)</Label>
              <Input
                id="m-keywords"
                value={data.keywords.join(", ")}
                onChange={(e) => update("keywords", e.target.value.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 7))}
              />
            </div>
            <div>
              <Label htmlFor="m-categories">BISAC / category suggestions</Label>
              <Textarea id="m-categories" rows={2} value={data.categories.join("\n")} onChange={(e) => update("categories", e.target.value.split("\n").filter(Boolean))} />
            </div>
            <div>
              <Label htmlFor="m-features">Book features (one per line)</Label>
              <Textarea id="m-features" rows={4} value={data.features.join("\n")} onChange={(e) => update("features", e.target.value.split("\n").filter(Boolean))} />
            </div>
            <div>
              <Label htmlFor="m-back">Back-cover description</Label>
              <Textarea id="m-back" rows={3} value={data.backCoverText ?? ""} onChange={(e) => update("backCoverText", e.target.value)} />
            </div>
            <Button onClick={handleSave} disabled={saving} variant="secondary">
              {saving ? "Saving..." : saved ? "Saved" : "Save edits"}
            </Button>
            <p className="text-xs text-slate-500">
              AI-suggested metadata is a starting point — always review it yourself. We can&apos;t guarantee Amazon rankings, sales, or category placement.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
