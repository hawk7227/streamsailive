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
  return value.replace(/\s+/g, " ").replace(/&nbsp;/g, " ").trim();
}

function isUiText(value: string) {
  if (!value || value.length < 2) return false;
  if (/^(const|let|var|return|import|export|from|async|await|try|catch|true|false|null|undefined)$/i.test(value)) return false;
  if (/useState|useRef|set[A-Z]|JSON\.|fetch\(|headers|method|body|stringify|className|=>|\{\}|\[\]/.test(value)) return false;
  if (value.includes("@/") || value.includes("/api/") || value.includes("Content-Type")) return false;
  if (/^(flex|grid|text-|bg-|border|rounded|absolute|relative|hidden|block|inline|w-|h-|p-|m-|gap|items|justify|clamp)/.test(value)) return false;
  return /[a-zA-Z0-9]/.test(value);
}

function labelForText(text: string, index: number) {
  const lower = text.toLowerCase();
  if (lower.includes("instant") || lower.includes("medical")) return "Hero heading";
  if (lower.includes("healthcare")) return "Section heading";
  if (lower.includes("lamonica") || lower.includes("provider") || lower.includes("nurse")) return "Provider text";
  if (lower.includes("visit")) return "Visit text";
  if (lower.includes("private") || lower.includes("personal")) return "Badge text";
  if (lower.includes("book") || lower.includes("schedule") || lower.includes("start")) return "Button text";
  return index === 0 ? "Visible text" : `Visible text ${index + 1}`;
}

function extractEditableItems(content: string, filePath: string): EditableItem[] {
  const literalMatches = Array.from(content.matchAll(/(?:aria-label|title|placeholder|alt|children)?\s*=?\s*["'`]([^"'`{}<>]{2,140})["'`]/g)).map((m) => cleanText(m[1]));
  const jsxTextMatches = Array.from(content.matchAll(/>([^<>{}\n][^<>{}]*)</g)).map((m) => cleanText(m[1]));
  return Array.from(new Set([...jsxTextMatches, ...literalMatches])).filter(isUiText).slice(0, 32).map((text, index) => ({ id: `item-${index}`, label: labelForText(text, index), selector: "visual text", file: filePath, text }));
}

function defaultStyle(text: string): EditStyle {
  const isHero = /instant|medical/i.test(text);
  return { text, fontSize: isHero ? 44 : 18, color: "#ffffff", background: "transparent", width: isHero ? 86 : 46, height: isHero ? 74 : 34, radius: 4, x: isHero ? 7 : 28, y: isHero ? 7 : 28, opacity: 1 };
}

function overlayPosition(item: EditableItem, index: number) {
  const text = item.text.toLowerCase();
  if (text.includes("instant") || text.includes("medical")) return { x: 7, y: 7, width: 86, height: 74, fontSize: 44 };
  if (text.includes("healthcare")) return { x: 16, y: 45, width: 68, height: 32, fontSize: 22 };
  if (text.includes("lamonica") || text.includes("provider")) return { x: 28, y: 31, width: 48, height: 28, fontSize: 18 };
  if (text.includes("private") || text.includes("personal")) return { x: 36, y: 39, width: 34, height: 26, fontSize: 14 };
  if (text.includes("visit")) return { x: index % 2 ? 58 : 14, y: 58 + (index % 3) * 7, width: 34, height: 28, fontSize: 16 };
  return { x: 10 + (index % 3) * 26, y: 18 + (index % 5) * 10, width: 30, height: 28, fontSize: 14 };
}

export default function VisualEditingWorkstation({ stationLabel, route, filePath, repo, branch, content, onContentChange, onProof, onChat }: Props) {
  const sourceRoute = normalizeRoute(route);
  const defaultUrl = useMemo(() => deploymentUrl(repo, sourceRoute), [repo, sourceRoute]);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [browserUrl, setBrowserUrl] = useState(defaultUrl);
  const [frameKey, setFrameKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const editableItems = useMemo(() => extractEditableItems(content || "", filePath || "src/app/page.tsx"), [content, filePath]);
  const [selectedId, setSelectedId] = useState("");
  const selected = editableItems.find((item) => item.id === selectedId);
  const [style, setStyle] = useState<EditStyle>(defaultStyle(""));
  const ready = Boolean(repo && filePath);
  const liveUrl = browserUrl || defaultUrl;

  useEffect(() => {
    setBrowserUrl(defaultUrl);
    setSelectedId("");
    setStyle(defaultStyle(""));
    setFrameKey((value) => value + 1);
    setDrawerOpen(false);
    onProof(`Visual editor mounted actual frontend: ${repo || "no repo"}@${branch || "no branch"}:${sourceRoute}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, branch, sourceRoute, filePath, defaultUrl, content.length]);

  function selectItem(item: EditableItem, index = 0) {
    const position = overlayPosition(item, index);
    setSelectedId(item.id);
    setStyle({ ...defaultStyle(item.text), ...position, text: item.text });
    setViewMode("editor");
    onProof(`Selected on-screen editable text: ${item.text}`);
    onChat(`Selected ${item.label} in Visual Editor.`);
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
    const nextContent = original && replacement && content.includes(original) ? content.replace(original, replacement) : content;
    onContentChange(nextContent);
    onProof(`Saved visual edit patch for ${selected?.label || "selected text"}.`);
  }

  function refreshPreview() {
    setFrameKey((value) => value + 1);
    onProof(`Refreshed live preview: ${liveUrl}`);
  }

  function resetEditor() {
    setBrowserUrl(defaultUrl);
    setSelectedId("");
    setStyle(defaultStyle(""));
    setFrameKey((value) => value + 1);
    setDrawerOpen(false);
    onProof("Reset visual editor to source truth.");
  }

  return (
    <section className="visualEditor">
      <header className="top">
        <div><b>VISUAL EDITOR</b><span>{stationLabel} · click directly on the preview, edit in place</span></div>
        <div className="routeBar"><button type="button" onClick={refreshPreview}>↻</button><input value={liveUrl} onChange={(event) => setBrowserUrl(event.target.value)} /><button type="button" onClick={refreshPreview}>Open</button></div>
      </header>

      <main className={`canvas ${viewMode}`}>
        <section className={viewMode === "mobile" ? "phoneFrame" : "desktopFrame"}>
          {ready ? <iframe key={`${frameKey}-${liveUrl}-${viewMode}`} title="Actual frontend preview" src={liveUrl} /> : <div className="emptyFrame"><h2>Pull a source file first</h2><p>The actual frontend will appear here.</p></div>}
          {ready && viewMode === "editor" ? (
            <div className="editOverlay" aria-label="Clickable visual edit overlay">
              {editableItems.slice(0, 14).map((item, index) => {
                const pos = { ...defaultStyle(item.text), ...overlayPosition(item, index) };
                return <button key={item.id} type="button" aria-label={`Select ${item.label}: ${item.text}`} className="screenTarget" style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.width}%`, minHeight: `${pos.height}px`, borderRadius: `${pos.radius}px` }} onClick={() => selectItem(item, index)} />;
              })}
              {selected ? (
                <textarea
                  className="inPlaceEditor"
                  value={style.text}
                  onChange={(event) => updateStyle({ text: event.target.value })}
                  onBlur={savePatch}
                  autoFocus
                  style={{ left: `${style.x}%`, top: `${style.y}%`, width: `${style.width}%`, minHeight: `${style.height}px`, fontSize: `${style.fontSize}px`, color: style.color, background: style.background, borderRadius: `${style.radius}px`, opacity: style.opacity }}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      </main>

      <footer className="sourceActionStrip"><div><span>Route</span><b>{sourceRoute}</b></div><div><span>Selected</span><b>{selected?.label || "Click preview"}</b></div><div><span>File</span><b>{filePath || "no file"}</b></div><div><span>Branch</span><b>{branch || "no branch"}</b></div><div><span>Mode</span><b>{viewMode}</b></div><button type="button" className={viewMode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button><button type="button" className={viewMode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button><button type="button" className={viewMode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button><button type="button" className={viewMode === "advanced" ? "active" : ""} onClick={() => switchMode("advanced")}>Advanced</button><button type="button" onClick={savePatch} disabled={!selected}>Save</button><button type="button" onClick={resetEditor}>Reset</button></footer>

      <details className="editorDrawer" open={drawerOpen || viewMode === "advanced"} onToggle={(event) => setDrawerOpen(event.currentTarget.open)}><summary>Advanced style / source controls</summary><section className="drawerGrid"><label className="wide">Text<textarea value={style.text} onChange={(event) => updateStyle({ text: event.target.value })} /></label><label>Font size<input type="number" value={style.fontSize} onChange={(event) => updateStyle({ fontSize: Number(event.target.value) || 12 })} /></label><label>Text color<input type="color" value={style.color} onChange={(event) => updateStyle({ color: event.target.value })} /></label><label>Background<input value={style.background} onChange={(event) => updateStyle({ background: event.target.value })} /></label><label>Width<input type="number" value={style.width} onChange={(event) => updateStyle({ width: Number(event.target.value) || 40 })} /></label><label>Move X<input type="number" value={style.x} onChange={(event) => updateStyle({ x: Number(event.target.value) || 0 })} /></label><label>Move Y<input type="number" value={style.y} onChange={(event) => updateStyle({ y: Number(event.target.value) || 0 })} /></label><section className="patchBox"><b>Patch Preview</b><p>from: {selected?.text || "none"}</p><p>to: {style.text || "none"}</p><p>file: {filePath || "none"}</p></section></section></details>

      <style jsx>{`
        .visualEditor{width:100%;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;background:#020617;color:#fff;overflow:hidden}.top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(148,163,184,.18);background:#0f172a}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.routeBar{display:grid;grid-template-columns:40px minmax(260px,1fr) 80px;gap:8px;width:min(680px,56vw)}.routeBar input{height:38px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:#020617;color:#fff;padding:0 14px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;height:36px;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}button:disabled{opacity:.45;cursor:not-allowed}.canvas{position:relative;min-height:0;overflow:hidden;background:#020617}.desktopFrame{position:relative;height:calc(100% - 18px);margin:10px;border:1px solid rgba(124,58,237,.5);border-radius:16px;overflow:auto;background:#fff}.phoneFrame{position:relative;width:430px;height:min(760px,calc(100% - 30px));margin:12px auto;border:12px solid #111827;border-radius:36px;overflow:auto;background:#fff}.desktopFrame iframe,.phoneFrame iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff;pointer-events:auto}.canvas.editor iframe{pointer-events:none}.editOverlay{position:absolute;inset:0;z-index:5;pointer-events:auto}.screenTarget{position:absolute;border:1px solid transparent;background:transparent;color:transparent;padding:0;overflow:hidden}.screenTarget:hover{border:2px solid #f97316;box-shadow:0 0 0 1px rgba(249,115,22,.45),0 0 18px rgba(249,115,22,.24);background:rgba(249,115,22,.04)}.inPlaceEditor{position:absolute;z-index:8;resize:none;border:2px solid #f97316;outline:0;padding:0 8px;text-align:center;font-family:Georgia,serif;font-weight:900;line-height:1.05;text-shadow:0 2px 8px rgba(0,0,0,.7);overflow:hidden;box-shadow:0 0 0 1px rgba(249,115,22,.45),0 0 18px rgba(249,115,22,.24)}.emptyFrame{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.sourceActionStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(6,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.sourceActionStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.sourceActionStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.sourceActionStrip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.editorDrawer{max-height:300px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617}.editorDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px}.drawerGrid label,.patchBox{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.drawerGrid input,.drawerGrid textarea{width:100%;margin-top:6px;border:1px solid rgba(148,163,184,.2);border-radius:8px;background:#020617;color:#fff;padding:8px;box-sizing:border-box}.wide{grid-column:span 2}.patchBox p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}
      `}</style>
    </section>
  );
}
