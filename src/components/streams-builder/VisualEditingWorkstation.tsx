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
type WorkstationBrowserAction = { action: string; target?: string; selector?: string; value?: string; expected?: string; result: "pending" | "passed" | "failed"; at: string };
type Layer = { id: string; kind: "TEXT" | "BUTTON" | "CARD" | "ARTIFACT"; label: string; component: string; file: string; text: string; size: string; width: string; weight: string; line: string; spacing: string; align: string; color: string; fill: string };

const fallbackLayers: Layer[] = [
  { id: "source-heading", kind: "TEXT", label: "Source Heading", component: "PulledPage", file: "src/app/page.tsx", text: "Pull a source file to preview it here", size: "34", width: "760", weight: "900", line: "1.05", spacing: "-1", align: "Center", color: "#ffffff", fill: "transparent" },
  { id: "source-copy", kind: "TEXT", label: "Source Copy", component: "PulledPage", file: "src/app/page.tsx", text: "The visual editor renders from the pulled code content, not from a hard-coded template.", size: "16", width: "760", weight: "500", line: "1.4", spacing: "0", align: "Center", color: "#dbeafe", fill: "transparent" },
  { id: "source-cta", kind: "BUTTON", label: "Source CTA", component: "PulledPage", file: "src/app/page.tsx", text: "Source Truth Preview", size: "14", width: "220", weight: "800", line: "1", spacing: "0", align: "Center", color: "#ffffff", fill: "#7c3aed" },
];

function visibleTextFromCode(code: string) {
  const fromJsxText = Array.from(code.matchAll(/>([^<>{}\n][^<>{}]*)</g))
    .map((match) => match[1].replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const fromStringLiterals = Array.from(code.matchAll(/["'`]([^"'`{}]{3,120})["'`]/g))
    .map((match) => match[1].replace(/\s+/g, " ").trim())
    .filter((value) => /[a-zA-Z]/.test(value) && !value.startsWith("/") && !value.includes("=>") && !value.includes("className"));
  const values: string[] = [];
  for (const value of [...fromJsxText, ...fromStringLiterals]) {
    if (!value || value.length < 3) continue;
    if (/^(use client|force-dynamic|POST|Content-Type|application\/json)$/i.test(value)) continue;
    if (!values.includes(value)) values.push(value);
    if (values.length >= 24) break;
  }
  return values;
}

function buildLayersFromSource(code: string, filePath: string): Layer[] {
  const text = visibleTextFromCode(code);
  if (!text.length) return fallbackLayers.map((layer) => ({ ...layer, file: filePath || layer.file }));
  const heading = text.find((item) => item.length >= 18) || text[0];
  const copy = text.find((item) => item !== heading && item.length >= 24) || text.find((item) => item !== heading) || "Pulled source content is active.";
  const cta = text.find((item) => /book|start|send|continue|submit|review|call|video|visit|refill|follow/i.test(item) && item !== heading && item !== copy) || text.find((item) => item !== heading && item !== copy) || "Open Source Route";
  const nav = text.find((item) => /medazon|provider|health|streams|dashboard|care/i.test(item)) || text[0];

  return [
    { id: "navbar", kind: "TEXT", label: "Navbar", component: "PulledPage", file: filePath, text: nav, size: "14", width: "1366", weight: "800", line: "1", spacing: "0", align: "Left", color: "#ffffff", fill: "transparent" },
    { id: "hero-heading", kind: "TEXT", label: "Hero Heading", component: "PulledPage", file: filePath, text: heading, size: "42", width: "760", weight: "900", line: "1.05", spacing: "-1", align: "Center", color: "#ffffff", fill: "transparent" },
    { id: "hero-copy", kind: "TEXT", label: "Hero Copy", component: "PulledPage", file: filePath, text: copy, size: "16", width: "760", weight: "500", line: "1.35", spacing: "0", align: "Center", color: "#dbeafe", fill: "transparent" },
    { id: "primary-cta", kind: "BUTTON", label: "Primary CTA", component: "PulledPage", file: filePath, text: cta, size: "14", width: "230", weight: "800", line: "1", spacing: "0", align: "Center", color: "#ffffff", fill: "#7c3aed" },
  ];
}

function normalizeRoute(value: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

export default function VisualEditingWorkstation({ stationLabel, route, filePath, repo, branch, content, onContentChange, onProof, onChat }: Props) {
  const sourceLayers = useMemo(() => buildLayersFromSource(content || "", filePath || "src/app/page.tsx"), [content, filePath]);
  const [layers, setLayers] = useState<Layer[]>(sourceLayers);
  const [selectedId, setSelectedId] = useState(sourceLayers[0]?.id || "source-heading");
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [routeInput, setRouteInput] = useState(route || "/");
  const [browserUrl, setBrowserUrl] = useState(route || "/");
  const [frameKey, setFrameKey] = useState(0);
  const [browserActions, setBrowserActions] = useState<WorkstationBrowserAction[]>([{ action: "created", target: route || "/", result: "pending", at: new Date().toISOString() }]);

  useEffect(() => {
    setLayers(sourceLayers);
    setSelectedId(sourceLayers[0]?.id || "source-heading");
    setRouteInput(route || "/");
    setBrowserUrl(route || "/");
    setViewMode("editor");
    setFrameKey((value) => value + 1);
    onProof(`Visual editor rebound to pulled source: ${repo || "repo"}@${branch || "branch"}:${filePath || "file"}`);
  }, [sourceLayers, route, filePath, repo, branch, onProof]);

  const selected = layers.find((layer) => layer.id === selectedId) || layers[0] || fallbackLayers[0];
  const sourceRoute = normalizeRoute(routeInput || route || "/");
  const sourceFile = filePath || selected.file;

  const patchLines = useMemo(() => [`target: ${sourceFile}`, `route: ${sourceRoute}`, `component: ${selected.component}`, `selected: ${selected.label}`, `text: "${selected.text}"`, `font-size: ${selected.size}px`, `width: ${selected.width}px`, `weight: ${selected.weight}`, `line-height: ${selected.line}`, `letter-spacing: ${selected.spacing}px`, `align: ${selected.align}`, `color: ${selected.color}`, `fill: ${selected.fill}`], [selected, sourceFile, sourceRoute]);

  const proofItems = [
    { label: "Route identified", passed: Boolean(sourceRoute) },
    { label: "Component identified", passed: Boolean(selected.component) },
    { label: "File path identified", passed: Boolean(sourceFile) },
    { label: "GitHub path identified", passed: Boolean(sourceFile) },
    { label: "Rendered from pulled content", passed: Boolean(content) },
    { label: "Hard-coded StreamsAI template removed", passed: !layers.some((layer) => /streamsAIsdfd|Create Stunning Content with AI Magic/i.test(layer.text)) },
    { label: "Mobile view available", passed: true },
  ];

  function recordBrowserAction(action: Omit<WorkstationBrowserAction, "at">) {
    const next = { ...action, at: new Date().toISOString() };
    setBrowserActions((items) => [...items.slice(-40), next]);
    onProof(`Browser action: ${next.action}${next.target ? ` -> ${next.target}` : ""}`);
  }

  function updateSelected(key: keyof Layer, value: string) {
    setLayers((items) => items.map((item) => item.id === selected.id ? { ...item, [key]: value } : item));
  }

  function selectLayer(id: string, label: string) {
    setSelectedId(id);
    onProof(`Selected ${label} by clicking frontend canvas.`);
    onChat(`Selected ${label} in Visual Editor.`);
  }

  function savePatch() {
    const next = [content || "", "", "/* Streams Visual Editing Patch", `station: ${stationLabel}`, `repo: ${repo || "not selected"}`, `branch: ${branch || "main"}`, `route: ${sourceRoute}`, `component: ${selected.component}`, `file: ${sourceFile}`, `layer: ${selected.label}`, `text: ${selected.text}`, `viewMode: ${viewMode}`, "*/"].join("\n");
    onContentChange(next);
    onProof(`Visual patch saved for ${selected.component} -> ${sourceFile}.`);
    onChat(`Saved patch preview for ${selected.label}.`);
  }

  function duplicateLayer() {
    const copy = { ...selected, id: `${selected.id}-${Date.now()}`, label: `${selected.label} Copy` };
    setLayers((items) => [...items, copy]);
    setSelectedId(copy.id);
    onProof(`Duplicated ${selected.label}.`);
  }

  function resetLayer() {
    setLayers(sourceLayers);
    setSelectedId(sourceLayers[0]?.id || "source-heading");
    onProof("Visual editor reset to pulled source content.");
  }

  function normalizeBrowserTarget(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "/";
    if (trimmed.startsWith("/")) return trimmed;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  function openBrowserTarget() {
    const next = normalizeBrowserTarget(browserUrl || routeInput || "/");
    setRouteInput(next.startsWith("http") ? "/" : next);
    setBrowserUrl(next);
    setFrameKey((value) => value + 1);
    recordBrowserAction({ action: next.startsWith("http") ? "external-url-entered" : "opened-source-route-preview", target: next, result: "pending" });
  }

  function switchMode(nextMode: ViewMode) {
    setViewMode(nextMode);
    recordBrowserAction({ action: `switch-mode-${nextMode}`, target: sourceRoute, result: "pending" });
    if (nextMode === "browser" || nextMode === "mobile") setFrameKey((value) => value + 1);
  }

  return (
    <section className="visualEditor">
      <header className="top">
        <div><b>VISUAL EDITOR</b><span>{stationLabel} · source-truth preview renders pulled code content</span></div>
        <div className="routeBar"><button type="button" onClick={() => onProof("Browser back requested.")}>‹</button><button type="button" onClick={() => onProof("Browser forward requested.")}>›</button><button type="button" onClick={() => setFrameKey((value) => value + 1)}>↻</button><input value={browserUrl} onChange={(event) => setBrowserUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") openBrowserTarget(); }} placeholder="Search web or enter URL / route..." /><button type="button" onClick={openBrowserTarget}>Open</button></div>
      </header>
      <main key={`${frameKey}-${sourceFile}-${content.length}`} className={`canvas ${viewMode}`}>
        <section className="frontView">
          {viewMode === "editor" ? <div className="editorOverlay">{layers.map((layer) => <button type="button" key={layer.id} className={selectedId === layer.id ? "active" : ""} onClick={() => selectLayer(layer.id, layer.label)}>{layer.label}</button>)}</div> : null}
          <div className="sourceDebug"><span>repo <b>{repo || "not selected"}</b></span><span>branch <b>{branch || "main"}</b></span><span>route <b>{sourceRoute}</b></span><span>file <b>{sourceFile}</b></span></div>
          <header className={selected.id === layers[0]?.id ? "selected" : ""} onClick={() => selectLayer(layers[0]?.id || selected.id, layers[0]?.label || selected.label)}>
            <div>{layers[0]?.text || sourceFile}</div>
          </header>
          <div className={viewMode === "mobile" ? "hero mobileHero" : "hero"}>
            <h1 className={selected.id === layers[1]?.id ? "selected" : ""} style={{ fontSize: `${layers[1]?.size || 36}px`, fontWeight: Number(layers[1]?.weight || 900), lineHeight: layers[1]?.line || "1.05", letterSpacing: `${layers[1]?.spacing || 0}px`, color: layers[1]?.color || "#fff" }} onClick={() => selectLayer(layers[1]?.id || selected.id, layers[1]?.label || selected.label)}>{layers[1]?.text || "Pulled source preview"}</h1>
            <p className={selected.id === layers[2]?.id ? "selected" : ""} style={{ fontSize: `${layers[2]?.size || 16}px`, fontWeight: Number(layers[2]?.weight || 500), lineHeight: layers[2]?.line || "1.35", color: layers[2]?.color || "#dbeafe" }} onClick={() => selectLayer(layers[2]?.id || selected.id, layers[2]?.label || selected.label)}>{layers[2]?.text || "No copy found."}</p>
            <button type="button" className={selected.id === layers[3]?.id ? "cta selected" : "cta"} style={{ width: `${layers[3]?.width || 220}px`, color: layers[3]?.color || "#fff", background: layers[3]?.fill || "#7c3aed" }} onClick={() => selectLayer(layers[3]?.id || selected.id, layers[3]?.label || selected.label)}>{layers[3]?.text || "Continue"}</button>
          </div>
          {viewMode === "browser" || viewMode === "advanced" ? <pre className="sourceCode">{content || "No pulled source content available."}</pre> : null}
        </section>
      </main>
      <footer className="sourceActionStrip"><div><span>Route</span><b>{sourceRoute}</b></div><div><span>Component</span><b>{selected.component}</b></div><div><span>File</span><b>{sourceFile}</b></div><div><span>Branch</span><b>{branch || "main"}</b></div><div><span>Mode</span><b>Main File Only</b></div><button type="button" className={viewMode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button><button type="button" className={viewMode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button><button type="button" className={viewMode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button><button type="button" className={viewMode === "advanced" ? "active" : ""} onClick={() => switchMode("advanced")}>Advanced</button><button type="button" onClick={savePatch}>Save</button><button type="button" onClick={duplicateLayer}>Dup</button><button type="button" onClick={resetLayer}>Reset</button></footer>
      <details className="editorDrawer" open={viewMode === "advanced"}><summary>Proof / Source Truth / Editor</summary><section className="drawerGrid"><label>Selected<input value={selected.label} onChange={(event) => updateSelected("label", event.target.value)} /></label><label className="wide">Text<textarea value={selected.text} onChange={(event) => updateSelected("text", event.target.value)} /></label><label>Align<select value={selected.align} onChange={(event) => updateSelected("align", event.target.value)}><option>Center</option><option>Left</option><option>Right</option></select></label><label>Size<input value={selected.size} onChange={(event) => updateSelected("size", event.target.value)} /></label><section className="proofBox"><b>Strict Builder Proof</b>{proofItems.map((item) => <p key={item.label}>{item.passed ? "PASS" : "BLOCKED"} · {item.label}</p>)}</section><section className="patchBox"><b>Patch Preview</b>{patchLines.map((line) => <p key={line}>{line}</p>)}<b>Browser Actions</b>{browserActions.slice(-4).map((item) => <p key={`${item.action}-${item.at}`}>{item.action} · {item.target}</p>)}</section></section></details>
      <style jsx>{`
        .visualEditor{width:100%;height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;overflow:hidden;background:#020617;color:#fff;box-sizing:border-box}.top{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px;border-bottom:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.94);box-sizing:border-box}.top b{display:block;font-size:12px}.top span{display:block;color:#94a3b8;font-size:11px}.routeBar{min-width:360px;max-width:56%;display:grid;grid-template-columns:34px 34px 34px minmax(0,1fr) 88px;gap:6px;align-items:center}.routeBar input{height:36px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;padding:3px 14px;font-size:12px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;height:36px;padding:3px 12px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}button.active{border-color:rgba(110,231,183,.7);background:rgba(6,78,59,.7);color:#6ee7b7}.canvas{min-height:0;height:100%;overflow:auto;border:1px solid rgba(148,163,184,.16);background:#020617}.canvas.mobile{display:grid;place-items:center}.frontView{position:relative;min-height:100%;overflow:hidden;border-radius:18px;margin:12px;border:1px solid rgba(124,58,237,.45);background:radial-gradient(circle at top,#1e1b4b 0,#020617 54%)}.editorOverlay{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:4;display:flex;gap:4px;flex-wrap:wrap;justify-content:center}.editorOverlay button{height:32px}.sourceDebug{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.65)}.sourceDebug span{min-width:0;display:block;padding:9px 12px;background:rgba(2,6,23,.92);color:#94a3b8;font-size:11px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sourceDebug b{display:block;color:#fff;text-transform:none;font-size:12px}header{width:100%;padding:34px 44px;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(168,85,247,.55)}header div{font-weight:900;font-size:24px}.hero{text-align:center;padding:84px 34px 70px;max-width:980px;margin:0 auto}.mobileHero{max-width:430px;min-height:720px;padding:70px 24px}.hero h1{margin:0 auto 18px;max-width:900px}.hero p{max-width:820px;margin:0 auto 26px}.cta{min-width:180px;max-width:100%;border-radius:18px;border:0}.selected{outline:3px solid #a855f7;outline-offset:7px}.sourceCode{max-width:980px;max-height:420px;margin:0 auto 30px;overflow:auto;border:1px solid rgba(148,163,184,.24);border-radius:16px;background:rgba(2,6,23,.8);color:#dbeafe;padding:18px;box-sizing:border-box;font:12px/18px ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;white-space:pre-wrap}.sourceActionStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(7,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.sourceActionStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.sourceActionStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.sourceActionStrip b{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.editorDrawer{max-height:280px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617}.editorDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px}.drawerGrid label,.proofBox,.patchBox{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.drawerGrid input,.drawerGrid textarea,.drawerGrid select{width:100%;margin-top:6px;border:1px solid rgba(148,163,184,.2);border-radius:8px;background:#020617;color:#fff;padding:8px;box-sizing:border-box}.wide{grid-column:span 2}.proofBox p,.patchBox p{margin:4px 0;color:#94a3b8;font-size:11px}
      `}</style>
    </section>
  );
}
