"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  stationLabel: string;
  route: string;
  filePath: string;
  repo: string;
  branch: string;
  content: string;
  onContentChange: (next: string) => void;
  onProof: (message: string) => void;
  onChat: (message: string) => void;
};

type ViewMode = "editor" | "browser" | "mobile" | "advanced";
type EditableItem = { id: string; label: string; selector: string; file: string; text: string };
type EditStyle = { text: string; fontSize: number; color: string; background: string; width: number; height: number; radius: number; x: number; y: number; opacity: number };

function normalizeRoute(value: string) {
  const trimmed = (value || "/").trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function repoName(repo: string) {
  return (repo || "").split("/").pop() || "";
}

function deploymentUrl(repo: string, route: string) {
  const app = repoName(repo);
  const path = normalizeRoute(route);
  if (typeof window !== "undefined" && repo === "hawk7227/streamsailive") return `${window.location.origin}${path}`;
  if (repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${path}`;
  if (repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${path}`;
  return app ? `https://${app}.vercel.app${path}` : path;
}

function cleanText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function isUiText(value: string) {
  if (!value || value.length < 2) return false;
  if (/^(const|let|var|return|import|export|from|async|await|try|catch|true|false|null|undefined)$/i.test(value)) return false;
  if (/useState|useRef|set[A-Z]|JSON\.|fetch\(|headers|method|body|stringify|className|=>|\{\}|\[\]/.test(value)) return false;
  if (/^[\w$]+\([^)]*\)$/.test(value)) return false;
  if (value.includes("@/") || value.includes("/api/") || value.includes("Content-Type")) return false;
  return /[a-zA-Z0-9]/.test(value);
}

function extractEditableItems(content: string, filePath: string): EditableItem[] {
  const literalMatches = Array.from(content.matchAll(/(?:aria-label|title|placeholder|alt|children)?\s*=?\s*["'`]([^"'`{}<>]{2,120})["'`]/g)).map((m) => cleanText(m[1]));
  const jsxTextMatches = Array.from(content.matchAll(/>([^<>{}\n][^<>{}]*)</g)).map((m) => cleanText(m[1]));
  const all = Array.from(new Set([...jsxTextMatches, ...literalMatches])).filter(isUiText).slice(0, 40);
  if (!all.length) {
    return [{ id: "source-file", label: "Source file", selector: "src/app/page.tsx", file: filePath, text: "No direct editable text was found in this file. Imported child components must be pulled/opened to edit their content." }];
  }
  return all.map((text, index) => ({
    id: `item-${index}`,
    label: index === 0 ? "First visible text" : `Visible text ${index + 1}`,
    selector: index === 0 ? "first text node" : "text node",
    file: filePath,
    text,
  }));
}

function defaultStyle(text: string): EditStyle {
  return { text, fontSize: 16, color: "#ffffff", background: "transparent", width: 320, height: 48, radius: 0, x: 0, y: 0, opacity: 1 };
}

export default function VisualEditingWorkstation({ stationLabel, route, filePath, repo, branch, content, onContentChange, onProof, onChat }: Props) {
  const sourceRoute = normalizeRoute(route);
  const defaultUrl = useMemo(() => deploymentUrl(repo, sourceRoute), [repo, sourceRoute]);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [browserUrl, setBrowserUrl] = useState(defaultUrl);
  const [frameKey, setFrameKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const editableItems = useMemo(() => extractEditableItems(content || "", filePath || "src/app/page.tsx"), [content, filePath]);
  const [selectedId, setSelectedId] = useState("");
  const selected = editableItems.find((item) => item.id === selectedId) || editableItems[0];
  const [style, setStyle] = useState<EditStyle>(defaultStyle(selected?.text || ""));
  const ready = Boolean(repo && filePath);
  const liveUrl = browserUrl || defaultUrl;

  useEffect(() => {
    setBrowserUrl(defaultUrl);
    setSelectedId(editableItems[0]?.id || "");
    setStyle(defaultStyle(editableItems[0]?.text || ""));
    setFrameKey((value) => value + 1);
    setDrawerOpen(true);
    onProof(`Visual editor mounted actual frontend: ${repo || "no repo"}@${branch || "no branch"}:${sourceRoute}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, branch, sourceRoute, filePath, defaultUrl, content.length]);

  function selectItem(item: EditableItem) {
    setSelectedId(item.id);
    setStyle(defaultStyle(item.text));
    setDrawerOpen(true);
    onProof(`Selected source text: ${item.text}`);
    onChat(`Selected editable source text from ${item.file}.`);
  }

  function switchMode(nextMode: ViewMode) {
    setViewMode(nextMode);
    if (nextMode === "advanced") setDrawerOpen(true);
    if (nextMode === "mobile") setFrameKey((value) => value + 1);
    onProof(`Visual editor mode: ${nextMode}`);
  }

  function updateStyle(patch: Partial<EditStyle>) {
    setStyle((current) => ({ ...current, ...patch }));
  }

  function savePatch() {
    const original = selected?.text || "";
    const replacement = style.text || "";
    const nextContent = original && replacement && content.includes(original) ? content.replace(original, replacement) : `${content || ""}\n\n/* Streams visual edit\nfile: ${filePath}\nselector: ${selected?.selector || ""}\nfrom: ${original}\nto: ${replacement}\nfontSize: ${style.fontSize}\ncolor: ${style.color}\nbackground: ${style.background}\nwidth: ${style.width}\nheight: ${style.height}\nradius: ${style.radius}\n*/`;
    onContentChange(nextContent);
    onProof(`Saved visual edit patch for ${selected?.label || "selected text"}.`);
  }

  function refreshPreview() {
    setFrameKey((value) => value + 1);
    onProof(`Refreshed live preview: ${liveUrl}`);
  }

  function resetEditor() {
    setBrowserUrl(defaultUrl);
    setSelectedId(editableItems[0]?.id || "");
    setStyle(defaultStyle(editableItems[0]?.text || ""));
    setFrameKey((value) => value + 1);
    setDrawerOpen(true);
    onProof("Reset visual editor to source truth.");
  }

  function duplicateItem() {
    setStyle((current) => ({ ...current, text: `${current.text} Copy` }));
    setDrawerOpen(true);
    onProof("Duplicated selected text in the editor draft.");
  }

  return (
    <section className="visualEditor">
      <header className="top">
        <div><b>VISUAL EDITOR</b><span>{stationLabel} · actual frontend on top, source editor below</span></div>
        <div className="routeBar"><button type="button" onClick={refreshPreview}>↻</button><input value={liveUrl} onChange={(event) => setBrowserUrl(event.target.value)} /><button type="button" onClick={refreshPreview}>Open</button></div>
      </header>

      <main className={`canvas ${viewMode}`}>
        <div className="sourceDebug"><span>repo <b>{repo || "not selected"}</b></span><span>branch <b>{branch || "not selected"}</b></span><span>route <b>{sourceRoute}</b></span><span>file <b>{filePath || "not selected"}</b></span><span>live url <b>{ready ? liveUrl : "waiting for pull"}</b></span></div>
        <section className={viewMode === "mobile" ? "phoneFrame" : "desktopFrame"}>
          {ready ? <iframe key={`${frameKey}-${liveUrl}-${viewMode}`} title="Actual frontend preview" src={liveUrl} /> : <div className="emptyFrame"><h2>Pull a source file first</h2><p>The actual frontend will appear here.</p></div>}
        </section>
      </main>

      <footer className="sourceActionStrip"><div><span>Route</span><b>{sourceRoute}</b></div><div><span>Selected</span><b>{selected?.label || "none"}</b></div><div><span>File</span><b>{filePath || "no file"}</b></div><div><span>Branch</span><b>{branch || "no branch"}</b></div><div><span>Mode</span><b>{viewMode}</b></div><button type="button" className={viewMode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button><button type="button" className={viewMode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button><button type="button" className={viewMode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button><button type="button" className={viewMode === "advanced" ? "active" : ""} onClick={() => switchMode("advanced")}>Advanced</button><button type="button" onClick={savePatch}>Save</button><button type="button" onClick={duplicateItem}>Dup</button><button type="button" onClick={resetEditor}>Reset</button></footer>

      <details className="editorDrawer" open={drawerOpen || viewMode === "advanced"} onToggle={(event) => setDrawerOpen(event.currentTarget.open)}><summary>Proof / Source Truth / Editor</summary><section className="drawerGrid"><section className="listPanel"><b>Editable source content found in pulled file</b>{editableItems.map((item) => <button key={item.id} type="button" className={selected?.id === item.id ? "active" : ""} onClick={() => selectItem(item)}>{item.text}</button>)}</section><label>Selected layer<input value={selected?.label || ""} readOnly /></label><label>Selector<input value={selected?.selector || ""} readOnly /></label><label>File<input value={selected?.file || filePath || ""} readOnly /></label><label className="wide">Text<textarea value={style.text} onChange={(event) => updateStyle({ text: event.target.value })} /></label><label>Font size<input type="number" value={style.fontSize} onChange={(event) => updateStyle({ fontSize: Number(event.target.value) || 12 })} /></label><label>Text color<input type="color" value={style.color} onChange={(event) => updateStyle({ color: event.target.value })} /></label><label>Background<input value={style.background} onChange={(event) => updateStyle({ background: event.target.value })} /></label><label>Width<input type="number" value={style.width} onChange={(event) => updateStyle({ width: Number(event.target.value) || 40 })} /></label><label>Height<input type="number" value={style.height} onChange={(event) => updateStyle({ height: Number(event.target.value) || 24 })} /></label><label>Radius<input type="number" value={style.radius} onChange={(event) => updateStyle({ radius: Number(event.target.value) || 0 })} /></label><section className="proofBox"><b>Strict Builder Proof</b><p>Top preview is the actual live frontend iframe.</p><p>No fake backend logic labels are drawn over the page.</p><p>Browser mode is click-through because the iframe is unobstructed.</p><p>Bottom editor displays source text extracted from the pulled file.</p><p>Note: imported child components must be pulled/opened to edit their internal content.</p></section><section className="patchBox"><b>Patch Preview</b><p>from: {selected?.text || "none"}</p><p>to: {style.text || "none"}</p><p>fontSize: {style.fontSize}</p><p>color: {style.color}</p><p>background: {style.background}</p></section></section></details>

      <style jsx>{`
        .visualEditor{width:100%;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;background:#020617;color:#fff;overflow:hidden}.top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(148,163,184,.18);background:#0f172a}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.routeBar{display:grid;grid-template-columns:40px minmax(260px,1fr) 80px;gap:8px;width:min(680px,56vw)}.routeBar input{height:38px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:#020617;color:#fff;padding:0 14px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;height:36px;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}.canvas{position:relative;min-height:0;overflow:hidden;background:#020617}.sourceDebug{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.5)}.sourceDebug span{padding:9px 12px;background:#020617;color:#94a3b8;font-size:10px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sourceDebug b{display:block;color:#fff;text-transform:none;font-size:12px}.desktopFrame{height:calc(100% - 38px);margin:10px;border:1px solid rgba(124,58,237,.5);border-radius:16px;overflow:auto;background:#fff}.phoneFrame{width:430px;height:min(760px,calc(100% - 30px));margin:12px auto;border:12px solid #111827;border-radius:36px;overflow:auto;background:#fff}.desktopFrame iframe,.phoneFrame iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.emptyFrame{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.sourceActionStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(7,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.sourceActionStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.sourceActionStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.sourceActionStrip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.editorDrawer{max-height:380px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617}.editorDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:1.2fr repeat(3,minmax(0,1fr));gap:8px;padding:10px}.drawerGrid label,.proofBox,.patchBox,.listPanel{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.drawerGrid input,.drawerGrid textarea{width:100%;margin-top:6px;border:1px solid rgba(148,163,184,.2);border-radius:8px;background:#020617;color:#fff;padding:8px;box-sizing:border-box}.wide{grid-column:span 2}.listPanel{grid-row:span 3;max-height:330px;overflow:auto}.listPanel b{display:block;margin-bottom:8px;color:#fff}.listPanel button{display:block;width:100%;height:auto;min-height:30px;margin:0 0 6px;text-align:left;white-space:normal}.proofBox p,.patchBox p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}
      `}</style>
    </section>
  );
}
