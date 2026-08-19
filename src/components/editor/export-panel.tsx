"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useJobPolling, JobProgressCard } from "@/components/jobs/job-progress";
import type { ValidationReport } from "@/lib/validation/types";

export interface ExportRecord {
  id: string;
  type: string;
  fileSizeBytes: number;
  createdAt: string;
  downloadUrl: string;
}

export function ExportPanel({ projectId, hasCover, initialExports }: { projectId: string; hasCover: boolean; initialExports: ExportRecord[] }) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [exports, setExports] = useState(initialExports);
  const [error, setError] = useState<string | null>(null);
  const [resultUrls, setResultUrls] = useState<Record<string, string> | null>(null);

  async function runValidation() {
    setValidating(true);
    setError(null);
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json();
    setValidating(false);
    if (!res.ok) {
      setError(data.error ?? "Validation failed.");
      return;
    }
    setReport(data.report);
  }

  const job = useJobPolling(jobId, async (finished) => {
    setJobId(null);
    if (finished.status === "COMPLETED") {
      const result = finished.result as { validation: ValidationReport; urls: Record<string, string> } | null;
      if (result?.validation) setReport(result.validation);
      if (result?.urls) setResultUrls(result.urls);
      const res = await fetch(`/api/projects/${projectId}/exports`);
      if (res.ok) setExports((await res.json()).exports);
    } else {
      setError(finished.error ?? "Export failed.");
    }
  });

  async function startExport(type: "INTERIOR_PDF" | "FULL_PACKAGE" | "COVER_PDF") {
    setError(null);
    setResultUrls(null);
    const endpoint = type === "COVER_PDF" ? "/api/export/cover" : "/api/export/pdf";
    const body = type === "COVER_PDF" ? { projectId } : { projectId, type };
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not start export.");
      return;
    }
    setJobId(data.jobId);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <Link href={`/projects/${projectId}`} className="inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Back to editor
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Export</h1>

      <Card>
        <CardHeader>
          <CardTitle>Validation report</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Button variant="secondary" size="sm" onClick={runValidation} disabled={validating}>
            {validating ? "Validating..." : "Run validation"}
          </Button>
          {report && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                {report.passedChecks.map((c, i) => (
                  <p key={i} className="text-emerald-700">
                    ✓ {c}
                  </p>
                ))}
              </div>
              {report.warnings.length > 0 && (
                <div className="space-y-1 rounded-lg bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-700">Warnings</p>
                  {report.warnings.map((w, i) => (
                    <p key={i} className="text-amber-700">
                      ⚠ {w.message}
                    </p>
                  ))}
                </div>
              )}
              {report.errors.length > 0 && (
                <div className="space-y-1 rounded-lg bg-red-50 p-3">
                  <p className="text-xs font-semibold uppercase text-red-700">Errors</p>
                  {report.errors.map((e, i) => (
                    <p key={i} className="text-red-700">
                      ✗ {e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-slate-500">
            This checks structure, puzzle correctness, and dimensions automatically. It is not a substitute for verifying your
            file against Amazon KDP&apos;s current print requirements before publishing.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export files</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {jobId ? (
            <JobProgressCard job={job} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => startExport("INTERIOR_PDF")}>Export Interior PDF</Button>
              <Button onClick={() => startExport("COVER_PDF")} disabled={!hasCover} variant="secondary">
                Export Cover PDF
              </Button>
              <Button onClick={() => startExport("FULL_PACKAGE")} disabled={!hasCover} variant="secondary">
                Export Full Package
              </Button>
            </div>
          )}
          {!hasCover && <p className="text-xs text-slate-500">Generate a cover first to unlock cover / full-package exports.</p>}
          {resultUrls && (
            <div className="flex flex-wrap gap-3 rounded-lg bg-emerald-50 p-3 text-sm">
              {resultUrls.interior && (
                <a href={resultUrls.interior} className="font-medium text-emerald-700 underline" download>
                  Download interior PDF
                </a>
              )}
              {resultUrls.cover && (
                <a href={resultUrls.cover} className="font-medium text-emerald-700 underline" download>
                  Download cover PDF
                </a>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export history</CardTitle>
        </CardHeader>
        <CardBody>
          {exports.length === 0 ? (
            <p className="text-sm text-slate-500">No exports yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {exports.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <div>
                    <Badge tone="indigo">{e.type.replace("_", " ")}</Badge>
                    <span className="ml-2 text-xs text-slate-500">{(e.fileSizeBytes / 1024).toFixed(0)} KB</span>
                  </div>
                  <a href={e.downloadUrl} className="text-indigo-600 hover:text-indigo-500" download>
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
