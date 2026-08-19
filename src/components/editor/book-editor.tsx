"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PagePreview } from "./page-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJobPolling, JobProgressCard } from "@/components/jobs/job-progress";
import { cn } from "@/lib/utils/cn";

export interface EditorPage {
  id: string;
  index: number;
  type: string;
  title: string | null;
  status: string;
  content: unknown;
}

const REGENERATABLE_TYPES = new Set(["word_search", "crossword", "sudoku", "number_puzzle", "maze", "coloring", "journal"]);

export function BookEditor({ projectId, projectName, pages: initialPages }: { projectId: string; projectName: string; pages: EditorPage[] }) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [selectedId, setSelectedId] = useState<string | null>(initialPages[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [regenJobId, setRegenJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => pages.find((p) => p.id === selectedId) ?? null, [pages, selectedId]);

  async function refresh() {
    router.refresh();
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) {
      const data = await res.json();
      const nextPages: EditorPage[] = data.pages.map((p: { id: string; index: number; type: string; title: string | null; status: string; content: string }) => ({
        ...p,
        content: JSON.parse(p.content),
      }));
      setPages(nextPages);
      if (!nextPages.some((p: EditorPage) => p.id === selectedId)) {
        setSelectedId(nextPages[0]?.id ?? null);
      }
    }
  }

  async function handleRegenerate() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pages/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: selected.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not regenerate this page.");
      setBusy(false);
      return;
    }
    setRegenJobId(data.jobId);
  }

  async function handleDelete() {
    if (!selected || pages.length <= 1) return;
    if (!confirm("Delete this page?")) return;
    setBusy(true);
    const res = await fetch(`/api/pages/${selected.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) await refresh();
    else setError((await res.json()).error ?? "Could not delete page.");
  }

  async function handleDuplicate() {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/pages/${selected.id}/duplicate`, { method: "POST" });
    setBusy(false);
    if (res.ok) await refresh();
    else setError((await res.json()).error ?? "Could not duplicate page.");
  }

  async function handleAddPage() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/pages`, { method: "POST" });
    setBusy(false);
    if (res.ok) await refresh();
    else setError((await res.json()).error ?? "Could not add a page.");
  }

  const job = useJobPolling(regenJobId, (finished) => {
    setBusy(false);
    setRegenJobId(null);
    if (finished.status === "COMPLETED") refresh();
    else setError(finished.error ?? "Regeneration failed.");
  });

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            ← Dashboard
          </Link>
          <span className="text-sm font-semibold text-slate-900">{projectName}</span>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${projectId}/cover`}>
            <Button variant="secondary" size="sm">Cover</Button>
          </Link>
          <Link href={`/projects/${projectId}/metadata`}>
            <Button variant="secondary" size="sm">Metadata</Button>
          </Link>
          <Link href={`/projects/${projectId}/export`}>
            <Button size="sm">Export</Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
          <div className="space-y-1 p-2">
            {pages.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs",
                  selectedId === p.id ? "bg-indigo-50 ring-1 ring-indigo-300" : "hover:bg-slate-50"
                )}
              >
                <div className="h-10 w-8 shrink-0 overflow-hidden rounded border border-slate-200 bg-white">
                  <div className="pointer-events-none h-[266px] w-[212px] origin-top-left scale-[0.15]">
                    <PagePreview type={p.type} content={p.content} />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{p.title || `Page ${p.index + 1}`}</p>
                  <p className="text-[10px] text-slate-400">{p.type.replace("_", " ")}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 p-2">
            <Button variant="secondary" size="sm" className="w-full" onClick={handleAddPage} disabled={busy}>
              + Add page
            </Button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {selected ? (
            <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center p-6">
              <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
                <PagePreview type={selected.type} content={selected.content} />
              </div>
            </div>
          ) : (
            <p className="p-6 text-sm text-slate-400">No pages yet.</p>
          )}
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Page settings</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{selected.title || `Page ${selected.index + 1}`}</h3>
                <div className="mt-2 flex gap-2">
                  <Badge tone="indigo">{selected.type.replace("_", " ")}</Badge>
                  <Badge tone={selected.status === "GENERATED" ? "green" : "gray"}>{selected.status}</Badge>
                </div>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              {regenJobId ? (
                <JobProgressCard job={job} />
              ) : (
                <div className="space-y-2">
                  {REGENERATABLE_TYPES.has(selected.type) && (
                    <Button size="sm" className="w-full" onClick={handleRegenerate} disabled={busy}>
                      Regenerate page
                    </Button>
                  )}
                  {selected.type !== "title" && (
                    <>
                      <Button variant="secondary" size="sm" className="w-full" onClick={handleDuplicate} disabled={busy}>
                        Duplicate page
                      </Button>
                      <Button variant="danger" size="sm" className="w-full" onClick={handleDelete} disabled={busy || pages.length <= 1}>
                        Delete page
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">
                <p>Regenerating a page keeps the rest of the book untouched, and answer keys refresh automatically.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Select a page to see its settings.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
