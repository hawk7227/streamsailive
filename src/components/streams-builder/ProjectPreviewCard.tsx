"use client";

import type { StreamsBuilderProjectView } from "@/lib/streams-builder/projects";

function badgeClass(value: string | null | undefined) {
  if (value === "approved" || value === "PROVEN" || value === "completed") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  if (value === "blocked" || value === "FAILED" || value === "failed") return "border-red-400/40 bg-red-400/10 text-red-200";
  if (value === "changes_requested" || value === "WAITING_FOR_USER") return "border-sky-400/40 bg-sky-400/10 text-sky-200";
  return "border-amber-400/40 bg-amber-400/10 text-amber-200";
}

export default function ProjectPreviewCard({ project, selected, onSelect }: { project: StreamsBuilderProjectView; selected?: boolean; onSelect: (projectId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(project.projectId)}
      className={`grid w-full gap-4 rounded-3xl border p-4 text-left transition ${selected ? "border-sky-400 bg-sky-400/10" : "border-slate-700 bg-slate-950/70 hover:border-slate-500"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-white">{project.name}</h3>
          <p className="mt-1 text-xs text-slate-400">{project.projectId}</p>
        </div>
        {project.unreadNotificationCount > 0 ? (
          <span className="rounded-full bg-red-500 px-2 py-1 text-xs font-black text-white">{project.unreadNotificationCount}</span>
        ) : null}
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
        {project.activePreviewUrl ? (
          <div className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Live preview</span>
            <span className="break-all text-xs text-slate-300">{project.activePreviewUrl}</span>
          </div>
        ) : (
          <div className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Preview URL missing</span>
            <span className="text-xs text-slate-400">Preview thumbnail pending proof artifact.</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(project.proofState)}`}>{project.proofState}</span>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(project.approvalState)}`}>{project.approvalState}</span>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(project.latestJobState)}`}>{project.latestJobState || "job unknown"}</span>
      </div>
      <div className="grid gap-1 text-xs text-slate-400">
        <span>Repo: {project.repo || "UNPROVEN"}</span>
        <span>Route: {project.activeRoute || "UNPROVEN"}</span>
        <span>Component: {project.component || "UNPROVEN"}</span>
      </div>
    </button>
  );
}
