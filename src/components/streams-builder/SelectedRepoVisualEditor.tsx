"use client";

import { useEffect, useMemo, useState } from "react";
import RuntimeCodeEditor from "./RuntimeCodeEditor";

type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };
type Props = { activeFile: PulledFileDetail };
type ViewMode = "split" | "code" | "preview";
type CodeSelection = { startLine: number; startColumn: number; endLine: number; endColumn: number; text: string };
type SourceSection = { id: string; label: string; startLine: number; endLine: number; text: string; images: string[]; code: string };
type VisualLayer = {
  id: string;
  kind: "text" | "image" | "button" | "panel";
  label: string;
  value: string;
  original: string;
  visible: boolean;
  fontSize: number;
  color: string;
  background: string;
  width: number;
  height: number;
  x: number;
  y: number;
};

function normalizeRoute(route?: string) { const value = (route || "/").trim(); return value.startsWith("/") ? value : `/${value}`; }
function repoName(repo?: string) { return (repo || "").split("/").pop() || ""; }
function liveUrlFor(source: PulledFileDetail) { const route = normalizeRoute(source.route); if (source.repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${route}`; if (source.repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${route}`; const app = repoName(source.repo); return app ? `https://${app}.vercel.app${route}` : route; }
function cleanText(text: string) { return text.replace(/\s+/g, " ").trim(); }
function lineOfOffset(source: string, offset: number) { return source.slice(0, offset).split("\n").length; }
function sectionLabel(text: string, index: number) { const lower = text.toLowerCase(); if (lower.includes("instant") || lower.includes("medical") || lower.includes("healthcare")) return "Hero / Top editable section"; if (lower.includes("visit")) return "Visit card editable section"; if (lower.includes("provider")) return "Provider editable section"; if (lower.includes("faq")) return "FAQ editable section"; return `Editable section ${index + 1}`; }
function unique(values: string[]) { return Array.from(new Set(values.map(cleanText).filter(Boolean))); }
function findSourceSections(source: string): SourceSection[] {
  if (!source.trim()) return [];
  const candidates: SourceSection[] = [];
  const tagRegex = /<(section|header|main|article|div)\b[\s\S]*?>[\s\S]*?<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(source)) && candidates.length < 24) {
    const code = match[0];
    const literalText = Array.from(code.matchAll(/>([^<>{}\n][^<>{}]{2,180}?)</g)).map((item) => cleanText(item[1])).filter((text) => /[A-Za-z]/.test(text));
    const quotedText = Array.from(code.matchAll(/["'`]([^"'`{}]{4,140})["'`]/g)).map((item) => cleanText(item[1])).filter((text) => /[A-Za-z]/.test(text) && !/^(flex|grid|text-|bg-|border|rounded|absolute|relative|hidden|block|inline|w-|h-|p-|m-|gap|items|justify)/.test(text));
    const text = unique([...literalText, ...quotedText]).slice(0, 10).join(" · ");
    const images = unique(Array.from(code.matchAll(/(?:src|image|url)\s*=\s*[{]?["'`]([^"'`{}]+)["'`]/g)).map((item) => item[1])).slice(0, 6);
    if (!text && !images.length) continue;
    const startLine = lineOfOffset(source, match.index);
    const endLine = lineOfOffset(source, match.index + code.length);
    if (endLine - startLine < 2) continue;
    candidates.push({ id: `section-${candidates.length + 1}`, label: sectionLabel(text, candidates.length), startLine, endLine, text: text || "Image / media section", images, code });
  }
  return candidates.length ? candidates : [{ id: "file", label: "Whole file editable range", startLine: 1, endLine: Math.min(source.split("\n").length, 80), text: "No JSX sections detected. Showing file top range.", images: [], code: source.split("\n").slice(0, 80).join("\n") }];
}
function layerLabel(text: string, index: number) { const lower = text.toLowerCase(); if (lower.includes("instant") || lower.includes("medical")) return "Heading"; if (lower.includes("healthcare")) return "Section title"; if (lower.includes("private") || lower.includes("personal")) return "Badge / pill text"; if (lower.includes("visit")) return "Visit text"; if (lower.includes("provider") || lower.includes("nurse") || lower.includes("hodges")) return "Provider text"; return `Text layer ${index + 1}`; }
function makeLayers(section: SourceSection | null): VisualLayer[] {
  if (!section) return [];
  const texts = unique(section.text.split(" · ").filter((text) => text.length > 2)).slice(0, 10);
  const textLayers = texts.map((text, index) => ({ id: `text-${index + 1}`, kind: (text.toLowerCase().includes("book") || text.toLowerCase().includes("visit")) ? "button" as const : "text" as const, label: layerLabel(text, index), value: text, original: text, visible: true, fontSize: index === 0 ? 30 : 16, color: "#ffffff", background: index === 0 ? "transparent" : "rgba(15,23,42,.78)", width: index === 0 ? 92 : 70, height: index === 0 ? 46 : 34, x: 4 + (index % 2) * 4, y: 6 + index * 8 }));
  const imageLayers = section.images.map((image, index) => ({ id: `image-${index + 1}`, kind: "image" as const, label: index === 0 ? "Image / background" : `Image ${index + 1}`, value: image, original: image, visible: true, fontSize: 14, color: "#ffffff", background: "#808080", width: 92, height: 150, x: 4, y: 52 + index * 10 }));
  const panelLayer: VisualLayer = { id: "panel-1", kind: "panel", label: "Main panel / container", value: "Panel", original: "Panel", visible: true, fontSize: 14, color: "#ffffff", background: "rgba(2,6,23,.72)", width: 96, height: 96, x: 2, y: 2 };
  return [panelLayer, ...textLayers, ...imageLayers];
}
function applyLayerTextPatch(source: string, layer: VisualLayer, nextValue: string) {
  if (!layer.original || layer.kind === "panel") return source;
  return source.includes(layer.value) ? source.replace(layer.value, nextValue) : source.includes(layer.original) ? source.replace(layer.original, nextValue) : source;
}

export default function SelectedRepoVisualEditor({ activeFile }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [codeDraft, setCodeDraft] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [layers, setLayers] = useState<VisualLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const ready = Boolean(activeFile.repo && activeFile.path);
  const liveUrl = useMemo(() => liveUrlFor(activeFile), [activeFile.repo, activeFile.route]);
  const isDirty = codeDraft !== (activeFile.content || "");
  const sections = useMemo(() => findSourceSections(codeDraft), [codeDraft]);
  const selectedSection = sections.find((section) => section.id === selectedSectionId) || sections[0] || null;
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) || layers.find((layer) => layer.kind !== "panel") || layers[0] || null;

  useEffect(() => { setCodeDraft(activeFile.content || ""); setPreviewKey((value) => value + 1); setSelection(null); setSelectedSectionId(""); setLayers([]); setSelectedLayerId(""); }, [activeFile.repo, activeFile.branch, activeFile.path, activeFile.sha, activeFile.content]);
  useEffect(() => { if (!selectedSectionId && sections[0]) setSelectedSectionId(sections[0].id); }, [sections, selectedSectionId]);
  useEffect(() => { const nextLayers = makeLayers(selectedSection); setLayers(nextLayers); setSelectedLayerId(nextLayers.find((layer) => layer.kind !== "panel")?.id || nextLayers[0]?.id || ""); }, [selectedSection?.id]);

  function selectSection(section: SourceSection) { setSelectedSectionId(section.id); setViewMode("split"); window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "visual-section-selected", message: `${section.label} opened in editable visual replica at lines ${section.startLine}-${section.endLine}` } })); }
  function updateLayer(layerId: string, patch: Partial<VisualLayer>) { setLayers((items) => items.map((item) => item.id === layerId ? { ...item, ...patch } : item)); }
  function updateLayerValue(layer: VisualLayer, nextValue: string) { setCodeDraft((current) => applyLayerTextPatch(current, layer, nextValue)); setLayers((items) => items.map((item) => item.id === layer.id ? { ...item, value: nextValue } : item)); }
  function deleteLayer(layer: VisualLayer) { setLayers((items) => items.map((item) => item.id === layer.id ? { ...item, visible: false } : item)); window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "visual-layer-hidden", message: `${layer.label} hidden in visual editor. Code patch still requires staged apply.` } })); }
  function duplicateLayer(layer: VisualLayer) { const clone = { ...layer, id: `${layer.id}-copy-${Date.now()}`, label: `${layer.label} copy`, x: Math.min(layer.x + 4, 90), y: Math.min(layer.y + 4, 90) }; setLayers((items) => [...items, clone]); }

  return (
    <section className="selectedRepoEditor" aria-label="Selected repository visual editor">
      <header className="top"><div><b>Visual Component Editor</b><span>{ready ? `${activeFile.repo}@${activeFile.branch} · ${activeFile.path}` : "Pull a source file to start"}</span></div><div className="actions"><button type="button" className={viewMode === "split" ? "active" : ""} onClick={() => setViewMode("split")}>Code + Frontend</button><button type="button" className={viewMode === "code" ? "active" : ""} onClick={() => setViewMode("code")}>Code</button><button type="button" className={viewMode === "preview" ? "active" : ""} onClick={() => setViewMode("preview")}>Frontend UI</button><button type="button" onClick={() => setPreviewKey((value) => value + 1)}>Refresh preview</button><button type="button" disabled={!ready || !isDirty}>Stage</button></div></header>
      <div className="sourceStrip"><span><b>Repo</b>{activeFile.repo || "not selected"}</span><span><b>Branch</b>{activeFile.branch || "not selected"}</span><span><b>File</b>{activeFile.path || "not selected"}</span><span><b>Route</b>{normalizeRoute(activeFile.route)}</span><span><b>Preview</b>{ready ? liveUrl : "waiting for pull"}</span></div>
      <main className={`body ${viewMode}`}>{viewMode !== "preview" ? <section className="codePane"><RuntimeCodeEditor value={codeDraft} filePath={activeFile.path || "no-file-selected"} sha={activeFile.sha} onChange={setCodeDraft} onSelectionChange={setSelection} highlightRange={selectedSection ? { startLine: selectedSection.startLine, endLine: selectedSection.endLine } : null} /></section> : null}{viewMode !== "code" ? <section className="previewPane"><div className="paneTitle"><b>Actual frontend preview</b><span>{liveUrl}</span></div><div className="previewBox">{ready ? <iframe key={`${previewKey}-${liveUrl}`} title="Actual selected repository frontend" src={liveUrl} /> : <div className="empty">Pull a source file first.</div>}</div></section> : null}</main>
      <section className="visualEditorPanel"><div className="replicaHeader"><b>Edit selected section below</b><select value={selectedSection?.id || ""} onChange={(event) => { const next = sections.find((section) => section.id === event.target.value); if (next) selectSection(next); }}>{sections.map((section) => <option key={section.id} value={section.id}>{section.label} · lines {section.startLine}-{section.endLine}</option>)}</select></div><div className="editableReplica" aria-label="Editable visual replica">{layers.filter((layer) => layer.visible).map((layer) => <button key={layer.id} type="button" className={`visualLayer ${layer.kind} ${selectedLayer?.id === layer.id ? "selected" : ""}`} style={{ left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.width}%`, minHeight: `${layer.height}px`, color: layer.color, background: layer.background, fontSize: `${layer.fontSize}px` }} onClick={() => setSelectedLayerId(layer.id)}>{layer.kind === "image" ? <><span>image / update</span><em>{layer.value}</em></> : layer.value}</button>)}</div><div className="layerControls"><b>{selectedLayer?.label || "Select an item"}</b>{selectedLayer ? <><label>Content<input value={selectedLayer.value} onChange={(event) => updateLayerValue(selectedLayer, event.target.value)} /></label><label>Text color<input type="color" value={selectedLayer.color} onChange={(event) => updateLayer(selectedLayer.id, { color: event.target.value })} /></label><label>Background<input type="color" value={selectedLayer.background.startsWith("#") ? selectedLayer.background : "#111827"} onChange={(event) => updateLayer(selectedLayer.id, { background: event.target.value })} /></label><label>Size<input type="range" min="10" max="58" value={selectedLayer.fontSize} onChange={(event) => updateLayer(selectedLayer.id, { fontSize: Number(event.target.value) })} /></label><label>Width<input type="range" min="18" max="100" value={selectedLayer.width} onChange={(event) => updateLayer(selectedLayer.id, { width: Number(event.target.value) })} /></label><label>Move X<input type="range" min="0" max="90" value={selectedLayer.x} onChange={(event) => updateLayer(selectedLayer.id, { x: Number(event.target.value) })} /></label><label>Move Y<input type="range" min="0" max="90" value={selectedLayer.y} onChange={(event) => updateLayer(selectedLayer.id, { y: Number(event.target.value) })} /></label><div className="layerButtons"><button type="button" onClick={() => duplicateLayer(selectedLayer)}>Duplicate</button><button type="button" onClick={() => deleteLayer(selectedLayer)}>Delete / hide</button><button type="button">Replace image</button><button type="button">Download</button></div></> : <span>Click a visible item in the editable replica.</span>}<details><summary>Advanced source details</summary><p>{selectedSection ? `File range ${selectedSection.startLine}-${selectedSection.endLine}` : "No source selected"}</p><textarea readOnly value={selectedSection?.code || ""} /></details></div></section>
      <footer className="statusBar"><div><span>Mode</span><b>{viewMode === "split" ? "Code and frontend side by side" : viewMode}</b></div><div><span>Code selection</span><b>{selection ? `Lines ${selection.startLine}-${selection.endLine}` : selectedSection ? `Section lines ${selectedSection.startLine}-${selectedSection.endLine}` : "none"}</b></div><div><span>Next</span><b>Visual edits → staged code patch → runtime preview</b></div></footer>
      <style jsx>{`.selectedRepoEditor{height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;background:#050915;color:#f8fafc;overflow:hidden}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.actions{display:flex;gap:8px;align-items:center}.actions button{height:30px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#7c3aed;color:#fff;padding:0 10px;font-size:11px;font-weight:800;cursor:pointer}.actions button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}.actions button:disabled{opacity:.45;cursor:not-allowed}.sourceStrip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.35)}.sourceStrip span{min-width:0;display:block;padding:8px 10px;background:#020617;color:#cbd5e1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sourceStrip b{display:block;color:#6ee7b7;font-size:9px;text-transform:uppercase}.body{min-height:0;display:grid;background:rgba(148,163,184,.18);overflow:hidden}.body.split{grid-template-columns:minmax(360px,.9fr) minmax(420px,1fr)}.body.code,.body.preview{grid-template-columns:minmax(0,1fr)}.codePane,.previewPane{min-width:0;min-height:0;display:grid;background:#050915;overflow:hidden}.previewPane{grid-template-rows:auto minmax(0,1fr)}.paneTitle{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;font-size:11px}.paneTitle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#93c5fd}.previewBox{min-height:0;margin:10px;border:1px solid rgba(124,58,237,.45);border-radius:14px;overflow:auto;background:#fff}.previewBox iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.empty{height:100%;display:grid;place-items:center;color:#0f172a}.visualEditorPanel{display:grid;grid-template-columns:minmax(360px,.9fr) minmax(360px,1fr);gap:8px;padding:8px;border-top:1px solid rgba(148,163,184,.18);background:#020617;max-height:310px}.replicaHeader{grid-column:1 / -1;display:flex;align-items:center;gap:8px}.replicaHeader b{color:#ff3b82;text-transform:uppercase;font-size:12px}.replicaHeader select{height:30px;flex:1;background:#0f172a;color:#fff;border:1px solid rgba(148,163,184,.2);border-radius:8px}.editableReplica{position:relative;min-height:244px;overflow:hidden;border:1px solid #14b8a6;border-radius:12px;background:linear-gradient(180deg,#00130f,#050915);box-shadow:inset 0 0 0 1px rgba(20,184,166,.28)}.visualLayer{position:absolute;border:1px solid rgba(20,184,166,.65);border-radius:8px;padding:6px;display:grid;place-items:center;text-align:center;font-weight:900;text-shadow:0 2px 4px rgba(0,0,0,.5);cursor:pointer;overflow:hidden;resize:both}.visualLayer.selected{outline:2px solid #f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.18)}.visualLayer.panel{z-index:0}.visualLayer.text,.visualLayer.button,.visualLayer.image{z-index:1}.visualLayer.image span{font-size:18px}.visualLayer.image em{font-size:9px;color:#e5e7eb;font-style:normal;max-width:100%;overflow:hidden;text-overflow:ellipsis}.layerControls{min-height:0;overflow:auto;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:#0f172a;padding:8px;display:grid;gap:7px}.layerControls b{color:#6ee7b7;text-transform:uppercase;font-size:11px}.layerControls label{display:grid;grid-template-columns:100px minmax(0,1fr);gap:8px;align-items:center;color:#cbd5e1;font-size:10px}.layerControls input{min-width:0;height:28px;border:1px solid rgba(148,163,184,.18);border-radius:8px;background:#020617;color:#fff;padding:0 8px}.layerButtons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.layerButtons button{height:28px;border:1px solid rgba(110,231,183,.25);border-radius:8px;background:#7c3aed;color:#fff;font-size:10px;font-weight:800}.layerControls details{border-top:1px solid rgba(148,163,184,.14);padding-top:6px}.layerControls summary{cursor:pointer;color:#93c5fd;font-size:10px;font-weight:800}.layerControls textarea{width:100%;height:80px;background:#020617;color:#cbd5e1;border:1px solid rgba(148,163,184,.18);border-radius:8px;font-size:10px}.statusBar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.statusBar div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.statusBar span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.statusBar b{display:block;color:#fff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`}</style>
    </section>
  );
}
