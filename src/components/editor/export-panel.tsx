"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { ValidationReport } from "@/lib/validation/types";

type ExportKind = "INTERIOR_PDF" | "COVER_PDF" | "FULL_PACKAGE";

function filenameFromResponse(res: Response, fallback: string): string {
  const match = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

/** Downloads a PDF straight from the response into the browser — the file only ever exists in memory here, never on the server. */
async function downloadPdf(endpoint: string, projectId: string, fallbackName: string) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Export failed.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFromResponse(res, fallbackName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportPanel({ projectId, hasCover }: { projectId: string; hasCover: boolean }) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<ExportKind | null>(null);

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

  async function startExport(kind: ExportKind) {
    setError(null);
    setDownloaded(null);
    setExporting(kind);
    try {
      if (kind === "INTERIOR_PDF" || kind === "FULL_PACKAGE") {
        await downloadPdf("/api/export/pdf", projectId, "interior.pdf");
      }
      if (kind === "COVER_PDF" || kind === "FULL_PACKAGE") {
        await downloadPdf("/api/export/cover", projectId, "cover.pdf");
      }
      setDownloaded(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <Link href={`/projects/${projectId}`} className="inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Back to editor
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Export</h1>
      <p className="text-sm text-slate-500">
        Files are generated on demand and download straight to your device — nothing is stored on our servers.
      </p>

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
          <CardTitle>Download</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {downloaded && !exporting && <p className="text-sm text-emerald-700">Download started.</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => startExport("INTERIOR_PDF")} disabled={exporting !== null}>
              {exporting === "INTERIOR_PDF" ? "Preparing..." : "Download Interior PDF"}
            </Button>
            <Button onClick={() => startExport("COVER_PDF")} disabled={!hasCover || exporting !== null} variant="secondary">
              {exporting === "COVER_PDF" ? "Preparing..." : "Download Cover PDF"}
            </Button>
            <Button onClick={() => startExport("FULL_PACKAGE")} disabled={!hasCover || exporting !== null} variant="secondary">
              {exporting === "FULL_PACKAGE" ? "Preparing..." : "Download Both"}
            </Button>
          </div>
          {!hasCover && <p className="text-xs text-slate-500">Generate a cover first to unlock cover / both-file downloads.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
