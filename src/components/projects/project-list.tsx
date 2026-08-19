"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface ProjectRow {
  id: string;
  name: string;
  bookType: string;
  status: string;
  updatedAt: string;
  bookTitle: string | null;
}

const STATUS_TONE: Record<string, "gray" | "green" | "amber" | "red" | "indigo"> = {
  DRAFT: "gray",
  GENERATING: "amber",
  READY: "green",
  ARCHIVED: "gray",
};

export function ProjectList({ initial }: { initial: ProjectRow[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRename(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue }),
    });
    setBusyId(null);
    setRenamingId(null);
    if (res.ok) {
      setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name: renameValue } : p)));
    }
  }

  async function handleDuplicate(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    setBusyId(null);
    if (res.ok) router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setBusyId(id);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) setProjects((ps) => ps.filter((p) => p.id !== id));
  }

  if (projects.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No projects yet. <Link href="/projects/new" className="font-medium text-indigo-600">Create your first book</Link>.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {projects.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            {renamingId === p.id ? (
              <div className="flex max-w-xs gap-2">
                <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                <Button size="sm" onClick={() => handleRename(p.id)} disabled={busyId === p.id}>
                  Save
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setRenamingId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Link href={`/projects/${p.id}`} className="truncate text-sm font-medium text-slate-900 hover:text-indigo-600">
                  {p.bookTitle || p.name}
                </Link>
                <p className="text-xs text-slate-500">{p.bookType.replace("_", " ")}</p>
              </>
            )}
          </div>
          <Badge tone={STATUS_TONE[p.status] ?? "gray"}>{p.status}</Badge>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRenamingId(p.id);
                setRenameValue(p.name);
              }}
            >
              Rename
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleDuplicate(p.id)} disabled={busyId === p.id}>
              Duplicate
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(p.id)} disabled={busyId === p.id}>
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
