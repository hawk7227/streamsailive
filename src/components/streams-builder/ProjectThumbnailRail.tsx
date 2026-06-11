"use client";

import type { StreamsBuilderProjectView } from "@/lib/streams-builder/projects";

export default function ProjectThumbnailRail({ projects, activeProjectId, onSelect }: { projects: StreamsBuilderProjectView[]; activeProjectId: string | null; onSelect: (projectId: string) => void }) {
  if (!projects.length) {
    return (
      <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-4">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Project thumbnails</h2>
        <p className="mt-3 text-sm text-slate-500">No real Streams Builder projects found yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Project thumbnails</h2>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">{projects.length}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {projects.map((project) => (
          <button
            key={project.projectId}
            type="button"
            onClick={() => onSelect(project.projectId)}
            className={`min-w-64 rounded-2xl border p-3 text-left transition ${activeProjectId === project.projectId ? "border-sky-400 bg-sky-400/10" : "border-slate-700 bg-slate-900 hover:border-slate-500"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-white">{project.name}</p>
                <p className="mt-1 text-xs text-slate-500">{project.latestJobState || "job unknown"}</p>
              </div>
              {project.unreadNotificationCount > 0 ? (
                <span className="rounded-full bg-red-500 px-2 py-1 text-xs font-black text-white">{project.unreadNotificationCount}</span>
              ) : null}
            </div>
            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3">
              <p className="line-clamp-2 text-xs text-slate-400">
                {project.activePreviewUrl || "Preview thumbnail pending proof artifact."}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-200">{project.proofState}</span>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-200">{project.approvalState}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
