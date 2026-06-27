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
type EditableItem = { id: string; label: string; file: string; text: string };

type EditorDraft = {
  brand: string;
  hero: string;
  provider: string;
  subtitle: string;
  badge: string;
  section: string;
  leftTitle: string;
  rightTitle: string;
  leftButton: string;
  rightButton: string;
};

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
  if (lower.includes("medazon")) return "Brand text";
  if (lower.includes("instant") || lower.includes("medical")) return "Hero heading";
  if (lower.includes("healthcare")) return "Section heading";
  if (lower.includes("lamonica") || lower.includes("provider") || lower.includes("nurse")) return "Provider text";
  if (lower.includes("private") || lower.includes("personal")) return "Badge text";
  if (lower.includes("live") || lower.includes("phone")) return "Visit card title";
  if (lower.includes("start") || lower.includes("schedule")) return "Button text";
  return index === 0 ? "Visible text" : `Visible text ${index + 1}`;
}

function extractEditableItems(content: string, filePath: string): EditableItem[] {
  const literalMatches = Array.from(content.matchAll(/(?:aria-label|title|placeholder|alt|children)?\s*=?\s*["'`]([^"'`{}<>]{2,140})["'`]/g)).map((m) => cleanText(m[1]));
  const jsxTextMatches = Array.from(content.matchAll(/>([^<>{}\n][^<>{}]*)</g)).map((m) => cleanText(m[1]));
  return Array.from(new Set([...jsxTextMatches, ...literalMatches])).filter(isUiText).slice(0, 50).map((text, index) => ({ id: `item-${index}`, label: labelForText(text, index), file: filePath, text }));
}

function findText(items: EditableItem[], patterns: RegExp[], fallback: string) {
  return items.find((item) => patterns.some((pattern) => pattern.test(item.text)))?.text || fallback;
}

function draftFromItems(items: EditableItem[]): EditorDraft {
  return {
    brand: findText(items, [/medazon/i], "MedazonHealth"),
    hero: findText(items, [/instant/i, /private medical/i], "Instant Private Medical Visits"),
    provider: findText(items, [/lamonica/i, /hodges/i], "LaMonica A. Hodges, MSN, APRN, FNP-C"),
    subtitle: findText(items, [/board/i, /family nurse/i], "Board-Certified Family Nurse Practitioner"),
    badge: findText(items, [/private care/i, /personal attention/i], "Private Care. Personal Attention."),
    section: findText(items, [/healthcare/i, /personal again/i], "Healthcare That Feels Personal Again"),
    leftTitle: findText(items, [/live video/i], "Live Video Visit"),
    rightTitle: findText(items, [/phone visit/i], "Phone Visit"),
    leftButton: findText(items, [/start my visit/i, /start/i], "Start My Visit →"),
    rightButton: findText(items, [/schedule my call/i, /schedule/i], "Schedule My Call →"),
  };
}

function replaceFirst(content: string, from: string, to: string) {
  if (!from || from === to || !content.includes(from)) return content;
  return content.replace(from, to);
}

export default function VisualEditingWorkstation({ stationLabel, route, filePath, repo, branch, content, onContentChange, onProof, onChat }: Props) {
  const sourceRoute = normalizeRoute(route);
  const defaultUrl = useMemo(() => deploymentUrl(repo, sourceRoute), [repo, sourceRoute]);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [browserUrl, setBrowserUrl] = useState(defaultUrl);
  const [frameKey, setFrameKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const editableItems = useMemo(() => extractEditableItems(content || "", filePath || "src/app/page.tsx"), [content, filePath]);
  const [draft, setDraft] = useState<EditorDraft>(() => draftFromItems(editableItems));
  const [selectedKey, setSelectedKey] = useState<keyof EditorDraft | "">("");
  const ready = Boolean(repo && filePath);
  const liveUrl = browserUrl || defaultUrl;

  useEffect(() => {
    setBrowserUrl(defaultUrl);
    setDraft(draftFromItems(editableItems));
    setSelectedKey("");
    setFrameKey((value) => value + 1);
    setDrawerOpen(false);
    onProof(`Visual editor mounted without iframe in editor mode: ${repo || "no repo"}@${branch || "no branch"}:${sourceRoute}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, branch, sourceRoute, filePath, defaultUrl, content.length]);

  function switchMode(nextMode: ViewMode) {
    setViewMode(nextMode);
    if (nextMode === "advanced") setDrawerOpen(true);
    if (nextMode === "mobile") setFrameKey((value) => value + 1);
    onProof(`Visual editor mode: ${nextMode}`);
  }

  function updateDraft(key: keyof EditorDraft, value: string) {
    setSelectedKey(key);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function savePatch() {
    const original = draftFromItems(editableItems);
    let nextContent = content || "";
    (Object.keys(draft) as Array<keyof EditorDraft>).forEach((key) => {
      nextContent = replaceFirst(nextContent, original[key], draft[key]);
    });
    onContentChange(nextContent);
    onProof("Saved in-place visual edit patch from editor-mode preview.");
  }

  function refreshPreview() {
    setFrameKey((value) => value + 1);
    onProof(`Refreshed live preview: ${liveUrl}`);
  }

  function resetEditor() {
    setBrowserUrl(defaultUrl);
    setDraft(draftFromItems(editableItems));
    setSelectedKey("");
    setFrameKey((value) => value + 1);
    setDrawerOpen(false);
    onProof("Reset visual editor to source truth.");
  }

  function editable(key: keyof EditorDraft, className: string) {
    return (
      <span
        className={`${className} editableText ${selectedKey === key ? "selected" : ""}`}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => { setSelectedKey(key); onChat(`Editing ${key} directly on screen.`); }}
        onInput={(event) => updateDraft(key, event.currentTarget.textContent || "")}
        onBlur={savePatch}
      >
        {draft[key]}
      </span>
    );
  }

  return (
    <section className="visualEditor">
      <header className="top">
        <div><b>VISUAL EDITOR</b><span>{stationLabel} · editor mode renders editable React view, not an iframe</span></div>
        <div className="routeBar"><button type="button" onClick={refreshPreview}>↻</button><input value={liveUrl} onChange={(event) => setBrowserUrl(event.target.value)} /><button type="button" onClick={refreshPreview}>Open</button></div>
      </header>

      <main className={`canvas ${viewMode}`}>
        {viewMode === "editor" ? (
          <section className="editablePage" aria-label="Editable frontend preview without iframe">
            <nav className="mockNav"><div className="brand"><b>M</b>{editable("brand", "brandText")}</div><div className="navLinks"><span>Home</span><span>How It Works</span><span>About Your Provider</span><span>FAQ</span></div></nav>
            <h1>{editable("hero", "heroTitle")}</h1>
            <section className="heroCard">
              <div className="providerBlock">
                {editable("provider", "providerName")}
                {editable("subtitle", "providerSubtitle")}
              </div>
              <div className="badge"><span />{editable("badge", "badgeText")}</div>
            </section>
            <div className="sectionBar">{editable("section", "sectionTitle")}</div>
            <section className="visitGrid">
              <article><h2>{editable("leftTitle", "cardTitle")}</h2><div className="imageStub" /><p>Same-Day Appointments</p><p>Personalized Diagnosis</p><button type="button">{editable("leftButton", "buttonText")}</button></article>
              <article><h2>{editable("rightTitle", "cardTitle")}</h2><div className="imageStub right" /><p>Talk to your provider. No camera needed.</p><p>Provider calls you directly</p><button type="button">{editable("rightButton", "buttonText")}</button></article>
            </section>
          </section>
        ) : (
          <section className={viewMode === "mobile" ? "phoneFrame" : "desktopFrame"}>
            {ready ? <iframe key={`${frameKey}-${liveUrl}-${viewMode}`} title="Actual frontend preview" src={liveUrl} /> : <div className="emptyFrame"><h2>Pull a source file first</h2><p>The actual frontend will appear here.</p></div>}
          </section>
        )}
      </main>

      <footer className="sourceActionStrip"><div><span>Route</span><b>{sourceRoute}</b></div><div><span>Selected</span><b>{selectedKey || "Click text"}</b></div><div><span>File</span><b>{filePath || "no file"}</b></div><div><span>Branch</span><b>{branch || "no branch"}</b></div><div><span>Mode</span><b>{viewMode}</b></div><button type="button" className={viewMode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button><button type="button" className={viewMode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button><button type="button" className={viewMode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button><button type="button" className={viewMode === "advanced" ? "active" : ""} onClick={() => switchMode("advanced")}>Advanced</button><button type="button" onClick={savePatch}>Save</button><button type="button" onClick={resetEditor}>Reset</button></footer>

      <details className="editorDrawer" open={drawerOpen || viewMode === "advanced"} onToggle={(event) => setDrawerOpen(event.currentTarget.open)}><summary>Advanced source controls</summary><section className="drawerGrid">{(Object.keys(draft) as Array<keyof EditorDraft>).map((key) => <label key={key}>{key}<input value={draft[key]} onChange={(event) => updateDraft(key, event.target.value)} /></label>)}<section className="patchBox"><b>Patch Preview</b><p>file: {filePath || "none"}</p><p>selected: {selectedKey || "none"}</p></section></section></details>

      <style jsx>{`
        .visualEditor{width:100%;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;background:#020617;color:#fff;overflow:hidden}.top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(148,163,184,.18);background:#0f172a}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.routeBar{display:grid;grid-template-columns:40px minmax(260px,1fr) 80px;gap:8px;width:min(680px,56vw)}.routeBar input{height:38px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:#020617;color:#fff;padding:0 14px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;height:36px;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}.canvas{min-height:0;overflow:auto;background:#020617}.editablePage{max-width:1180px;margin:10px auto 80px;padding:0 18px 40px;background:radial-gradient(circle at center,#0d2f25 0,#020806 52%,#020617 100%);color:#fff;font-family:Arial,Helvetica,sans-serif}.mockNav{height:54px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);max-width:1040px;margin:0 auto}.brand{display:flex;align-items:center;gap:8px;font-weight:900;font-size:22px}.brand b{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#00645e;color:#fff}.brandText{color:#20e0bf}.navLinks{display:flex;gap:28px;color:#cbd5e1;font-size:14px}.editablePage h1{margin:18px auto 16px;text-align:center;font-family:Georgia,serif;font-size:62px;line-height:.95;max-width:1050px}.heroCard{position:relative;max-width:1000px;height:312px;margin:0 auto;border:1px solid #0f766e;border-radius:18px;overflow:hidden;background:linear-gradient(90deg,rgba(8,17,15,.75),rgba(160,150,140,.7)),url('/provider-office.png');background-color:#8b8378}.providerBlock{position:absolute;left:22%;right:22%;top:38%;display:grid;text-align:center;gap:7px}.providerName{font-size:22px;font-weight:900}.providerSubtitle{font-size:14px;color:#e5e7eb}.badge{position:absolute;left:37%;bottom:18px;display:flex;align-items:center;gap:8px;border-radius:999px;background:rgba(2,6,23,.76);padding:9px 16px;font-weight:900}.badge span{display:block;width:10px;height:10px;border-radius:999px;background:#22c55e}.sectionBar{max-width:1000px;margin:0 auto;border-bottom:1px solid #0f766e;background:#062725;text-align:center;padding:14px;font-weight:900;font-size:23px}.visitGrid{max-width:1000px;margin:14px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}.visitGrid article{border:1px solid #0284c7;border-radius:12px;background:#062032;overflow:hidden;text-align:center}.visitGrid h2{margin:0;padding:14px;background:#071a2f;font-size:20px}.imageStub{height:210px;background:linear-gradient(135deg,#d6c1af,#6b7d8c)}.imageStub.right{background:linear-gradient(135deg,#e2d4c2,#b5836c)}.visitGrid p{text-align:left;margin:8px 16px;color:#dbeafe;font-size:13px}.visitGrid button{width:100%;border-radius:0;background:#2f83f6;height:42px}.editableText{outline:0;border:1px solid transparent;border-radius:4px;padding:0 3px;cursor:text}.editableText:hover,.editableText.selected,.editableText:focus{border-color:#f97316;box-shadow:0 0 0 1px rgba(249,115,22,.45),0 0 18px rgba(249,115,22,.24);background:rgba(249,115,22,.08)}.desktopFrame{height:calc(100% - 18px);margin:10px;border:1px solid rgba(124,58,237,.5);border-radius:16px;overflow:auto;background:#fff}.phoneFrame{width:430px;height:min(760px,calc(100% - 30px));margin:12px auto;border:12px solid #111827;border-radius:36px;overflow:auto;background:#fff}.desktopFrame iframe,.phoneFrame iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.emptyFrame{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.sourceActionStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(6,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.sourceActionStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.sourceActionStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.sourceActionStrip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.editorDrawer{max-height:300px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617}.editorDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px}.drawerGrid label,.patchBox{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.drawerGrid input{width:100%;margin-top:6px;border:1px solid rgba(148,163,184,.2);border-radius:8px;background:#020617;color:#fff;padding:8px;box-sizing:border-box}.patchBox p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}
      `}</style>
    </section>
  );
}
