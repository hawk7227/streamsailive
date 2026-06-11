"use client";

import { useMemo, useState } from "react";
import type { StreamsBuilderApprovalState, StreamsBuilderProjectView } from "@/lib/streams-builder/projects";

type Filter = "all" | StreamsBuilderApprovalState;

const groups: Array<{ key: StreamsBuilderApprovalState; label: string }> = [
  { key: "ready", label: "Ready for Review" },
  { key: "blocked", label: "Blocked" },
  { key: "changes_requested", label: "Changes Requested" },
  { key: "approved", label: "Approved" },
  { key: "unproven", label: "Unproven" },
];

export default function ApprovalCenterPanel({ projects, onSelectProject }: { projects: StreamsBuilderProjectView[]; onSelectProject: (projectId: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visibleGroups = useMemo(() => groups.map((group) => ({
    ...group,
    projects: projects.filter((project) => project.approvalState === group.key && (filter === "all" || filter === group.key)),
  })), [projects, filter]);

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Approval Center</p>
          <h2 className="mt-1 text-2xl font-black text-white">Review real project states</h2>
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-sky-400">
          <option value="all">All</option>
          {groups.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}
        </select>
      </div>
      <div className="grid gap-4">
        {visibleGroups.map((group) => (
          <section key={group.key} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-black text-white">{group.label}</h3>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">{group.projects.length}</span>
            </div>
            {group.projects.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {group.projects.map((project) => (
                  <button key={project.projectId} type="button" onClick={() => onSelectProject(project.projectId)} className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-left hover:border-sky-400">
                    <p className="text-sm font-black text-white">{project.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{project.activeRoute || "Route UNPROVEN"}</p>
                    <p className="mt-2 text-xs font-bold text-amber-200">Proof: {project.proofState}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No real items found.</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
