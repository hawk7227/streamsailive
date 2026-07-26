"use client";

import { RefObject, useEffect, useMemo, useState } from "react";

type ConsoleEntry = { id: string; level: string; text: string; at: string };
type NetworkEntry = { id: string; method: string; url: string; status?: number; duration?: number; at: string };
type DomEntry = { tag: string; id?: string; classes?: string; text?: string; selector?: string; role?: string; ariaLabel?: string; rect?: Record<string, number>; styles?: Record<string, string> } | null;
type Message = { source?: string; type?: string; level?: string; args?: unknown[]; method?: string; url?: string; status?: number; duration?: number; element?: DomEntry; message?: string; snapshot?: unknown; data?: unknown };
type Props = { frameRef: RefObject<HTMLIFrameElement | null>; frameKey: number; active: boolean };
type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";
type PreviewWindow = Window & { console: Pick<Console, ConsoleLevel>; fetch: typeof fetch; performance: Performance; XMLHttpRequest: typeof XMLHttpRequest; WebSocket: typeof WebSocket; EventSource: typeof EventSource; __streamsDevToolsInstalled?: boolean; __streamsInspect?: boolean };

function stringify(value: unknown) { if (typeof value === "string") return value; try { return JSON.stringify(value); } catch { return String(value); } }
function now() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

export default function BrowserDevTools({ frameRef, frameKey, active }: Props) {
  const [panel, setPanel] = useState<"console" | "network" | "elements">("console");
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [networkEntries, setNetworkEntries] = useState<NetworkEntry[]>([]);
  const [element, setElement] = useState<DomEntry>(null);
  const [status, setStatus] = useState("Waiting for preview");
  const [inspect, setInspect] = useState(false);

  useEffect(() => {
    function receive(event: MessageEvent<Message>) {
      const data = event.data || {};
      if (data.source !== "streams-browser-devtools") return;
      window.dispatchEvent(new CustomEvent("streams-builder:browser-telemetry", { detail: { ...data, at: new Date().toISOString() } }));
      window.dispatchEvent(new CustomEvent("streams-builder:shared-context", { detail: { kind: "browser", ...data } }));
      if (data.type === "console") setConsoleEntries((items) => [...items.slice(-299), { id: crypto.randomUUID(), level: data.level || "log", text: (data.args || []).map(stringify).join(" "), at: now() }]);
      if (["network", "xhr", "resource", "websocket", "eventsource"].includes(data.type || "")) setNetworkEntries((items) => [...items.slice(-299), { id: crypto.randomUUID(), method: data.method || data.type?.toUpperCase() || "GET", url: data.url || "", status: data.status, duration: data.duration, at: now() }]);
      if (data.type === "element") { setElement(data.element || null); setPanel("elements"); }
      if (data.type === "error") setConsoleEntries((items) => [...items.slice(-299), { id: crypto.randomUUID(), level: "error", text: data.message || "Browser error", at: now() }]);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const targetFrame: HTMLIFrameElement = frame;

    function install() {
      try {
        const contentWindow = targetFrame.contentWindow;
        const doc = targetFrame.contentDocument;
        if (!contentWindow || !doc) throw new Error("Preview is cross-origin");
        const win = contentWindow as unknown as PreviewWindow;
        if (win.__streamsDevToolsInstalled) return;
        win.__streamsDevToolsInstalled = true;
        const send = (payload: Message) => window.postMessage({ source: "streams-browser-devtools", ...payload }, "*");
        const snapshot = () => {
          const resources = win.performance.getEntriesByType("resource").slice(-150).map((entry) => ({ name: entry.name, duration: Math.round(entry.duration), startTime: Math.round(entry.startTime), initiatorType: (entry as PerformanceResourceTiming).initiatorType }));
          const interactive = Array.from(doc.querySelectorAll("a,button,input,select,textarea,[role],[tabindex]")).slice(0, 300).map((node) => { const el = node as HTMLElement; return { tag: el.tagName.toLowerCase(), id: el.id || undefined, role: el.getAttribute("role") || undefined, ariaLabel: el.getAttribute("aria-label") || undefined, text: (el.innerText || el.textContent || "").trim().slice(0, 120), disabled: (el as HTMLButtonElement).disabled || undefined }; });
          send({ type: "snapshot", snapshot: { url: win.location.href, title: doc.title, readyState: doc.readyState, viewport: { width: win.innerWidth, height: win.innerHeight, devicePixelRatio: win.devicePixelRatio }, document: { html: doc.documentElement.outerHTML.slice(0, 120000), text: (doc.body?.innerText || "").slice(0, 30000), activeElement: (doc.activeElement as HTMLElement | null)?.outerHTML?.slice(0, 1000) || "" }, accessibility: interactive, storage: { localStorage: Object.fromEntries(Object.entries(win.localStorage).slice(0, 100)), sessionStorage: Object.fromEntries(Object.entries(win.sessionStorage).slice(0, 100)), cookie: doc.cookie }, resources } });
        };
        (["log", "info", "warn", "error", "debug"] as const).forEach((level) => { const original = win.console[level].bind(win.console); win.console[level] = (...args: unknown[]) => { send({ type: "console", level, args }); original(...args); }; });
        win.addEventListener("error", (event: ErrorEvent) => send({ type: "error", message: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}` }));
        win.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => send({ type: "error", message: stringify(event.reason) }));
        win.addEventListener("hashchange", () => { send({ type: "navigation", url: win.location.href }); snapshot(); });
        win.addEventListener("popstate", () => { send({ type: "navigation", url: win.location.href }); snapshot(); });
        const originalFetch = win.fetch.bind(win);
        win.fetch = async (input: RequestInfo | URL, init?: RequestInit) => { const started = win.performance.now(); const method = init?.method || "GET"; const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url; try { const response = await originalFetch(input, init); send({ type: "network", method, url, status: response.status, duration: Math.round(win.performance.now() - started) }); return response; } catch (error) { send({ type: "network", method, url, status: 0, duration: Math.round(win.performance.now() - started), message: stringify(error) }); throw error; } };
        const OriginalXHR = win.XMLHttpRequest;
        class InstrumentedXHR extends OriginalXHR { private __method = "GET"; private __url = ""; private __started = 0; override open(method: string, url: string | URL, ...rest: [boolean?, string?, string?]) { this.__method = method; this.__url = String(url); return super.open(method, url, ...(rest as [boolean, string?, string?])); } override send(body?: Document | XMLHttpRequestBodyInit | null) { this.__started = win.performance.now(); this.addEventListener("loadend", () => send({ type: "xhr", method: this.__method, url: this.__url, status: this.status, duration: Math.round(win.performance.now() - this.__started) })); return super.send(body); } }
        win.XMLHttpRequest = InstrumentedXHR as unknown as typeof XMLHttpRequest;
        doc.addEventListener("error", (event) => { const target = event.target as HTMLImageElement | HTMLScriptElement | HTMLLinkElement | null; if (target && "src" in target) send({ type: "resource", url: String(target.src || ""), status: 0, message: "Resource failed to load" }); else if (target && "href" in target) send({ type: "resource", url: String(target.href || ""), status: 0, message: "Resource failed to load" }); }, true);
        doc.addEventListener("click", (event) => { if (!win.__streamsInspect) return; event.preventDefault(); event.stopPropagation(); const node = event.target as HTMLElement; const selector = node.id ? `#${node.id}` : `${node.tagName.toLowerCase()}${Array.from(node.classList).slice(0, 3).map((name) => `.${name}`).join("")}`; const rect = node.getBoundingClientRect(); const style = win.getComputedStyle(node); send({ type: "element", element: { tag: node.tagName.toLowerCase(), id: node.id || undefined, classes: Array.from(node.classList).join(" ") || undefined, text: (node.innerText || node.textContent || "").trim().slice(0, 240), selector, role: node.getAttribute("role") || undefined, ariaLabel: node.getAttribute("aria-label") || undefined, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, styles: { display: style.display, position: style.position, color: style.color, background: style.background, font: style.font, margin: style.margin, padding: style.padding, zIndex: style.zIndex } } }); }, true);
        const observer = new MutationObserver(() => { window.clearTimeout((win as unknown as { __streamsSnapshotTimer?: number }).__streamsSnapshotTimer); (win as unknown as { __streamsSnapshotTimer?: number }).__streamsSnapshotTimer = window.setTimeout(snapshot, 600); });
        if (doc.body) observer.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true });
        snapshot();
        setStatus("Connected: console, network, DOM, storage, resources and accessibility context");
      } catch {
        setStatus("Cross-origin preview: Streams postMessage bridge required for full telemetry");
        window.dispatchEvent(new CustomEvent("streams-builder:browser-telemetry", { detail: { type: "capability", message: "Cross-origin preview requires the Streams DevTools bridge", at: new Date().toISOString() } }));
      }
    }
    targetFrame.addEventListener("load", install);
    install();
    return () => targetFrame.removeEventListener("load", install);
  }, [frameRef, frameKey]);

  useEffect(() => { try { const contentWindow = frameRef.current?.contentWindow; if (contentWindow) (contentWindow as unknown as PreviewWindow).__streamsInspect = inspect; } catch {} }, [inspect, frameRef, frameKey]);

  const counts = useMemo(() => ({ errors: consoleEntries.filter((entry) => entry.level === "error").length, requests: networkEntries.length }), [consoleEntries, networkEntries]);
  if (!active) return null;

  return <section className="devtools" aria-label="Browser DevTools"><header><nav><button className={panel === "console" ? "active" : ""} onClick={() => setPanel("console")}>Console {counts.errors ? `· ${counts.errors}` : ""}</button><button className={panel === "network" ? "active" : ""} onClick={() => setPanel("network")}>Network · {counts.requests}</button><button className={panel === "elements" ? "active" : ""} onClick={() => setPanel("elements")}>Elements</button></nav><div><span title={status}>{status}</span><button className={inspect ? "active" : ""} onClick={() => setInspect((value) => !value)}>Inspect</button><button onClick={() => { setConsoleEntries([]); setNetworkEntries([]); setElement(null); }}>Clear</button></div></header><main>{panel === "console" ? <div className="rows">{consoleEntries.length ? consoleEntries.map((entry) => <p key={entry.id} className={entry.level}><time>{entry.at}</time><b>{entry.level}</b><span>{entry.text}</span></p>) : <div className="empty">Console output will appear here.</div>}</div> : null}{panel === "network" ? <div className="rows">{networkEntries.length ? networkEntries.map((entry) => <p key={entry.id} className={entry.status && entry.status >= 400 ? "error" : "log"}><time>{entry.at}</time><b>{entry.method}</b><span>{entry.status ?? "…"} · {entry.duration ?? 0}ms · {entry.url}</span></p>) : <div className="empty">Network requests will appear here.</div>}</div> : null}{panel === "elements" ? <div className="element">{element ? <><code>{element.selector}</code><dl><dt>Tag</dt><dd>{element.tag}</dd><dt>Role</dt><dd>{element.role || "—"}</dd><dt>ARIA</dt><dd>{element.ariaLabel || "—"}</dd><dt>ID</dt><dd>{element.id || "—"}</dd><dt>Classes</dt><dd>{element.classes || "—"}</dd><dt>Text</dt><dd>{element.text || "—"}</dd></dl></> : <div className="empty">Turn on Inspect, then click an element in the preview.</div>}</div> : null}</main><style jsx>{`.devtools{height:100%;min-height:0;display:grid;grid-template-rows:40px minmax(0,1fr);background:#0d1117;color:#e6edf3}.devtools header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 10px;border-bottom:1px solid #30363d}.devtools nav,.devtools header>div{display:flex;align-items:center;gap:5px;min-width:0}.devtools button{height:28px;border:1px solid transparent;border-radius:7px;background:transparent;color:#8b949e;font-size:11px;font-weight:800;padding:0 9px;cursor:pointer}.devtools button.active{background:#21262d;border-color:#3b82f6;color:#fff}.devtools header span{max-width:430px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8b949e;font-size:10px}.devtools main,.rows{min-height:0;overflow:auto}.rows p{margin:0;display:grid;grid-template-columns:72px 72px minmax(0,1fr);gap:8px;padding:6px 10px;border-bottom:1px solid #21262d;font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}.rows time{color:#6e7681}.rows b{color:#79c0ff;text-transform:uppercase}.rows p.warn b{color:#d29922}.rows p.error{background:rgba(248,81,73,.08)}.rows p.error b{color:#f85149}.rows span{white-space:pre-wrap;overflow-wrap:anywhere}.element{padding:14px}.element code{display:block;padding:10px;border:1px solid #30363d;border-radius:8px;background:#161b22;color:#79c0ff}.element dl{display:grid;grid-template-columns:80px minmax(0,1fr);gap:8px;margin-top:14px;font-size:12px}.element dt{color:#8b949e}.element dd{margin:0;overflow-wrap:anywhere}.empty{height:100%;display:grid;place-content:center;color:#6e7681;padding:20px;text-align:center}`}</style></section>;
}
