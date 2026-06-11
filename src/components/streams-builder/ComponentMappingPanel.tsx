"use client";

import type { StreamsBuilderComponentMapRow } from "@/lib/streams-builder/component-map";

export default function ComponentMappingPanel({
  mappings,
  onSelectProject,
}: {
  mappings: StreamsBuilderComponentMapRow[];
  onSelectProject: (projectId: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-5">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Component Mapping</p>
        <h2 className="mt-1 text-xl font-black text-white">Route → component → file</h2>
      </div>
      {mappings.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="border-b border-slate-700 py-3 pr-3">Route</th>
                <th className="border-b border-slate-700 py-3 pr-3">Component</th>
                <th className="border-b border-slate-700 py-3 pr-3">File</th>
                <th className="border-b border-slate-700 py-3 pr-3">Truth</th>
                <th className="border-b border-slate-700 py-3 pr-3">Missing</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="cursor-pointer hover:bg-slate-900" onClick={() => onSelectProject(mapping.projectId)}>
                  <td className="border-b border-slate-800 py-3 pr-3 text-slate-100">{mapping.route || "UNPROVEN"}</td>
                  <td className="border-b border-slate-800 py-3 pr-3 text-slate-200">{mapping.component || "UNPROVEN"}</td>
                  <td className="border-b border-slate-800 py-3 pr-3 text-slate-300">{mapping.githubPath || mapping.file || "UNPROVEN"}</td>
                  <td className="border-b border-slate-800 py-3 pr-3 font-bold text-amber-200">{mapping.truthState}</td>
                  <td className="border-b border-slate-800 py-3 pr-3 text-slate-400">{mapping.missing.length ? mapping.missing.join(", ") : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-400">No real component mappings found yet.</p>
      )}
    </section>
  );
}
