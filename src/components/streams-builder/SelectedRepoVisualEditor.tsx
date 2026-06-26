"use client";

import { useEffect, useMemo, useState } from "react";
import RuntimeCodeEditor from "./RuntimeCodeEditor";

type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };
type Props = { activeFile: PulledFileDetail };
type ViewMode = "split" | "code" | "preview";
type CodeSelection = { startLine: number; startColumn: number; endLine: number; endColumn: number; text: string };
type SourceSection = { id: string; label: string; startLine: number; endLine: number; text: string; images: string[]; code: string };

function normalizeRoute(route?: string) { const value = (route || "/").trim(); return value.startsWith("/") ? value : `/${value}`; }
function repoName(repo?: string) { return (repo || "").split("/").pop() || ""; }
function liveUrlFor(source: PulledFileDetail) { const route = normalizeRoute(source.route); if (source.repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${route}`; if (source.repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${route}`; const app = repoName(source.repo); return app ? `https://${app}.vercel.app${route}` : route; }
function cleanText(text: string) { return text.replace(/\s+/g, " ").trim(); }
function lineOfOffset(source: string, offset: number) { return source.slice(0, offset).split("\n").length; }
function sectionLabel(text: string, index: number) { const lower = text.toLowerCase(); if (lower.includes("hero") || lower.includes("instant") || lower.includes("medical")) return "Hero / Top section"; if (lower.includes("visit")) return "Visit section"; if (lower.includes("provider")) return "Provider section"; if (lower.includes("faq")) return "FAQ section"; if (lower.includes("privacy")) return "Privacy section"; return `Source section ${index + 1}`; }
function findSourceSections(source: string): SourceSection[] {
  if (!source.trim()) return [];
  const candidates: SourceSection[] = [];
  const tagRegex = /<(section|header|main|article|div)\b[\s\S]*?>[\s\S]*?<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(source)) && candidates.length < 24) {
    const code = match[0];
    const literalText = Array.from(code.matchAll(/>([^<>{}\n][^<>{}] {0,240}?)</g)).map((item) => cleanText(item[1])).filter((text) => text.length > 2).slice(0, 8).join(" · ");
    const quotedText = Array.from(code.matchAll(/["'`]([^"'`{}]{4,120})["'`]/g)).map((item) => cleanText(item[1])).filter((text) => /[A-Za-z]/.test(text)).slice(0, 8).join(" · ");
    const text = cleanText(literalText || quotedText);
    const images = Array.from(code.matchAll(/(?:src|image|url)\s*=\s*[{]?["'`]([^"'`{}]+)["'`]/g)).map((item) => item[1]).slice(0, 6);
    if (!text && !images.length) continue;
    const startLine = lineOfOffset(source, match.index);
    const endLine = lineOfOffset(source, match.index + code.length);
    if (endLine - startLine < 2) continue;
    candidates.push({ id: `section-${candidates.length + 1}`, label: sectionLabel(text, candidates.length), startLine, endLine, text: text || "Image / media section", images, code });
  }
  if (candidates.length) return candidates;
  const lines = source.split("\n");
  return [{ id: "file", label: "Whole file", startLine: 1, endLine: Math.min(lines.length, 80), text: "No JSX sections detected. Showing file top range.", images: [], code: lines.slice(0, 80).join("\n") }];
}

export default function SelectedRepoVisualEditor({ activeFile }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [codeDraft, setCodeDraft] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const ready = Boolean(activeFile.repo && activeFile.path);
  const liveUrl = useMemo(() => liveUrlFor(activeFile), [activeFile.repo, activeFile.route]);
  const isDirty = codeDraft !== (activeFile.content || "");
  const sections = useMemo(() => findSourceSections(codeDraft), [codeDraft]);
  const selectedSection = sections.find((section) => section.id === selectedSectionId) || sections[0] || null;

  useEffect(() => { setCodeDraft(activeFile.content || ""); setPreviewKey((value) => value + 1); setSelection(null); setSelectedSectionId(""); }, [activeFile.repo, activeFile.branch, activeFile.path, activeFile.sha, activeFile.content]);
  useEffect(() => { if (!selectedSectionId && sections[0]) setSelectedSectionId(sections[0].id); }, [sections, selectedSectionId]);

  function selectSection(section: SourceSection) {
    setSelectedSectionId(section.id);
    setViewMode("split");
    window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "section-selected", message: `${section.label} selected at lines ${section.startLine}-${section.endLine}` } }));
  }

  return (
    <section className="selectedRepoEditor" aria-label="Selected repository visual editor">
      <header className="top"><div><b>Visual Component Editor</b><span>{ready ? `${activeFile.repo}@${activeFile.branch} · ${activeFile.path}` : "Pull a source file to start"}</span></div><div className="actions"><button type="button" className={viewMode === "split" ? "active" : ""} onClick={() => setViewMode("split")}>Code + Frontend</button><button type="button" className={viewMode === "code" ? "active" : ""} onClick={() => setViewMode("code")}>Code</button><button type="button" className={viewMode === "preview" ? "active" : ""} onClick={() => setViewMode("preview")}>Frontend UI</button><button type="button" onClick={() => setPreviewKey((value) => value + 1)}>Refresh preview</button><button type="button" disabled={!ready || !isDirty}>Stage</button></div></header>
      <div className="sourceStrip"><span><b>Repo</b>{activeFile.repo || "not selected"}</span><span><b>Branch</b>{activeFile.branch || "not selected"}</span><span><b>File</b>{activeFile.path || "not selected"}</span><span><b>Route</b>{normalizeRoute(activeFile.route)}</span><span><b>Preview</b>{ready ? liveUrl : "waiting for pull"}</span></div>
      <main className={`body ${viewMode}`}>
        {viewMode !== "preview" ? <section className="codePane"><RuntimeCodeEditor value={codeDraft} filePath={activeFile.path || "no-file-selected"} sha={activeFile.sha} onChange={setCodeDraft} onSelectionChange={setSelection} highlightRange={selectedSection ? { startLine: selectedSection.startLine, endLine: selectedSection.endLine } : null} /></section> : null}
        {viewMode !== "code" ? <section className="previewPane"><div className="paneTitle"><b>Actual frontend preview</b><span>{liveUrl}</span></div><div className="previewBox">{ready ? <iframe key={`${previewKey}-${liveUrl}`} title="Actual selected repository frontend" src={liveUrl} /> : <div className="empty">Pull a source file first.</div>}</div></section> : null}
      </main>
      <section className="inspector"><div className="sectionList"><b>Selectable source sections</b>{sections.slice(0, 12).map((section) => <button key={section.id} type="button" className={selectedSection?.id === section.id ? "selected" : ""} onClick={() => selectSection(section)}><span>{section.label}</span><em>Lines {section.startLine}-{section.endLine}</em></button>)}</div><div className="sectionDetails"><b>{selectedSection?.label || "No section selected"}</b><span>{selectedSection ? `File range: ${selectedSection.startLine}-${selectedSection.endLine}` : "Select a section to inspect"}</span><textarea readOnly value={selectedSection?.text || ""} /><div>{selectedSection?.images.length ? selectedSection.images.map((image) => <p key={image}>Image/source: {image}</p>) : <p>No image source detected in this section.</p>}</div></div></section>
      <footer className="statusBar"><div><span>Mode</span><b>{viewMode === "split" ? "Code and frontend side by side" : viewMode}</b></div><div><span>Code selection</span><b>{selection ? `Lines ${selection.startLine}-${selection.endLine}` : selectedSection ? `Section lines ${selectedSection.startLine}-${selectedSection.endLine}` : "none"}</b></div><div><span>Next</span><b>Click section → code range highlights → inspect/edit patch</b></div></footer>
      <style jsx>{`.selectedRepoEditor{height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;background:#050915;color:#f8fafc;overflow:hidden}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.actions{display:flex;gap:8px;align-items:center}.actions button{height:30px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#7c3aed;color:#fff;padding:0 10px;font-size:11px;font-weight:800;cursor:pointer}.actions button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}.actions button:disabled{opacity:.45;cursor:not-allowed}.sourceStrip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.35)}.sourceStrip span{min-width:0;display:block;padding:8px 10px;background:#020617;color:#cbd5e1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sourceStrip b{display:block;color:#6ee7b7;font-size:9px;text-transform:uppercase}.body{min-height:0;display:grid;background:rgba(148,163,184,.18);overflow:hidden}.body.split{grid-template-columns:minmax(360px,.9fr) minmax(420px,1fr)}.body.code,.body.preview{grid-template-columns:minmax(0,1fr)}.codePane,.previewPane{min-width:0;min-height:0;display:grid;background:#050915;overflow:hidden}.previewPane{grid-template-rows:auto minmax(0,1fr)}.paneTitle{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;font-size:11px}.paneTitle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#93c5fd}.previewBox{min-height:0;margin:10px;border:1px solid rgba(124,58,237,.45);border-radius:14px;overflow:auto;background:#fff}.previewBox iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.empty{height:100%;display:grid;place-items:center;color:#0f172a}.inspector{display:grid;grid-template-columns:minmax(260px,.7fr) minmax(360px,1fr);gap:8px;padding:8px;border-top:1px solid rgba(148,163,184,.18);background:#020617;max-height:190px}.sectionList,.sectionDetails{min-width:0;display:grid;gap:6px;overflow:auto}.sectionList b,.sectionDetails b{color:#6ee7b7;font-size:10px;text-transform:uppercase}.sectionList button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;border:1px solid rgba(148,163,184,.16);border-radius:9px;background:#0f172a;color:#fff;padding:7px;font-size:10px;text-align:left;cursor:pointer}.sectionList button.selected{border-color:#34d399;background:rgba(6,78,59,.42)}.sectionList em{color:#93c5fd;font-style:normal;font-size:9px}.sectionDetails span,.sectionDetails p{margin:0;color:#cbd5e1;font-size:10px;overflow-wrap:anywhere}.sectionDetails textarea{min-height:58px;resize:none;border:1px solid rgba(148,163,184,.18);border-radius:9px;background:#050915;color:#fff;padding:8px;font-size:10px}.statusBar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.statusBar div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.statusBar span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.statusBar b{display:block;color:#fff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`}</style>
    </section>
  );
}
