"use client";

import { useMemo, useState } from "react";
import type { StreamsBuilderComponentMapRow } from "@/lib/streams-builder/component-map";
import type { StreamsBuilderProjectView } from "@/lib/streams-builder/projects";

type PatchAction = "save_patch" | "duplicate_draft";

type VisualEditorPanelProps = {
  project: StreamsBuilderProjectView | null;
  mappings: StreamsBuilderComponentMapRow[];
  onActivity?: () => void;
};

type ActivityResponse = {
  ok: boolean;
  error?: string;
};

const editorInputClass =
  "w-full rounded-xl border border-slate-700 bg-[#030816] px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-violet-400";

const compactInputClass =
  "w-full rounded-xl border border-slate-700 bg-[#030816] px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-violet-400";

function sourceValue(value: string | null | undefined, fallback = "UNPROVEN") {
  return value && value.trim() ? value.trim() : fallback;
}

function buildPatchPreview(params: {
  selected: StreamsBuilderComponentMapRow | null;
  label: string;
  text: string;
  fontSize: string;
  width: string;
  textColor: string;
  fillColor: string;
}) {
  const file = sourceValue(params.selected?.file || params.selected?.githubPath, "unresolved-file");
  const component = sourceValue(params.selected?.component, "unresolved-component");
  return [
    `target: ${file}`,
    `component: ${component}`,
    `label: ${params.label}`,
    `text: ${JSON.stringify(params.text)}`,
    `font-size: ${params.fontSize}px`,
    `width: ${params.width}px`,
    `text-color: ${params.textColor}`,
    `fill: ${params.fillColor || "transparent"}`,
  ];
}

function SourceTruthRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-slate-100">{sourceValue(value)}</p>
    </div>
  );
}

export default function StreamsBuilderVisualEditorPanel({ project, mappings, onActivity }: VisualEditorPanelProps) {
  const usableMappings = useMemo(
    () => mappings.filter((mapping) => mapping.projectId === project?.projectId),
    [mappings, project?.projectId],
  );
  const [selectedId, setSelectedId] = useState<string>(usableMappings[0]?.id || "");
  const selected = useMemo(
    () => usableMappings.find((mapping) => mapping.id === selectedId) || usableMappings[0] || null,
    [selectedId, usableMappings],
  );

  const initialLabel = sourceValue(selected?.component || project?.component, "Selected Component");
  const [label, setLabel] = useState(initialLabel);
  const [text, setText] = useState("Build Better. Ship Faster.");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontSize, setFontSize] = useState("42");
  const [fontWeight, setFontWeight] = useState("700");
  const [lineHeight, setLineHeight] = useState("1.05");
  const [letterSpacing, setLetterSpacing] = useState("-1");
  const [alignment, setAlignment] = useState("Center");
  const [width, setWidth] = useState("620");
  const [height, setHeight] = useState("88");
  const [textColor, setTextColor] = useState("#ffffff");
  const [fillColor, setFillColor] = useState("transparent");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const patchPreview = useMemo(
    () => buildPatchPreview({ selected, label, text, fontSize, width, textColor, fillColor }),
    [selected, label, text, fontSize, width, textColor, fillColor],
  );

  const resolvedRoute = selected?.route || project?.activeRoute || null;
  const resolvedComponent = selected?.component || project?.component || null;
  const resolvedFile = selected?.file || project?.file || null;
  const resolvedGithubPath = selected?.githubPath || project?.githubPath || null;

  async function recordEditorActivity(action: PatchAction) {
    if (!project) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/streams-builder/activity-log", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.projectId,
          sessionId: project.jobId || project.projectId,
          actionType: action === "save_patch" ? "visual_editor_patch_saved" : "visual_editor_patch_duplicate_requested",
          previousState: selected?.truthState || project.proofState,
          nextState: "UNPROVEN",
          truthState: "UNPROVEN",
          message:
            action === "save_patch"
              ? `Visual editor patch draft recorded for ${sourceValue(resolvedComponent)} in ${sourceValue(resolvedFile)}`
              : `Visual editor duplicate draft recorded for ${sourceValue(resolvedComponent)} in ${sourceValue(resolvedFile)}`,
        }),
      });
      const json = (await response.json()) as ActivityResponse;
      if (!json.ok) throw new Error(json.error || "Unable to record visual editor activity");
      setMessage(action === "save_patch" ? "Patch draft recorded as UNPROVEN activity." : "Duplicate draft request recorded as UNPROVEN activity.");
      onActivity?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Visual editor activity failed");
    } finally {
      setSaving(false);
    }
  }

  function resetEditor() {
    setLabel(initialLabel);
    setText("Build Better. Ship Faster.");
    setFontFamily("Inter");
    setFontSize("42");
    setFontWeight("700");
    setLineHeight("1.05");
    setLetterSpacing("-1");
    setAlignment("Center");
    setWidth("620");
    setHeight("88");
    setTextColor("#ffffff");
    setFillColor("transparent");
    setMessage("Editor values reset to the selected source-truth element.");
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#253149] bg-[#070d1c] shadow-2xl shadow-black/30">
      <div className="border-b border-[#1f2a44] bg-[#050b19] px-5 py-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Visual Editing Workspace</p>
            <h2 className="mt-1 text-2xl font-black text-white">Editable Front View</h2>
            <p className="mt-1 text-xs text-slate-400">Click mapped source-truth components to edit text, style, spacing, size, and artifact data.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-black">
            <button
              type="button"
              disabled={!project || saving}
              onClick={() => recordEditorActivity("duplicate_draft")}
              className="rounded-xl border border-[#26324c] bg-[#0d1628] px-3 py-2 text-white transition hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Duplicate Element
            </button>
            <button
              type="button"
              onClick={resetEditor}
              className="rounded-xl border border-[#26324c] bg-[#0d1628] px-3 py-2 text-white transition hover:border-violet-400"
            >
              Reset Canvas
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[140px_minmax(0,1fr)_250px]">
        <aside className="rounded-2xl border border-[#253149] bg-[#0b1224] p-3">
          <h3 className="mb-4 text-sm font-black text-white">Layers</h3>
          <div className="grid gap-2">
            {usableMappings.length ? (
              usableMappings.map((mapping) => {
                const active = selected?.id === mapping.id;
                return (
                  <button
                    key={mapping.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(mapping.id);
                      setLabel(sourceValue(mapping.component, "Selected Component"));
                    }}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-violet-500 bg-violet-600/30 text-white"
                        : "border-[#1c2740] bg-[#070d1c] text-slate-300 hover:border-violet-400"
                    }`}
                  >
                    <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">Component</span>
                    <span className="mt-1 block truncate text-xs font-black">{sourceValue(mapping.component)}</span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-[#1c2740] bg-[#070d1c] px-3 py-4 text-xs leading-5 text-slate-400">
                No mapped components found. Editor remains attached to project source-truth only.
              </div>
            )}
          </div>
        </aside>

        <div className="overflow-hidden rounded-2xl border border-[#253149] bg-[#050a18]">
          <div className="grid min-h-[430px] place-items-center overflow-auto bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[length:24px_24px] p-4">
            <div className="w-full max-w-[760px] overflow-hidden rounded-[24px] border border-[#24314f] bg-[#030816] shadow-2xl shadow-black/40">
              <div className="border-b border-violet-500/60 bg-gradient-to-b from-[#0b1025] to-[#030816] px-8 py-12 text-center">
                <h1
                  className="mx-auto font-black text-white"
                  style={{
                    maxWidth: `${width}px`,
                    minHeight: `${height}px`,
                    fontFamily,
                    fontSize: `${Number(fontSize) || 42}px`,
                    fontWeight: Number(fontWeight) || 700,
                    lineHeight,
                    letterSpacing: `${Number(letterSpacing) || 0}px`,
                    textAlign: alignment.toLowerCase() as "left" | "center" | "right",
                    color: textColor,
                    background: fillColor === "transparent" ? "transparent" : fillColor,
                  }}
                >
                  {text}
                </h1>
              </div>
              <div className="px-8 py-7 text-center">
                <p className="text-sm font-semibold text-slate-300">The intelligent workspace for building, editing, proving, and shipping real software.</p>
                <button type="button" className="mt-8 rounded-xl bg-violet-600 px-12 py-4 text-sm font-black text-white shadow-lg shadow-violet-950/40">
                  Start Editing
                </button>
                <div className="mx-auto mt-7 max-w-[285px] rounded-2xl border border-[#22304c] bg-[#101827] p-5 text-left">
                  <p className="text-sm font-black text-white">{sourceValue(resolvedComponent, "Selected Component")}</p>
                  <p className="mt-2 truncate text-xs text-slate-500">{sourceValue(resolvedFile)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[#1f2a44] bg-[#060c1b] p-4 sm:grid-cols-4">
            <SourceTruthRow label="Route" value={resolvedRoute} />
            <SourceTruthRow label="Component" value={resolvedComponent} />
            <SourceTruthRow label="File" value={resolvedFile} />
            <SourceTruthRow label="GitHub Path" value={resolvedGithubPath} />
          </div>
        </div>

        <aside className="grid gap-3 rounded-2xl border border-[#253149] bg-[#0b1224] p-3">
          <section>
            <h3 className="mb-3 text-sm font-black text-white">Quick Edit</h3>
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Text
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} className={editorInputClass} />
            </label>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Size
              <input value={fontSize} onChange={(event) => setFontSize(event.target.value)} className={compactInputClass} />
            </label>
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Width
              <input value={width} onChange={(event) => setWidth(event.target.value)} className={compactInputClass} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Text Color
              <input value={textColor} onChange={(event) => setTextColor(event.target.value)} className={compactInputClass} />
            </label>
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Fill
              <input value={fillColor} onChange={(event) => setFillColor(event.target.value)} className={compactInputClass} />
            </label>
          </div>

          <section className="rounded-2xl border border-[#253149] bg-[#050a18] p-3">
            <h3 className="text-xl font-black text-white">Patch Preview</h3>
            <div className="mt-3 grid gap-1 text-[11px] leading-5 text-slate-300">
              {patchPreview.map((line) => (
                <p key={line} className="break-words">{line}</p>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="grid gap-4 border-t border-[#1f2a44] bg-[#070d1c] p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <section className="rounded-2xl border border-[#253149] bg-[#0b1224] p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-white">Visual Editor Inspector</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 lg:col-span-1">
              Label
              <input value={label} onChange={(event) => setLabel(event.target.value)} className={compactInputClass} />
            </label>
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 lg:col-span-2">
              Text
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} className={editorInputClass} />
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Font Family
              <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)} className={compactInputClass}>
                <option>Inter</option>
                <option>Arial</option>
                <option>Georgia</option>
                <option>system-ui</option>
              </select>
            </label>
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Weight
              <input value={fontWeight} onChange={(event) => setFontWeight(event.target.value)} className={compactInputClass} />
            </label>
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Line
              <input value={lineHeight} onChange={(event) => setLineHeight(event.target.value)} className={compactInputClass} />
            </label>
            <label className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Spacing
              <input value={letterSpacing} onChange={(event) => setLetterSpacing(event.target.value)} className={compactInputClass} />
            </label>
          </div>
        </section>

        <aside className="grid content-between gap-3 rounded-2xl border border-[#253149] bg-[#0b1224] p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Truth State</p>
            <p className="mt-2 text-lg font-black text-amber-300">{selected?.truthState || project?.proofState || "UNKNOWN"}</p>
            {selected?.missing?.length ? <p className="mt-2 text-xs leading-5 text-slate-400">Missing: {selected.missing.join(", ")}</p> : null}
            {message ? <p className="mt-3 rounded-xl border border-[#253149] bg-[#050a18] p-3 text-xs leading-5 text-slate-300">{message}</p> : null}
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              disabled={!project || saving}
              onClick={() => recordEditorActivity("save_patch")}
              className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {saving ? "Saving..." : "Save Patch"}
            </button>
            <button
              type="button"
              disabled={!project || saving}
              onClick={() => recordEditorActivity("duplicate_draft")}
              className="rounded-xl border border-[#26324c] bg-[#101827] px-4 py-3 text-sm font-black text-white transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={resetEditor}
              className="rounded-xl border border-red-500/50 bg-red-950/30 px-4 py-3 text-sm font-black text-red-100 transition hover:border-red-400"
            >
              Reset
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
