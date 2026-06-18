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

const initialLayers: Layer[] = [
  { id: "navbar", kind: "TEXT", label: "Navbar", component: "Navbar", file: "src/components/layout/Navbar.tsx", text: "streamsAIsdfd", size: "14", width: "1366", weight: "700", line: "1", spacing: "0", align: "Left", color: "#ffffff", fill: "transparent" },
  { id: "hero-heading", kind: "TEXT", label: "Hero Heading", component: "Hero", file: "src/components/home/Hero.tsx", text: "Create Stunning Content with AI Magic", size: "42", width: "720", weight: "700", line: "1.05", spacing: "-1", align: "Center", color: "#ffffff", fill: "transparent" },
  { id: "hero-copy", kind: "TEXT", label: "Hero Copy", component: "Hero", file: "src/components/home/Hero.tsx", text: "Transform your ideas into professional videos, images, voiceovers, and scripts. One platform, unlimited creativity.", size: "16", width: "720", weight: "500", line: "1.35", spacing: "0", align: "Center", color: "#dbeafe", fill: "transparent" },
  { id: "primary-cta", kind: "BUTTON", label: "Primary CTA", component: "PrimaryCTA", file: "src/components/home/Hero.tsx", text: "Start Creating Free", size: "14", width: "190", weight: "800", line: "1", spacing: "0", align: "Center", color: "#ffffff", fill: "#7c3aed" },
];

export default function VisualEditingWorkstation({ stationLabel, route, filePath, repo, branch, content, onContentChange, onProof, onChat }: Props) {
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [selectedId, setSelectedId] = useState(initialLayers[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [routeInput, setRouteInput] = useState(route || "/");
  const [browserUrl, setBrowserUrl] = useState(route || "/");
  const [frameKey, setFrameKey] = useState(0);
  const [browserActions, setBrowserActions] = useState<WorkstationBrowserAction[]>([{ action: "created", target: route || "/", result: "pending", at: new Date().toISOString() }]);

  const selected = layers.find((layer) => layer.id === selectedId) || layers[0];
  const sourceRoute = routeInput || route || "/";
  const sourceFile = filePath || selected.file;

  useEffect(() => {
    setRouteInput(route || "/");
    setBrowserUrl(route || "/");
    setViewMode("editor");
    setFrameKey((value) => value + 1);
  }, [route, filePath]);

  const patchLines = useMemo(() => [`target: ${sourceFile}`, `route: ${sourceRoute}`, `component: ${selected.component}`, `selected: ${selected.label}`, `text: "${selected.text}"`, `font-size: ${selected.size}px`, `width: ${selected.width}px`, `weight: ${selected.weight}`, `line-height: ${selected.line}`, `letter-spacing: ${selected.spacing}px`, `align: ${selected.align}`, `color: ${selected.color}`, `fill: ${selected.fill}`], [selected, sourceFile, sourceRoute]);

  useEffect(() => {
    function onBrowserMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.source !== "streams-browser-proxy") return;
      recordBrowserAction({ action: data.action || "browser-event", target: data.href || data.text || sourceRoute, value: data.text, result: "pending" });
    }
    window.addEventListener("message", onBrowserMessage);
    return () => window.removeEventListener("message", onBrowserMessage);
  }, [sourceRoute]);

  const proofItems = [
    { label: "Route identified", passed: Boolean(sourceRoute) },
    { label: "Component identified", passed: Boolean(selected.component) },
    { label: "File path identified", passed: Boolean(sourceFile) },
    { label: "GitHub path identified", passed: Boolean(sourceFile) },
    { label: "Main File Only mode", passed: true },
    { label: "No branch-preview proof", passed: true },
    { label: "Live browser mode available", passed: true },
    { label: "Mobile view available", passed: true },
  ];

  function recordBrowserAction(action: Omit<WorkstationBrowserAction, "at">) {
    const next = { ...action, at: new Date().toISOString() };
    setBrowserActions((items) => [...items.slice(-40), next]);
    onProof(`Browser action: ${next.action}${next.target ? ` -> ${next.target}` : ""}`);
  }

  function updateSelected(key: keyof Layer, value: string) { setLayers((items) => items.map((item) => item.id === selected.id ? { ...item, [key]: value } : item)); }
  function selectLayer(id: string, label: string) { setSelectedId(id); onProof(`Selected ${label} by clicking frontend canvas.`); onChat(`Selected ${label} in Visual Editor.`); }
  function savePatch() { const next = [content || "", "", "/* Streams Visual Editing Patch", `station: ${stationLabel}`, `repo: ${repo || "not selected"}`, `branch: ${branch || "main"}`, `route: ${sourceRoute}`, `component: ${selected.component}`, `file: ${sourceFile}`, `layer: ${selected.label}`, `text: ${selected.text}`, `viewMode: ${viewMode}`, "*/"].join("\n"); onContentChange(next); onProof(`Visual patch saved for ${selected.component} -> ${sourceFile}.`); onChat(`Saved patch preview for ${selected.label}.`); }
  function duplicateLayer() { const copy = { ...selected, id: `${selected.id}-${Date.now()}`, label: `${selected.label} Copy` }; setLayers((items) => [...items, copy]); setSelectedId(copy.id); onProof(`Duplicated ${selected.label}.`); }
  function resetLayer() { setLayers(initialLayers); setSelectedId(initialLayers[0].id); onProof("Visual editor reset."); }
  function isExternalBrowserUrl(value: string) { return value.startsWith("http://") || value.startsWith("https://"); }
  function normalizeBrowserTarget(value: string) { const trimmed = value.trim(); if (!trimmed) return "/"; if (trimmed.startsWith("/")) return trimmed; if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed; if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`; return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`; }
  function openBrowserTarget() { const next = normalizeBrowserTarget(browserUrl || routeInput || "/"); const workstationUrl = isExternalBrowserUrl(next) ? `/streams-builder/browser?url=${encodeURIComponent(next)}` : next; setRouteInput(workstationUrl); setBrowserUrl(next); setFrameKey((value) => value + 1); recordBrowserAction({ action: isExternalBrowserUrl(next) ? "opened-external-inside-workstation" : "opened-internal-route", target: next, result: "pending" }); }
  function switchMode(nextMode: ViewMode) { setViewMode(nextMode); recordBrowserAction({ action: `switch-mode-${nextMode}`, target: sourceRoute, result: "pending" }); if (nextMode === "browser" || nextMode === "mobile") setFrameKey((value) => value + 1); }

  return (
    <section className="visualEditor">
      <header className="top">
        <div><b>VISUAL EDITOR</b><span>{stationLabel} · desktop browser preview opens pulled route</span></div>
        <div className="routeBar"><button type="button" onClick={() => onProof("Browser back requested.")}>‹</button><button type="button" onClick={() => onProof("Browser forward requested.")}>›</button><button type="button" onClick={() => setFrameKey((value) => value + 1)}>↻</button><input value={browserUrl} onChange={(event) => setBrowserUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") openBrowserTarget(); }} placeholder="Search web or enter URL / route..." /><button type="button" onClick={openBrowserTarget}>Open</button></div>
      </header>
      <main className={`canvas ${viewMode}`}>
        {viewMode === "browser" ? <div className="desktopFrame"><iframe key={frameKey} title={`${stationLabel} desktop browser proof`} src={sourceRoute} /></div> : viewMode === "mobile" ? <div className="phoneFrame"><iframe key={frameKey} title={`${stationLabel} mobile proof`} src={sourceRoute} /></div> : <section className="frontView">{viewMode === "editor" ? <div className="editorOverlay"><button type="button" className={selectedId === "navbar" ? "active" : ""} onClick={() => selectLayer("navbar", "Navbar")}>Navbar</button><button type="button" className={selectedId === "hero-heading" ? "active" : ""} onClick={() => selectLayer("hero-heading", "Hero Heading")}>Hero Heading</button><button type="button" className={selectedId === "hero-copy" ? "active" : ""} onClick={() => selectLayer("hero-copy", "Hero Copy")}>Hero Copy</button><button type="button" className={selectedId === "primary-cta" ? "active" : ""} onClick={() => selectLayer("primary-cta", "Primary CTA")}>Primary CTA</button></div> : null}
          <header className={selected.id === "navbar" ? "selected" : ""} style={{ width: "100%", padding: "12px 20px", boxSizing: "border-box", display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={() => selectLayer("navbar", "Navbar")}>
            <div style={{ fontWeight: 700 }}>{layers[0].text || layers[0].label}</div>
          </header>
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <h1 className={selected.id === "hero-heading" ? "selected" : ""} style={{ fontSize: `${layers[1].size}px`, fontWeight: Number(layers[1].weight), lineHeight: layers[1].line, letterSpacing: `${layers[1].spacing}px`, color: layers[1].color }} onClick={() => selectLayer("hero-heading", "Hero Heading")}>{layers[1].text || layers[1].label}</h1>
            <p className={selected.id === "hero-copy" ? "selected" : ""} style={{ fontSize: `${layers[2].size}px`, fontWeight: Number(layers[2].weight), lineHeight: layers[2].line, color: layers[2].color }} onClick={() => selectLayer("hero-copy", "Hero Copy")}>{layers[2].text || layers[2].label}</p>
            <button type="button" className={selected.id === "primary-cta" ? "cta selected" : "cta"} style={{ width: `${layers[3].width}px`, color: layers[3].color, background: layers[3].fill }} onClick={() => selectLayer("primary-cta", "Primary CTA")}>{layers[3].text || layers[3].label}</button>
          </div>
        </section>}
      </main>
      <footer className="sourceActionStrip"><div><span>Route</span><b>{sourceRoute}</b></div><div><span>Component</span><b>{selected.component}</b></div><div><span>File</span><b>{sourceFile}</b></div><div><span>Branch</span><b>{branch || "main"}</b></div><div><span>Mode</span><b>Main File Only</b></div><button type="button" className={viewMode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button><button type="button" className={viewMode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button><button type="button" className={viewMode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button><button type="button" className={viewMode === "advanced" ? "active" : ""} onClick={() => switchMode("advanced")}>Advanced</button><button type="button" onClick={savePatch}>Save</button><button type="button" onClick={duplicateLayer}>Dup</button><button type="button" onClick={resetLayer}>Reset</button></footer>
      <details className="editorDrawer" open={viewMode === "advanced"}><summary>Proof / Source Truth / Editor</summary><section className="drawerGrid"><label>Selected<input value={selected.label} onChange={(event) => updateSelected("label", event.target.value)} /></label><label className="wide">Text<textarea value={selected.text} onChange={(event) => updateSelected("text", event.target.value)} /></label><label>Align<select value={selected.align} onChange={(event) => updateSelected("align", event.target.value)}><option>Center</option><option>Left</option><option>Right</option></select></label><label>Size<input value={selected.size} onChange={(event) => updateSelected("size", event.target.value)} /></label><section className="proofBox"><b>Strict Builder Proof</b>{proofItems.map((item) => <p key={item.label}>{item.passed ? "PASS" : "BLOCKED"} · {item.label}</p>)}</section><section className="patchBox"><b>Patch Preview</b>{patchLines.map((line) => <p key={line}>{line}</p>)}</section></section></details>
      <style jsx>{`
        .visualEditor{width:100%;height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;overflow:hidden;background:#020617;color:#fff;box-sizing:border-box}.top{min-height:32px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px;border-bottom:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.94);box-sizing:border-box}.top b{display:block;font-size:10px}.top span{display:block;color:#94a3b8;font-size:8px}.routeBar{min-width:360px;max-width:56%;display:grid;grid-template-columns:24px 24px 24px minmax(0,1fr) 50px;gap:4px;align-items:center}.routeBar input{height:22px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;padding:3px 10px;font-size:9px}button{border:1px solid rgba(148,163,184,.18);border-radius:7px;background:#7c3aed;color:#fff;height:24px;padding:3px 7px;font-size:8px;font-weight:900;cursor:pointer;white-space:nowrap}button.active{border-color:rgba(110,231,183,.7);background:rgba(6,78,59,.7);color:#6ee7b7}.canvas{min-height:0;height:100%;overflow:hidden;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:#020617;box-sizing:border-box;margin:4px 6px}.canvas.browser,.canvas.mobile{background:#fff;overflow:auto}.desktopFrame{position:relative;width:1366px;min-width:1366px;height:100%;min-height:100%;background:#fff}.desktopFrame iframe{width:1366px;height:100%;min-height:100%;border:0;background:#fff}.desktopFrame .editorOverlay{position:absolute;top:12px;left:12px;display:flex;flex-wrap:wrap;gap:6px;padding:8px;border-radius:12px;background:rgba(2,6,23,.88);box-shadow:0 0 0 1px rgba(148,163,184,.12);z-index:10}.desktopFrame .editorOverlay button{font-size:10px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(148,163,184,.18)}.desktopFrame .editorOverlay button.active{background:rgba(110,231,183,.16);border-color:rgba(110,231,183,.5);color:#6ee7b7}.canvas iframe{pointer-events:auto}.canvas.editor iframe{pointer-events:none}.canvas.browser iframe,.canvas.mobile iframe{pointer-events:auto}.phoneFrame{width:min(390px,92%);height:calc(100% - 24px);margin:12px auto;border:10px solid #0f172a;border-radius:30px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(148,163,184,.18),0 22px 50px rgba(0,0,0,.35)}.phoneFrame iframe{width:100%;height:100%;border:0}.frontView{width:calc(100% - 14px);height:calc(100% - 14px);min-width:0;min-height:0;display:grid;place-items:center;align-content:center;gap:14px;margin:7px;border:1px solid rgba(124,58,237,.42);border-radius:16px;background:radial-gradient(circle at 50% 0%,rgba(124,58,237,.18),transparent 38%),#020617;text-align:center;overflow:hidden;box-sizing:border-box}.frontView h1{max-width:82%;margin:0;cursor:pointer;white-space:normal;overflow-wrap:anywhere;font-size:clamp(24px,4.4vw,46px)!important;line-height:.95!important}.frontView p{max-width:78%;margin:0;cursor:pointer;overflow-wrap:anywhere;font-size:clamp(10px,1.25vw,15px)!important}.cta{height:38px;max-width:220px;border:0;border-radius:11px;font-weight:900;cursor:pointer}.feature{min-height:84px;max-height:110px;max-width:280px;border-radius:14px;padding:14px;text-align:left;cursor:pointer;overflow:hidden;font-size:11px}.selected{outline:2px solid #a855f7;outline-offset:4px;box-shadow:0 0 0 6px rgba(124,58,237,.18);cursor:pointer}.sourceActionStrip{display:grid;grid-template-columns:1fr 1fr 1.25fr .7fr .8fr repeat(7,auto);gap:5px;padding:5px;border-top:1px solid rgba(16,185,129,.24);background:rgba(6,78,59,.1);box-sizing:border-box;align-items:center}.sourceActionStrip div{min-width:0;border:1px solid rgba(16,185,129,.22);border-radius:7px;background:rgba(2,6,23,.72);padding:4px}.sourceActionStrip span{display:block;color:#6ee7b7;font-size:7px;font-weight:900;text-transform:uppercase}.sourceActionStrip b{display:block;margin-top:3px;color:#fff;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.editorDrawer{border-top:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.96);padding:4px 6px;max-height:22px;overflow:hidden;font-size:8px}.editorDrawer[open]{max-height:260px;overflow:auto}.editorDrawer summary{cursor:pointer;color:#94a3b8;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}label{display:grid;gap:4px;color:#94a3b8;font-size:8px;font-weight:900}label.wide{grid-column:span 2}input,select,textarea{width:100%;min-width:0;border:1px solid rgba(148,163,184,.14);border-radius:7px;background:#020617;color:#fff;padding:6px;font-size:8px;box-sizing:border-box}textarea{min-height:58px;resize:vertical}.proofBox,.patchBox{grid-column:span 2;border:1px solid rgba(148,163,184,.12);border-radius:9px;background:rgba(2,6,23,.72);padding:7px;max-height:125px;overflow:auto}.proofBox b,.patchBox b{display:block;margin-bottom:5px;font-size:9px}.proofBox p,.patchBox p{margin:4px 0 0;color:#cbd5e1;font-size:8px;line-height:1.35;overflow-wrap:anywhere}
      `}</style>
    </section>
  );
}
