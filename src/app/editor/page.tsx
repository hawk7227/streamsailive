"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─── Device / Browser tables ──────────────────────────────────────────────────
type Dev = { n: string; w: number; h: number; st: number; sb: number; r: number; c: "ios" | "and" | "tab" | "desk" };
type Brw = { n: string; tc: number; bc: number };

const DEVS: Record<string, Dev> = {
  i15p:  { n: "iPhone 15 Pro",     w: 393, h: 852,  st: 59, sb: 34, r: 55, c: "ios" },
  i16pro:{ n: "iPhone 16 Pro",     w: 402, h: 874,  st: 62, sb: 34, r: 55, c: "ios" },
  i14:   { n: "iPhone 14",         w: 390, h: 844,  st: 47, sb: 34, r: 47, c: "ios" },
  ise:   { n: "iPhone SE",         w: 375, h: 667,  st: 20, sb: 0,  r: 0,  c: "ios" },
  px9:   { n: "Pixel 9",           w: 412, h: 915,  st: 24, sb: 0,  r: 28, c: "and" },
  gs25:  { n: "Galaxy S25",        w: 360, h: 780,  st: 24, sb: 0,  r: 24, c: "and" },
  ipad:  { n: "iPad Air 11\"",     w: 820, h: 1180, st: 24, sb: 20, r: 18, c: "tab" },
  d1440: { n: "Desktop 1440",      w: 1440,h: 900,  st: 0,  sb: 0,  r: 0,  c: "desk"},
};
const BROWS: Record<string, Brw> = {
  saf:  { n: "Safari",          tc: 50, bc: 44 },
  safc: { n: "Safari (hidden)", tc: 0,  bc: 0  },
  safb: { n: "Safari (bottom)", tc: 0,  bc: 56 },
  pwa:  { n: "PWA",             tc: 0,  bc: 0  },
  chr:  { n: "Chrome",          tc: 56, bc: 48 },
  desk: { n: "Desktop",         tc: 0,  bc: 0  },
};
const browsersFor = (d: Dev) =>
  d.c === "ios" ? ["saf","safc","safb","pwa"] :
  d.c === "and" ? ["chr"] : ["desk"];

// ─── Style property groups ────────────────────────────────────────────────────
type PropDef = { k: string; label: string; type: "color" | "px" | "select" | "text"; opts?: string[] };
const PROP_GROUPS: { g: string; props: PropDef[] }[] = [
  { g: "Typography", props: [
    { k: "color",         label: "Color",      type: "color" },
    { k: "fontSize",      label: "Size",        type: "px" },
    { k: "fontWeight",    label: "Weight",      type: "select", opts: ["100","200","300","400","500","600","700","800","900"] },
    { k: "textAlign",     label: "Align",       type: "select", opts: ["left","center","right","justify"] },
    { k: "lineHeight",    label: "Line H",      type: "text" },
    { k: "letterSpacing", label: "Tracking",    type: "text" },
    { k: "textTransform", label: "Transform",   type: "select", opts: ["none","uppercase","lowercase","capitalize"] },
  ]},
  { g: "Background", props: [
    { k: "backgroundColor", label: "BG Color", type: "color" },
    { k: "background",      label: "BG",       type: "text"  },
    { k: "opacity",         label: "Opacity",  type: "text"  },
  ]},
  { g: "Spacing", props: [
    { k: "paddingTop",    label: "Pad T",   type: "px" },
    { k: "paddingBottom", label: "Pad B",   type: "px" },
    { k: "paddingLeft",   label: "Pad L",   type: "px" },
    { k: "paddingRight",  label: "Pad R",   type: "px" },
    { k: "marginTop",     label: "Margin T",type: "px" },
    { k: "marginBottom",  label: "Margin B",type: "px" },
  ]},
  { g: "Size", props: [
    { k: "width",    label: "Width",   type: "text" },
    { k: "height",   label: "Height",  type: "text" },
    { k: "maxWidth", label: "Max W",   type: "text" },
    { k: "minHeight",label: "Min H",   type: "text" },
  ]},
  { g: "Border", props: [
    { k: "borderRadius", label: "Radius", type: "px" },
    { k: "border",       label: "Border", type: "text" },
    { k: "boxShadow",    label: "Shadow", type: "text" },
  ]},
  { g: "Layout", props: [
    { k: "display",        label: "Display",  type: "select", opts: ["block","flex","grid","inline","inline-flex","none"] },
    { k: "flexDirection",  label: "Direction",type: "select", opts: ["row","column","row-reverse","column-reverse"] },
    { k: "justifyContent", label: "Justify",  type: "select", opts: ["flex-start","center","flex-end","space-between","space-around","space-evenly"] },
    { k: "alignItems",     label: "Align",    type: "select", opts: ["flex-start","center","flex-end","stretch","baseline"] },
    { k: "gap",            label: "Gap",      type: "px" },
    { k: "position",       label: "Position", type: "select", opts: ["static","relative","absolute","fixed","sticky"] },
  ]},
];

// URL → path mapping for known pages
const KNOWN: Record<string, string> = {
  "src/app/express-checkout/page.tsx": "https://patient.medazonhealth.com/express-checkout",
  "src/app/page.tsx":                  "https://patient.medazonhealth.com",
};

// ─── Bridge script injected into blob HTML for postMessage mutations ─────────
const BRIDGE_SCRIPT = `<script id="__ep_bridge">
(function(){
  if(window.__ep_bridge_init) return; window.__ep_bridge_init = true;
  window.addEventListener('message', function(e) {
    var sel = document.querySelector('[data-ep-sel="1"]');
    if (!sel) return;
    if (e.data && e.data.type === 'ep-style') { sel.style[e.data.prop] = e.data.value; }
    if (e.data && e.data.type === 'ep-text')  { sel.innerText = e.data.value; }
  });
  setTimeout(function() {
    var colors = [], seen = {};
    function toHex(c) {
      if (!c || c === 'transparent' || c.indexOf('0, 0, 0, 0') > -1) return '';
      var m = c.match(/\\d+/g); if (!m || m.length < 3) return '';
      var h = '#' + m.slice(0,3).map(function(n){return parseInt(n).toString(16).padStart(2,'0')}).join('');
      return (h === '#000000' || h === '#ffffff' || h === '#fefefe') ? '' : h;
    }
    document.querySelectorAll('*').forEach(function(el) {
      var cs = getComputedStyle(el);
      [cs.color, cs.backgroundColor, cs.borderTopColor].forEach(function(c) {
        var h = toHex(c); if (h && !seen[h]) { seen[h] = 1; colors.push(h); }
      });
    });
    window.parent.postMessage({ type: 'ep-colors', colors: colors.slice(0, 48) }, '*');
  }, 800);
})();
<\/script>`;

function hex(rgb: string): string {
  if (!rgb || rgb === "transparent" || rgb.includes("0, 0, 0, 0")) return "";
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return "";
  return "#" + m.slice(0, 3).map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
}

type SelState = {
  tag: string;
  txt: string;
  rect: { x: number; y: number; w: number; h: number };
  sty: Record<string, string>;
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function EditorPro() {
  // Register service worker for proxy injection
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/ep-sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  // Device + browser
  const [did, setDid] = useState("i15p");
  const [bid, setBid] = useState("saf");
  const dev = DEVS[did]; const brw = BROWS[bid];
  const visH = dev.h - brw.tc - brw.bc;
  useEffect(() => {
    const avail = browsersFor(dev);
    if (!avail.includes(bid)) setBid(avail[0]);
  }, [bid, dev]);

  // Scale
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  const [manualZoom, setManualZoom] = useState(0);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: cw, height: ch } = e.contentRect;
      const auto = Math.min((cw - 48) / dev.w, (ch - 48) / dev.h, 1);
      // Always update scale; if user has manual zoom set, prefer that
      setManualZoom(z => { if (z > 0) return z; setScale(auto); return z; });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [dev]);

  // iframe
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Preview URL — empty = blank slate
  const [proxyUrl, setProxyUrl] = useState(""); // "__blob__" = blob mode, URL = live proxy mode
  const [blobContent, setBlobContent] = useState(""); // HTML string for blob iframe
  const [loading, setLoading]   = useState(false);

  // GitHub
  const [ghToken,  setGhToken]  = useState("");
  const [ghRepo,   setGhRepo]   = useState("hawk7227/patientpanel");
  const [ghBranch, setGhBranch] = useState("master");
  const [ghPath,   setGhPath]   = useState("src/app/express-checkout/page.tsx");
  const [ghRepos,  setGhRepos]  = useState<{ full_name: string }[]>([]);
  const [ghFiles,  setGhFiles]  = useState<string[]>([]);
  const [ghBusy,   setGhBusy]   = useState(false);
  const [tsxSrc,   setTsxSrc]   = useState(""); // pulled TSX for write-back + push
  const [pushMsg,  setPushMsg]   = useState("");

  useEffect(() => { try { const t = localStorage.getItem("ep-gh-token"); if (t) setGhToken(t); } catch {} }, []);
  useEffect(() => { if (ghToken) try { localStorage.setItem("ep-gh-token", ghToken); } catch {} }, [ghToken]);

  const fetchRepos = useCallback(async () => {
    if (!ghToken) return;
    setGhBusy(true);
    try {
      const r = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: { Authorization: `Bearer ${ghToken}` },
      });
      if (r.ok) setGhRepos(await r.json());
    } catch {}
    setGhBusy(false);
  }, [ghToken]);

  const fetchFiles = useCallback(async (repo: string, branch: string) => {
    if (!ghToken || !repo) return;
    setGhBusy(true);
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, {
        headers: { Authorization: `Bearer ${ghToken}` },
      });
      if (r.ok) {
        const d = await r.json();
        setGhFiles(
          (d.tree || [])
            .filter((f: { type: string; path: string }) => f.type === "blob" && /\.(tsx|ts|jsx|html|css)$/.test(f.path))
            .map((f: { path: string }) => f.path)
        );
      }
    } catch {}
    setGhBusy(false);
  }, [ghToken]);

  useEffect(() => { if (ghToken && ghRepos.length === 0) fetchRepos(); }, [fetchRepos, ghRepos.length, ghToken]);
  useEffect(() => { if (ghToken && ghRepo) fetchFiles(ghRepo, ghBranch); }, [fetchFiles, ghBranch, ghRepo, ghToken]);

  // ── PULL ─────────────────────────────────────────────────────────────────
  const pull = useCallback(async () => {
    if (!ghToken || !ghPath) return;
    setLoading(true);
    setBlobContent("");
    setProxyUrl("");
    setSel(null);

    try {
      // 1. Pull TSX source for write-back
      const r = await fetch(
        `https://api.github.com/repos/${ghRepo}/contents/${ghPath}?ref=${ghBranch}`,
        { headers: { Authorization: `Bearer ${ghToken}` } }
      );
      const d = await r.json();
      if (!d.content) throw new Error("No content from GitHub");
      setTsxSrc(atob(d.content.replace(/\n/g, "")));

      // 2. Load live URL directly in iframe — bridge script in patientpanel layout handles postMessage
      const liveUrl = KNOWN[ghPath];
      if (!liveUrl) {
        throw new Error(`No live URL mapped for ${ghPath}. Add it to KNOWN in editor source.`);
      }

      setProxyUrl(liveUrl); // direct URL — no proxy needed
      setInspect(true);
      setRightPanel("props");
      // Loading clears on iframe onLoad or ep-ready message. Timeout fallback.
      setTimeout(() => setLoading(false), 20000);
    } catch (e) {
      alert("Pull failed: " + (e instanceof Error ? e.message : e));
      setLoading(false);
    }
  }, [ghToken, ghRepo, ghBranch, ghPath]);

  // ── PUSH ─────────────────────────────────────────────────────────────────
  const push = useCallback(async () => {
    if (!ghToken || !tsxSrc || !ghPath) return;
    setPushMsg("Pushing...");
    try {
      const getR = await fetch(
        `https://api.github.com/repos/${ghRepo}/contents/${ghPath}?ref=${ghBranch}`,
        { headers: { Authorization: `Bearer ${ghToken}` } }
      );
      const existing = getR.ok ? await getR.json() : null;
      const putR = await fetch(`https://api.github.com/repos/${ghRepo}/contents/${ghPath}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${ghToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Style update via EditorPro",
          content: btoa(unescape(encodeURIComponent(tsxSrc))),
          branch: ghBranch,
          ...(existing?.sha ? { sha: existing.sha } : {}),
        }),
      });
      if (!putR.ok) throw new Error(`GitHub ${putR.status}`);
      setPushMsg("✓ Pushed");
    } catch (e) {
      setPushMsg("✗ " + (e instanceof Error ? e.message : e));
    }
    setTimeout(() => setPushMsg(""), 3000);
  }, [ghToken, ghRepo, ghBranch, ghPath, tsxSrc]);

  // ── Write-back (debounced) ────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const pending = useRef<{ prop: string; value: string; elText: string }[]>([]);
  const wbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushWB = useCallback(
    async (changes: { prop: string; value: string; elText: string }[]) => {
      if (!tsxSrc || !changes.length) return;
      try {
        const r = await fetch("/api/editor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "write-back", tsx: tsxSrc, changes }),
        });
        if (r.ok) {
          const { tsx } = await r.json();
          if (tsx) setTsxSrc(tsx);
        }
      } catch {}
      setSaveStatus("saved");
    },
    [tsxSrc]
  );

  const queueWB = useCallback(
    (prop: string, value: string, elText: string) => {
      if (!tsxSrc) return;
      pending.current.push({ prop, value, elText });
      setSaveStatus("saving");
      if (wbTimer.current) clearTimeout(wbTimer.current);
      wbTimer.current = setTimeout(() => {
        const ch = [...pending.current]; pending.current = [];
        flushWB(ch);
      }, 1400);
    },
    [tsxSrc, flushWB]
  );

  // ── Selection state ───────────────────────────────────────────────────────
  const [inspect, setInspect] = useState(false);
  const [sel, setSel]         = useState<SelState | null>(null);
  const [swatches, setSwatches] = useState<string[]>([]);
  const [rightPanel, setRightPanel] = useState<"github" | "props" | null>("github");

  // Drag/resize state
  const dragRef = useRef<{ mode: "move" | "resize-br" | "resize-r" | "resize-b"; startX: number; startY: number; origW: number; origH: number; origLeft: number; origTop: number } | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "ep-ready") {
        setLoading(false); // bridge confirmed active in iframe
      }
      if (e.data?.type === "ep-sel") {
        setSel(e.data as SelState);
        setRightPanel("props");
        const { sty } = e.data as SelState;
        setSwatches(prev => {
          const set = new Set(prev);
          [sty.color, sty.backgroundColor].forEach(c => { const h = hex(c); if (h) set.add(h); });
          return Array.from(set).slice(0, 48);
        });
      }
      if (e.data?.type === "ep-colors") {
        setSwatches((e.data.colors as string[]).slice(0, 48));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Clear loading + color scan when iframe finishes loading
  useEffect(() => {
    const frame = iframeRef.current; if (!frame) return;
    const onLoad = () => {
      setLoading(false);
      // Try direct DOM color scan (works if proxy = same-origin)
      try {
        const doc = frame.contentDocument;
        if (doc?.body) {
          const colors: string[] = []; const seen = new Set<string>();
          doc.querySelectorAll("*").forEach((el) => {
            const cs = getComputedStyle(el as Element);
            [cs.color, cs.backgroundColor].forEach(c => { const h = hex(c); if (h && !seen.has(h)) { seen.add(h); colors.push(h); } });
          });
          if (colors.length > 0) setSwatches(colors.slice(0, 48));
        }
      } catch { /* cross-origin — bridge postMessage handles it */ }
    };
    frame.addEventListener("load", onLoad);
    return () => frame.removeEventListener("load", onLoad);
  }, [inspect]);

  // Update iframe src when proxyUrl changes
  useEffect(() => {
    const frame = iframeRef.current; if (!frame) return;
    if (proxyUrl) {
      frame.src = proxyUrl; // direct live URL — bridge in patientpanel layout handles postMessage
    } else {
      frame.src = "about:blank";
    }
  }, [proxyUrl]);

  // ── Apply style / text ───────────────────────────────────────────────────
  const applyStyle = useCallback(
    (prop: string, value: string) => {
      setSel(prev => {
        if (prev) queueWB(prop, value, prev.txt);
        return prev ? { ...prev, sty: { ...prev.sty, [prop]: value } } : prev;
      });
      iframeRef.current?.contentWindow?.postMessage({ type: "ep-style", prop, value }, "*");
    },
    [queueWB]
  );

  const applyText = useCallback(
    (value: string) => {
      setSel(prev => {
        if (prev) queueWB("__text__", value, prev.txt);
        return prev ? { ...prev, txt: value } : prev;
      });
      iframeRef.current?.contentWindow?.postMessage({ type: "ep-text", value }, "*");
    },
    [queueWB]
  );

  // ── Overlay handlers — no-ops: bridge in target page handles inspection via postMessage ──
  const handleOverlayClick = useCallback((_e: React.MouseEvent<HTMLDivElement>) => {}, []);
  const handleOverlayMove  = useCallback((_e: React.MouseEvent<HTMLDivElement>) => {}, []);
  const handleOverlayLeave = useCallback(() => {}, []);

  // Window-level drag handler for selection handle resize/move (postMessage to cross-origin iframe)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      document.body.style.userSelect = "none";
      const dx = (e.clientX - dragRef.current.startX) / scale;
      const dy = (e.clientY - dragRef.current.startY) / scale;
      const iw = iframeRef.current?.contentWindow;
      if (!iw) return;
      if (dragRef.current.mode === "move") {
        iw.postMessage({ type: "ep-style", prop: "position", value: "relative" }, "*");
        iw.postMessage({ type: "ep-style", prop: "left", value: (dragRef.current.origLeft + dx) + "px" }, "*");
        iw.postMessage({ type: "ep-style", prop: "top",  value: (dragRef.current.origTop  + dy) + "px" }, "*");
      } else if (dragRef.current.mode === "resize-br") {
        iw.postMessage({ type: "ep-style", prop: "width",  value: Math.max(20, dragRef.current.origW + dx) + "px" }, "*");
        iw.postMessage({ type: "ep-style", prop: "height", value: Math.max(10, dragRef.current.origH + dy) + "px" }, "*");
      } else if (dragRef.current.mode === "resize-r") {
        iw.postMessage({ type: "ep-style", prop: "width", value: Math.max(20, dragRef.current.origW + dx) + "px" }, "*");
      } else if (dragRef.current.mode === "resize-b") {
        iw.postMessage({ type: "ep-style", prop: "height", value: Math.max(10, dragRef.current.origH + dy) + "px" }, "*");
      }
    };
    const onUp = () => { dragRef.current = null; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [scale]);

  // ── Filtered style groups ─────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    if (!sel?.sty) return [];
    const SKIP = new Set(["normal","none","0px","auto","static","visible","","transparent"]);
    return PROP_GROUPS.map(g => ({
      ...g,
      props: g.props.filter(p => {
        const v = sel.sty[p.k];
        return v && !SKIP.has(v) && !v.includes("0, 0, 0, 0");
      }),
    })).filter(g => g.props.length > 0);
  }, [sel]);

  const hasContent = !!proxyUrl;
  const displayScale = manualZoom > 0 ? manualZoom : scale;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100vw", background: "#050607", color: "#e5e7eb", fontFamily: "system-ui,-apple-system,sans-serif", overflow: "hidden" }}>

      {/* ── TOP BAR ROW 1: Device + Browser chips ── */}
      <div style={{ flexShrink: 0, height: 36, background: "#09090b", borderBottom: "1px solid #18181b", display: "flex", alignItems: "center", gap: 6, padding: "0 10px", overflow: "hidden" }}>
        {/* Device */}
        <div style={{ display: "flex", gap: 2, overflow: "hidden", flexShrink: 0 }}>
          {Object.entries(DEVS).map(([k, v]) => (
            <Chip key={k} active={k === did} onClick={() => setDid(k)}>{v.n.split(" ").slice(-2).join(" ")}</Chip>
          ))}
        </div>
        <VSep />
        {/* Browser */}
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          {browsersFor(dev).map(k => (
            <Chip key={k} active={k === bid} onClick={() => setBid(k)}>{BROWS[k].n}</Chip>
          ))}
        </div>
      </div>

      {/* ── TOP BAR ROW 2: Logo + Controls ── */}
      <header style={{ flexShrink: 0, height: 44, background: "#09090b", borderBottom: "1px solid #18181b", display: "flex", alignItems: "center", gap: 6, padding: "0 10px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg,#2dd4a0,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#000" }}>E</div>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "-0.02em" }}>Editor<span style={{ color: "#2dd4a0" }}>Pro</span></span>
        </div>
        <VSep />

        <div style={{ flex: 1 }} />

        {/* Save status */}
        {saveStatus === "saving" && <span style={{ fontSize: 9, color: "#f59e0b", flexShrink: 0 }}>↑ saving...</span>}
        {pushMsg && <span style={{ fontSize: 9, color: pushMsg.startsWith("✗") ? "#f87171" : "#2dd4a0", flexShrink: 0 }}>{pushMsg}</span>}

        <VSep />

        {/* Inspect toggle */}
        <button
          onClick={() => setInspect(v => !v)}
          style={{ height: 28, padding: "0 10px", borderRadius: 5, background: inspect ? "#f97316" : "#18181b", border: inspect ? "none" : "1px solid #27272a", color: inspect ? "#000" : "#a1a1aa", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        >
          {inspect ? "👆 INSPECT" : "🖱 BROWSE"}
        </button>

        {/* GitHub panel toggle */}
        <button
          onClick={() => setRightPanel(p => p === "github" ? null : "github")}
          style={{ height: 28, padding: "0 10px", borderRadius: 5, background: rightPanel === "github" ? "#27272a" : "#18181b", border: "1px solid #27272a", color: "#e5e7eb", fontSize: 9, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          ⬆ GitHub
        </button>
        <VSep />

        {/* Zoom */}
        <IconBtn onClick={() => setManualZoom(z => Math.min(2, parseFloat(((z > 0 ? z : displayScale) + 0.05).toFixed(2))))}>+</IconBtn>
        <span style={{ fontSize: 9, color: "#71717a", minWidth: 28, textAlign: "center", flexShrink: 0 }}>{Math.round(displayScale * 100)}%</span>
        <IconBtn onClick={() => setManualZoom(z => Math.max(0.1, parseFloat(((z > 0 ? z : displayScale) - 0.05).toFixed(2))))}>−</IconBtn>
        <IconBtn onClick={() => setManualZoom(0)}>↺</IconBtn>
      </header>

      {/* ── SWATCHES BAR ── */}
      {swatches.length > 0 && (
        <div style={{ flexShrink: 0, height: 28, background: "#09090b", borderBottom: "1px solid #18181b", display: "flex", alignItems: "center", gap: 3, padding: "0 12px", overflow: "auto" }}>
          <span style={{ fontSize: 8, color: "#52525b", fontWeight: 700, marginRight: 4, flexShrink: 0 }}>COLORS</span>
          {swatches.map((c, i) => (
            <button key={i} title={c} onClick={() => sel && applyStyle("color", c)}
              style={{ width: 18, height: 18, borderRadius: 3, background: c, border: "1px solid #27272a", cursor: "pointer", flexShrink: 0 }} />
          ))}
          <button onClick={() => setSwatches([])} style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", fontSize: 8, marginLeft: 4, flexShrink: 0 }}>clear</button>
        </div>
      )}

      {/* ── INFO BAR ── */}
      <div style={{ flexShrink: 0, height: 20, background: "#09090b", borderBottom: "1px solid #18181b", display: "flex", alignItems: "center", gap: 10, padding: "0 12px", fontSize: 8, color: "#52525b" }}>
        <span style={{ fontWeight: 700, color: inspect ? "#f97316" : "#3f3f46" }}>{inspect ? "INSPECT" : "BROWSE"}</span>
        <span style={{ color: "#71717a" }}>{dev.n}</span>
        <span>{dev.w}×{dev.h}</span>
        <span>Vis:{visH}px</span>
        {proxyUrl && <span style={{ color: "#2dd4a0", fontWeight: 700 }}>✓ PROXY+SW — inspectable</span>}
        {tsxSrc && <span style={{ color: "#7c3aed" }}>TSX: {ghPath.split("/").pop()}</span>}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── CANVAS ── */}
        <div ref={wrapRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#050607", position: "relative" }}>
          {!hasContent && (
            <div style={{ textAlign: "center", color: "#3f3f46", userSelect: "none" }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>◎</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#52525b" }}>Open GitHub → Pull a file</p>
              <p style={{ fontSize: 11, color: "#3f3f46", marginTop: 6, lineHeight: 1.6 }}>
                The live page loads via server proxy<br />Same-origin · Fully inspectable
              </p>
            </div>
          )}

          {hasContent && (
            <div style={{ transform: `scale(${displayScale})`, transformOrigin: "center center", flexShrink: 0, transition: "transform 150ms ease" }}>
              {/* Phone shell */}
              <div style={{ position: "relative", width: dev.w + 2, borderRadius: dev.r, overflow: "hidden", boxShadow: "0 0 0 1px #27272a, 0 30px 90px rgba(0,0,0,.8)", background: "#0a0a0a" }}>
                {/* Top chrome */}
                {brw.tc > 0 && (
                  <div style={{ height: brw.tc, background: "#18181b", borderBottom: "1px solid #27272a", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 5 }}>
                    <div style={{ width: dev.w * 0.6, height: 22, background: "#0a0a0a", borderRadius: 11, border: "1px solid #27272a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#52525b", gap: 4 }}>
                      🔒 {proxyUrl ? (proxyUrl.includes("url=") ? decodeURIComponent(proxyUrl.split("url=")[1]).replace("https://","") : proxyUrl) : "preview"}
                    </div>
                  </div>
                )}
                {/* Viewport */}
                <div style={{ width: dev.w, height: visH, position: "relative", background: "#111" }}>
                  <iframe
                    ref={iframeRef}
                    title="EditorPro Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    style={{ width: dev.w, height: visH, border: "none", display: "block", pointerEvents: "auto" }}
                  />
                  {/* Inspect overlay + selection handles */}
                  {inspect && (
                    <div
                      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, userSelect: "none" }}

                    >
                      {/* Selection handles — rendered on top of selected element */}
                      {sel && (() => {
                        const { x, y, w, h } = sel.rect;
                        const pad = 3;
                        return (
                          <div style={{ position: "absolute", left: x - pad, top: y - pad, width: w + pad * 2, height: h + pad * 2, pointerEvents: "none", zIndex: 10 }}>
                            {/* Selection border */}
                            <div style={{ position: "absolute", inset: 0, border: "2px solid #f97316", borderRadius: 2, pointerEvents: "none" }} />
                            {/* Drag handle — move */}
                            <div
                              title="Drag to move"
                              style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", width: 40, height: 12, background: "#f97316", borderRadius: "3px 3px 0 0", cursor: "move", pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                if (!sel) return;
                                dragRef.current = { mode: "move", startX: e.clientX, startY: e.clientY, origW: parseFloat(sel.sty.width) || sel.rect.w, origH: parseFloat(sel.sty.height) || sel.rect.h, origLeft: parseFloat(sel.sty.left) || 0, origTop: parseFloat(sel.sty.top) || 0 };
                              }}
                            >
                              <div style={{ width: 14, height: 2, borderRadius: 1, background: "rgba(0,0,0,0.5)" }} />
                            </div>
                            {/* Resize BR corner */}
                            <div
                              title="Drag to resize"
                              style={{ position: "absolute", bottom: -5, right: -5, width: 10, height: 10, background: "#f97316", borderRadius: 2, cursor: "se-resize", pointerEvents: "auto" }}
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                if (!sel) return;
                                dragRef.current = { mode: "resize-br", startX: e.clientX, startY: e.clientY, origW: parseFloat(sel.sty.width) || sel.rect.w, origH: parseFloat(sel.sty.height) || sel.rect.h, origLeft: 0, origTop: 0 };
                              }}
                            />
                            {/* Resize right edge */}
                            <div
                              title="Drag to resize width"
                              style={{ position: "absolute", top: "50%", right: -5, transform: "translateY(-50%)", width: 8, height: 20, background: "#f97316", borderRadius: 3, cursor: "e-resize", pointerEvents: "auto" }}
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                if (!sel) return;
                                dragRef.current = { mode: "resize-r", startX: e.clientX, startY: e.clientY, origW: parseFloat(sel.sty.width) || sel.rect.w, origH: 0, origLeft: 0, origTop: 0 };
                              }}
                            />
                            {/* Resize bottom edge */}
                            <div
                              title="Drag to resize height"
                              style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 20, height: 8, background: "#f97316", borderRadius: 3, cursor: "s-resize", pointerEvents: "auto" }}
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                if (!sel) return;
                                dragRef.current = { mode: "resize-b", startX: e.clientX, startY: e.clientY, origW: 0, origH: parseFloat(sel.sty.height) || sel.rect.h, origLeft: 0, origTop: 0 };
                              }}
                            />
                            {/* Label */}
                            <div style={{ position: "absolute", top: -26, left: 0, background: "#f97316", color: "#000", fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 3, whiteSpace: "nowrap", pointerEvents: "none" }}>
                              &lt;{sel.tag}&gt; {sel.rect.w}×{sel.rect.h}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Loading spinner */}
                  {loading && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 20 }}>
                      <div style={{ width: 24, height: 24, border: "2px solid #2dd4a0", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
                      <span style={{ fontSize: 11, color: "#2dd4a0", fontWeight: 600 }}>Loading via proxy…</span>
                    </div>
                  )}
                </div>
                {/* Bottom chrome */}
                {brw.bc > 0 && (
                  <div style={{ height: brw.bc, background: "#18181b", borderTop: "1px solid #27272a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 120, height: 4, borderRadius: 2, background: "rgba(255,255,255,.1)" }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        {rightPanel && (
          <aside style={{ width: 300, flexShrink: 0, background: "#09090b", borderLeft: "1px solid #18181b", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Panel header */}
            <div style={{ flexShrink: 0, height: 36, background: "#0c0c0e", borderBottom: "1px solid #18181b", display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: rightPanel === "github" ? "#2dd4a0" : "#f97316" }}>
                {rightPanel === "github" ? "GitHub" : "Properties"}
              </span>
              <div style={{ flex: 1 }} />
              {rightPanel === "props" && (
                <button onClick={() => setRightPanel("github")} style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", fontSize: 9, padding: "2px 6px" }}>⬆ GitHub</button>
              )}
              <button onClick={() => { setRightPanel(null); setSel(null); }} style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
            </div>

            {/* Panel content */}
            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>

              {/* ── GITHUB ── */}
              {rightPanel === "github" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Field label="GitHub Token">
                    <input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)} placeholder="ghp_..." style={inputSty} />
                  </Field>

                  <Field label="Repo">
                    <div style={{ display: "flex", gap: 4 }}>
                      <select value={ghRepo} onChange={e => { setGhRepo(e.target.value); setGhFiles([]); }} style={{ ...inputSty, flex: 1 }}>
                        <option value="">{ghBusy ? "Loading…" : ghRepos.length === 0 ? "Click ↻ to load" : "Select…"}</option>
                        {ghRepos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
                      </select>
                      <button onClick={fetchRepos} style={{ ...secBtnSty, padding: "0 10px", fontSize: 13 }}>↻</button>
                    </div>
                  </Field>

                  <Field label="Branch">
                    <input value={ghBranch} onChange={e => setGhBranch(e.target.value)} style={inputSty} />
                  </Field>

                  <Field label="File">
                    <select value={ghPath} onChange={e => setGhPath(e.target.value)} style={inputSty}>
                      <option value="">Select file…</option>
                      {ghFiles.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>

                  {/* Status badge */}
                  <div style={{ padding: "8px 10px", borderRadius: 6, background: tsxSrc ? "rgba(45,212,160,.06)" : "rgba(249,115,22,.06)", border: `1px solid ${tsxSrc ? "rgba(45,212,160,.15)" : "rgba(249,115,22,.15)"}`, fontSize: 9, color: tsxSrc ? "#2dd4a0" : "#f97316", lineHeight: 1.5 }}>
                    {proxyUrl ? `✓ Live page loaded — click any element to inspect` : tsxSrc ? "TSX pulled — click Pull ✦ to load live preview" : "Select a file and click Pull ✦"}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={pull} disabled={!ghPath || loading}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 6, background: !ghPath || loading ? "#27272a" : "#2dd4a0", color: !ghPath || loading ? "#52525b" : "#000", fontWeight: 700, fontSize: 11, border: "none", cursor: "pointer", transition: "all 150ms" }}>
                      {loading ? "Loading…" : "Pull ✦"}
                    </button>
                    <button onClick={push} disabled={!tsxSrc}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 6, background: tsxSrc ? "#f97316" : "#27272a", color: tsxSrc ? "#fff" : "#52525b", fontWeight: 700, fontSize: 11, border: "none", cursor: "pointer", transition: "all 150ms" }}>
                      Push →
                    </button>
                  </div>

                  {/* Quick-pull shortcuts */}
                  <div style={{ borderTop: "1px solid #18181b", paddingTop: 10 }}>
                    <div style={{ fontSize: 8, color: "#3f3f46", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Quick Pull</div>
                    {Object.entries(KNOWN).map(([path, url]) => (
                      <button key={path} onClick={() => setGhPath(path)}
                        style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "7px 10px", borderRadius: 5, background: ghPath === path ? "#18181b" : "transparent", border: `1px solid ${ghPath === path ? "#27272a" : "transparent"}`, cursor: "pointer", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: ghPath === path ? "#e5e7eb" : "#71717a", fontWeight: 600 }}>{path.split("/").pop()}</span>
                        <span style={{ fontSize: 8, color: "#3f3f46" }}>{url.replace("https://", "")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── PROPERTIES ── */}
              {rightPanel === "props" && (
                <>
                  {!sel ? (
                    <div style={{ textAlign: "center", color: "#52525b", paddingTop: 40 }}>
                      <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 10 }}>👆</div>
                      <p style={{ fontSize: 11 }}>Click any element to inspect</p>
                    </div>
                  ) : (
                    <>
                      {/* Element info */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <span style={{ background: "#f97316", color: "#000", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>&lt;{sel.tag}&gt;</span>
                        <span style={{ fontSize: 9, color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{sel.txt}</span>
                      </div>
                      {/* Dims */}
                      <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 5, padding: "6px 10px", marginBottom: 10, display: "flex", gap: 14, fontSize: 9, color: "#52525b", fontFamily: "monospace" }}>
                        {["x","y","w","h"].map(k => <span key={k}>{k}:{sel.rect[k as keyof typeof sel.rect]}</span>)}
                      </div>

                      {/* Text content */}
                      <Section label="Content">
                        <input value={sel.txt} onChange={e => applyText(e.target.value)} style={{ ...inputSty, fontFamily: "monospace", fontSize: 10 }} />
                      </Section>

                      {/* Style groups */}
                      {filteredGroups.map(g => (
                        <Section key={g.g} label={g.g}>
                          {g.props.map(p => {
                            const v = sel.sty[p.k] || "";
                            return (
                              <div key={p.k} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 4, background: "#0f0f11", border: "1px solid #1c1c1c", marginBottom: 3 }}>
                                {p.type === "color" && (
                                  <div style={{ width: 20, height: 20, borderRadius: 3, background: v || "#000", border: "1px solid #333", flexShrink: 0, position: "relative", overflow: "hidden" }}>
                                    <input type="color" value={hex(v) || "#000000"} onChange={e => applyStyle(p.k, e.target.value)}
                                      style={{ position: "absolute", inset: -4, opacity: 0, cursor: "pointer", width: "140%", height: "140%" }} />
                                  </div>
                                )}
                                <span style={{ fontSize: 8, color: "#52525b", minWidth: 52, flexShrink: 0 }}>{p.label}</span>
                                {p.type === "px" && (
                                  <>
                                    <input type="range" min={0} max={120} step={1} value={parseFloat(v) || 0}
                                      onChange={e => applyStyle(p.k, e.target.value + "px")}
                                      style={{ flex: 1, accentColor: "#f97316", cursor: "pointer" }} />
                                    <input value={v} onChange={e => applyStyle(p.k, e.target.value)}
                                      style={{ width: 50, background: "#0a0a0a", border: "1px solid #27272a", borderRadius: 3, padding: "2px 4px", fontSize: 9, color: "#e5e7eb", fontFamily: "monospace", outline: "none", textAlign: "right" }} />
                                  </>
                                )}
                                {p.type === "select" && (
                                  <select value={v} onChange={e => applyStyle(p.k, e.target.value)}
                                    style={{ flex: 1, background: "#0a0a0a", border: "1px solid #27272a", borderRadius: 3, padding: "3px 4px", fontSize: 9, color: "#e5e7eb", outline: "none", cursor: "pointer" }}>
                                    {p.opts?.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                )}
                                {(p.type === "text" || p.type === "color") && (
                                  <input value={v} onChange={e => applyStyle(p.k, e.target.value)}
                                    style={{ flex: 1, background: "#0a0a0a", border: "1px solid #27272a", borderRadius: 3, padding: "2px 4px", fontSize: 9, color: "#e5e7eb", fontFamily: "monospace", outline: "none" }} />
                                )}
                              </div>
                            );
                          })}
                        </Section>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      <style>{`* { box-sizing: border-box; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Tiny sub-components ──────────────────────────────────────────────────────
function VSep() {
  return <div style={{ width: 1, height: 22, background: "#27272a", flexShrink: 0 }} />;
}
function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "3px 7px", fontSize: 9, fontWeight: active ? 700 : 400, color: active ? "#e5e7eb" : "#71717a", background: active ? "#27272a" : "transparent", border: active ? "1px solid #3f3f46" : "1px solid transparent", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
      {children}
    </button>
  );
}
function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 26, height: 26, borderRadius: 5, background: "#18181b", border: "1px solid #27272a", color: "#a1a1aa", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {children}
    </button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 9, color: "#71717a", fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 8, color: "#3f3f46", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputSty: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 5, background: "#0f0f11",
  border: "1px solid #27272a", color: "#e5e7eb", fontSize: 10, outline: "none",
};
const secBtnSty: React.CSSProperties = {
  height: 34, borderRadius: 5, background: "#18181b", border: "1px solid #27272a",
  color: "#a1a1aa", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
};
