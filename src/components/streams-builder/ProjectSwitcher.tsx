"use client";

import type { StreamsBuilderProjectView } from "@/lib/streams-builder/projects";

export default function ProjectSwitcher({ projects, activeProjectId, onSelect }: { projects: StreamsBuilderProjectView[]; activeProjectId: string | null; onSelect: (projectId: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      Active project
      <select
        value={activeProjectId || ""}
        onChange={(event) => event.target.value && onSelect(event.target.value)}
        className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-sky-400"
      >
        <option value="">{projects.length ? "Select project" : "No real projects found"}</option>
        {projects.map((project) => (
          <option key={project.projectId} value={project.projectId}>
            {project.name} — {project.approvalState}
          </option>
        ))}
      </select>
    </label>
  );
}
