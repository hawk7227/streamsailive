"use client";

import { useEffect, useRef, useState } from "react";

const PANEL_KEY = "streams-builder:visual-patch-panel-layout";
const SUPPORTED_SCOPES = new Set(["card-item", "section-frame"]);

function readActiveFile() {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readLayout() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PANEL_KEY) || "{}");
    return {
      x: Number(saved.x || window.innerWidth - 560),
      y: Number(saved.y || 132),
      width: Number(saved.width || 540),
      height: Number(saved.height || 680),
      locked: Boolean(saved.locked),
      minimized: Boolean(saved.minimized),
    };
  } catch {
    return { x: 980, y: 132, width: 540, height: 680, locked: false, minimized: false };
  }
}

function saveLayout(layout) {
  try { window.localStorage.setItem(PANEL_KEY, JSON.stringify(layout)); } catch {}
}

function normalizeEditablePayload(message) {
  const payload = message?.payload || message || {};
  const type = message?.type || payload?.event || "";
  if (payload.event === "streams:visual-selection") return payload;
  if (message?.source !== "streams-editable-preview") return null;
  if (!/^streams-editable-(select|remove|delete|image-replace|style|transform-start)$/.test(type)) return null;
  return {
    event: "streams:visual-selection",
    selectionId: payload.id || payload.layerId || `sel_${Date.now()}`,
    tag: payload.kind || "element",
    text: payload.text || "",
    parentText: [payload.text, ...(payload.childLayers || []).map((child) => child.text)].filter(Boolean).join(" "),
    href: payload.href || "",
    imageSrc: payload.src || payload.original || "",
    selector: payload.selector || "",
    sourceFile: payload.sourceFile || "",
    component: payload.component || "",
    symbol: payload.symbol || "",
    itemKey: payload.itemKey || payload.href || payload.src || "",
    operationTarget: payload.operationTarget || payload.kind || "",
    box: { width: payload.width || 0, height: payload.height || 0 },
    raw: payload,
    source: "editable-preview",
    actionType: type,
  };
}

function valueFromObject(block, key) {
  const match = String(block || "").match(new RegExp(`${key}\\s*:\\s*([\"'\`])([\\s\\S]*?)\\1`));
  return match?.[2] || "";
}

function parseCards(source, arrayName) {
  if (!source || !arrayName) return [];
  const start = source.indexOf(`const ${arrayName}`);
  if (start < 0) return [];
  const arrayStart = source.indexOf("[", start);
  if (arrayStart < 0) return [];
  const cards = [];
  let depth = 0;
  let quote = "";
  let escaped = false;
  let objectStart = -1;
  for (let i = arrayStart; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") { if (depth === 0) objectStart = i; depth += 1; }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        const block = source.slice(objectStart, i + 1);
        const card = {
          title: valueFromObject(block, "title"),
          accent: valueFromObject(block, "accent"),
          cta: valueFromObject(block, "cta"),
          href: valueFromObject(block, "href"),
          img: valueFromObject(block, "img"),
          alt: valueFromObject(block, "alt"),
        };
        if (card.title || card.accent || card.img || card.href || card.cta) cards.push(card);
        objectStart = -1;
      }
    }
    if (ch === "]" && depth <= 0 && i > arrayStart) break;
  }
  return cards;
}

function graphItemToCard(item) {
  const text = item?.text || [];
  return {
    title: text[0] || "",
    accent: text[1] || "",
    cta: text.find((value) => /send|start|continue|book|submit|take/i.test(value)) || "",
    href: item?.href || "",
    img: item?.image || "",
    alt: text.join(" ") || "Remaining item",
  };
}

function fallbackAfterCards(plan, item) {
  const items = plan?.result?.graph?.items || [];
  if (!item?.arrayName) return [];
  return items
    .filter((candidate) => candidate.file === item.file && candidate.arrayName === item.arrayName && candidate.key !== item.key)
    .map(graphItemToCard)
    .filter((card) => card.title || card.accent || card.img || card.href)
    .slice(0, 6);
}

function assetUrl(path, selection) {
  if (!path) return selection?.imageSrc || "";
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const origin = selection?.imageSrc ? new URL(selection.imageSrc).origin : "";
    return origin ? new URL(path, origin).toString() : path;
  } catch {
    return path;
  }
}

function focusedPreview(patch, resolved) {
  const before = String(patch?.before || "");
  const range = resolved?.item?.range;
  if (!before || !range?.startLine || !range?.endLine) return String(patch?.patch || "").slice(0, 2200);
  const lines = before.split("\n");
  const start = Math.max(1, range.startLine - 4);
  const end = Math.min(lines.length, range.endLine + 4);
  const out = [`Focused removal preview · ${patch.file}`, `@@ ${start},${end - start + 1} @@`];
  for (let lineNo = start; lineNo <= end; lineNo += 1) {
    const isTarget = lineNo >= range.startLine && lineNo <= range.endLine;
    out.push(`${isTarget ? "-" : " "}${String(lineNo).padStart(4, " ")} ${lines[lineNo - 1] || ""}`);
  }
  return out.join("\n");
}

function MiniCard({ card, selection, removed = false, frame = false }) {
  return (
    <article className={removed ? "miniCard removed" : "miniCard"}>
      {card?.img ? <img src={assetUrl(card.img, selection)} alt={card.alt || card.title || "preview"} /> : null}
      <div>
        <b>{[card?.title, card?.accent].filter(Boolean).join(" ") || card?.alt || "Selected visual item"}</b>
        {frame ? <em>Full card/frame will be removed</em> : null}
        {card?.cta ? <span>{card.cta}</span> : null}
        {card?.href ? <small>{card.href}</small> : null}
      </div>
    </article>
  );
}

export default function VisualSelectionPatchPanel() {
  const [selection, setSelection] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState(() => ({ x: 980, y: 132, width: 540, height: 680, locked: false, minimized: false }));
  const [scope, setScope] = useState("section-frame");
  const lastAutoPlanRef = useRef("");
  const dragRef = useRef(null);

  useEffect(() => { setLayout(readLayout()); }, []);
  useEffect(() => { saveLayout(layout); }, [layout]);

  async function generatePatch(approve = false, explicitSelection = selection) {
    const activeFile = readActiveFile();
    if (!activeFile?.path || !activeFile?.content) {
      setError("No active source file is loaded. Pull/open the source file first.");
      return;
    }
    if (!explicitSelection) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/streams-builder/visual-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: activeFile.repo,
          branch: activeFile.branch,
          files: [{ path: activeFile.path, content: activeFile.content, repo: activeFile.repo, branch: activeFile.branch, sha: activeFile.sha, route: activeFile.route }],
          selection: { ...explicitSelection, removalScope: scope },
          command: scope === "image-only" ? "remove exact image only" : scope === "parent-group" ? "remove parent group" : "remove this",
          approve,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || data?.result?.error || "Visual edit failed");
      setPlan(data);
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: approve ? "visual-edit-commit" : "visual-edit-plan", message: approve ? `Visual edit committed: ${data.commits?.[0]?.commitSha || "pending"}` : `Visual edit resolved with ${data.result?.resolved?.confidence || 0}% confidence across ${(data.indexedFiles || []).length || 1} indexed files.` } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Visual edit failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onMessage(event) {
      const normalized = normalizeEditablePayload(event.data || {});
      if (!normalized) return;
      setSelection(normalized);
      setPlan(null);
      setError("");
      setScope("section-frame");
      const key = `${normalized.selectionId || ""}:${normalized.imageSrc || ""}:${normalized.text || ""}:${normalized.selector || ""}`;
      if (key !== lastAutoPlanRef.current) {
        lastAutoPlanRef.current = key;
        window.setTimeout(() => generatePatch(false, normalized), 0);
      }
    }
    function onMove(event) {
      if (!dragRef.current) return;
      const next = {
        ...layout,
        x: Math.max(8, Math.min(window.innerWidth - 120, dragRef.current.x + event.clientX - dragRef.current.startX)),
        y: Math.max(8, Math.min(window.innerHeight - 80, dragRef.current.y + event.clientY - dragRef.current.startY)),
      };
      setLayout(next);
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("message", onMessage);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [layout]);

  if (!selection) return null;
  const resolved = plan?.result?.resolved;
  const patch = plan?.result?.patches?.[0] || null;
  const indexedFiles = plan?.indexedFiles || [];
  const item = resolved?.item || {};
  const unsupportedScope = !SUPPORTED_SCOPES.has(scope);
  const effect = scope === "section-frame" ? "removes full visual card/frame; next item moves up" : scope === "card-item" ? "removes this rendered data item/card" : scope === "image-only" ? "not enabled yet; use card/item or whole frame" : "not enabled yet; use card/item or whole frame";
  const summary = {
    operation: scope === "section-frame" ? "remove-section-frame" : scope === "card-item" ? "remove-card-item" : scope,
    resolvedEdit: patch?.operation || "remove-array-item",
    target: item.arrayName ? `${item.arrayName} item` : resolved?.targetType || "visual selection",
    file: resolved?.sourceFile || patch?.file || "not resolved yet",
    image: item.image || selection.imageSrc || "",
    href: item.href || selection.href || "",
    confidence: resolved?.confidence || 0,
    effect,
  };
  const beforeCard = { title: item.text?.[0] || "", accent: item.text?.[1] || "", cta: item.text?.find((text) => /send|start|continue|book|submit|take/i.test(text)) || "", href: item.href || selection.href || "", img: item.image || selection.imageSrc || "", alt: item.text?.join(" ") || "Selected item" };
  const parsedAfter = parseCards(patch?.after || "", item.arrayName);
  const afterCards = (parsedAfter.length ? parsedAfter : fallbackAfterCards(plan, item)).slice(0, 6);

  const style = {
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    width: `${layout.width}px`,
    height: layout.minimized ? "46px" : `${layout.height}px`,
    resize: layout.locked ? "none" : "both",
  };

  return (
    <aside className="visualPatchPanel" style={style}>
      <header onPointerDown={(event) => { if (!layout.locked) dragRef.current = { startX: event.clientX, startY: event.clientY, x: layout.x, y: layout.y }; }}>
        <b>Selection → Patch</b>
        <nav>
          <button type="button" onClick={() => setLayout((next) => ({ ...next, locked: !next.locked }))}>{layout.locked ? "Unlock" : "Lock"}</button>
          <button type="button" onClick={() => setLayout({ x: window.innerWidth - 560, y: 132, width: 540, height: 680, locked: false, minimized: false })}>Reset</button>
          <button type="button" onClick={() => setLayout((next) => ({ ...next, minimized: !next.minimized }))}>{layout.minimized ? "Open" : "Min"}</button>
          <button type="button" onClick={() => { setSelection(null); setPlan(null); }}>×</button>
        </nav>
      </header>
      {!layout.minimized ? <div className="body">
        <p><span>Selected</span><b>{selection.text || selection.parentText || selection.imageSrc || selection.selector || "Element"}</b></p>
        <section className="scopePicker"><span>Scope</span><div>{[["image-only", "Image only"], ["card-item", "Card/item"], ["section-frame", "Whole frame/section"], ["parent-group", "Parent group"]].map(([value, label]) => <button key={value} type="button" className={scope === value ? "active" : ""} onClick={() => setScope(value)}>{label}</button>)}</div></section>
        {busy && !plan ? <p><span>Status</span><b>Resolving source automatically…</b></p> : null}
        {indexedFiles.length ? <p><span>Indexed files</span><b>{indexedFiles.slice(0, 5).join(" · ")}{indexedFiles.length > 5 ? ` +${indexedFiles.length - 5}` : ""}</b></p> : null}
        {resolved ? <section className="summaryCard"><p><span>Operation</span><b>{summary.operation}</b></p><p><span>Resolved edit</span><b>{summary.resolvedEdit}</b></p><p><span>Target</span><b>{summary.target}</b></p><p><span>File</span><b>{summary.file}</b></p>{summary.image ? <p><span>Matched image</span><b>{summary.image}</b></p> : null}{summary.href ? <p><span>Matched href</span><b>{summary.href}</b></p> : null}<p><span>Effect</span><b>{summary.effect}</b></p><p><span>Confidence</span><b>{summary.confidence}%</b></p></section> : null}
        {patch ? <section className="visualCompare"><div><h3>{scope === "section-frame" ? "Will remove entire frame" : "Will be removed"}</h3><MiniCard card={beforeCard} selection={selection} removed frame={scope === "section-frame"} /></div><div><h3>After remove · following items move up</h3><div className="afterGrid">{afterCards.length ? afterCards.map((card, index) => <MiniCard key={`${card.href}-${index}`} card={card} selection={selection} />) : <article className="emptyAfter">Selected frame gone. Remaining layout collapses into place.</article>}</div></div></section> : null}
        {unsupportedScope ? <p className="error">This scope is not safely patchable yet. Choose Card/item or Whole frame/section.</p> : null}
        {resolved?.reasons?.length ? <ul>{resolved.reasons.slice(0, 6).map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
        {error ? <p className="error">{error}</p> : null}
        {plan?.result?.error ? <p className="error">{plan.result.error}</p> : null}
        {patch ? <pre>{focusedPreview(patch, resolved)}</pre> : null}
      </div> : null}
      {!layout.minimized ? <footer><button type="button" disabled={busy} onClick={() => generatePatch(false)}>{busy ? "Working…" : "Re-plan"}</button><button type="button" disabled={busy || !patch || unsupportedScope} onClick={() => generatePatch(true)}>Apply + Push</button></footer> : null}
      <style jsx>{`.visualPatchPanel{position:fixed;z-index:2147483000;min-width:360px;min-height:220px;max-width:calc(100vw - 20px);max-height:calc(100dvh - 20px);border:1px solid rgba(55,229,255,.38);border-radius:18px;background:#081126;color:#eaf3ff;box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}header{height:46px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px;border-bottom:1px solid rgba(148,163,184,.18);cursor:move;user-select:none}header b{font-size:12px}nav{display:flex;gap:6px;align-items:center}nav button{height:26px;border:0;background:rgba(255,255,255,.08);color:white;border-radius:999px;padding:0 8px;font-size:10px;font-weight:900}.body{height:calc(100% - 96px);padding:12px;display:grid;gap:8px;overflow:auto}.body p{margin:0;display:grid;gap:2px}.body span,.scopePicker span{color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.body b{font-size:12px;line-height:1.35;overflow-wrap:anywhere}.scopePicker{display:grid;gap:8px;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.62);padding:10px}.scopePicker div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.scopePicker button{height:30px;border:1px solid rgba(148,163,184,.24);border-radius:10px;background:#1e293b;color:#cbd5e1;font-size:11px;font-weight:900}.scopePicker button.active{background:#7c3aed;color:#fff;border-color:#a78bfa}.summaryCard{display:grid;gap:8px;border:1px solid rgba(110,231,183,.28);border-radius:14px;background:rgba(6,78,59,.18);padding:10px}.visualCompare{display:grid;grid-template-columns:1fr 1fr;gap:10px}.visualCompare h3{margin:0 0 6px;font-size:11px;color:#6ee7b7;text-transform:uppercase}.miniCard{overflow:hidden;border:1px solid rgba(148,163,184,.24);border-radius:13px;background:#0f172a;color:#fff}.miniCard.removed{opacity:.74;outline:2px solid rgba(248,113,113,.5)}.miniCard img{display:block;width:100%;height:88px;object-fit:cover}.miniCard div{padding:8px}.miniCard b{display:block;font-size:11px}.miniCard em{display:block;margin-top:4px;color:#fca5a5;font-size:10px;font-style:normal;font-weight:900}.miniCard span,.miniCard small{display:block;margin-top:4px;color:#a9b8d9;font-size:10px;overflow-wrap:anywhere}.afterGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:250px;overflow:auto}.emptyAfter{display:grid;place-items:center;min-height:120px;border:1px dashed rgba(110,231,183,.35);border-radius:13px;padding:12px;color:#a9b8d9;text-align:center;font-size:12px}.body ul{margin:0;padding-left:18px;color:#a9b8d9;font-size:11px}.error{color:#fecaca!important}pre{white-space:pre-wrap;max-height:190px;overflow:auto;background:#020617;border-radius:12px;padding:10px;color:#cbd5e1;font-size:10px}footer{height:50px;display:flex;gap:8px;padding:8px 10px;border-top:1px solid rgba(148,163,184,.18)}footer button{flex:1;border:0;border-radius:10px;background:#7c3aed;color:white;font-weight:900;font-size:12px}footer button:disabled{opacity:.55}@media(max-width:980px){.visualCompare{grid-template-columns:1fr}.visualPatchPanel{left:10px!important;right:10px!important;width:auto!important}}`}</style>
    </aside>
  );
}
