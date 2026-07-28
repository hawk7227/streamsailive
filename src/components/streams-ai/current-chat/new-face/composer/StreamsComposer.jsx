import { useEffect, useRef, useState } from "react";
import RealtimeVoicePanel from "../voice/RealtimeVoicePanel";
import MessageActionBridge from "../message-actions/MessageActionBridge";

const MODES = ["Thinking", "Configure..."];
const MIN_HEIGHT = 48;
const MAX_HEIGHT_DESKTOP = 224;
const MAX_HEIGHT_MOBILE = 192;
const ACCEPTED_UPLOAD_TYPES = "image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.json,.md,.html,.htm,.odt,.rtf,.epub";
const ATTACHMENT_ONLY_SENTINEL = "\u200B";
const TOOL_ITEMS = [
  { id: "files", icon: "↥", label: "Add photos & files" },
  { id: "url", icon: "▣", label: "Add link" },
  { id: "create_image", icon: "✦", label: "Create image" },
  { id: "web_search", icon: "◎", label: "Web search" },
];

function maxTextareaHeight() {
  if (typeof window === "undefined") return MAX_HEIGHT_DESKTOP;
  return window.innerWidth <= 760 ? MAX_HEIGHT_MOBILE : MAX_HEIGHT_DESKTOP;
}

export function autosizeComposerTextarea(node) {
  if (!node) return;
  const max = maxTextareaHeight();
  node.style.height = "0px";
  const desired = Math.min(max, Math.max(MIN_HEIGHT, node.scrollHeight));
  node.style.height = `${desired}px`;
  node.style.overflowY = node.scrollHeight > max ? "auto" : "hidden";
}

function removeCursorArtifacts(root = document) {
  const selectors = [
    ".custom-cursor", ".customCursor", ".cursor-dot", ".cursorDot",
    ".cursor-follower", ".cursorFollower", ".cursor-follow", ".mouse-dot",
    ".mouse-follow", ".pointer-dot", "[data-custom-cursor]", "[data-cursor-dot]",
    "#custom-cursor", "#cursor-dot", "[class*='customCursor']",
    "[class*='cursor-follow']", "[class*='cursorFollower']",
    "[class*='mouse-follow']", "[class*='pointer-dot']",
  ];
  selectors.forEach((selector) => root.querySelectorAll?.(selector).forEach((node) => node.remove()));
  document.documentElement.style.cursor = "auto";
  if (document.body) document.body.style.cursor = "auto";
}

export default function StreamsComposer({ onSubmit, onFilesSelected, onToolSelect, onModeChange, libraryFiles = [], onRemoveFile, isStreaming = false }) {
  const [message, setMessage] = useState("");
  const [activeMenu, setActiveMenu] = useState("");
  const [mode, setMode] = useState("Thinking");
  const [selectedTool, setSelectedTool] = useState(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const submitLockRef = useRef(false);
  const sawStreamingRef = useRef(false);

  useEffect(() => autosizeComposerTextarea(inputRef.current), [message, selectedTool]);

  useEffect(() => {
    removeCursorArtifacts();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) removeCursorArtifacts(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer || typeof ResizeObserver === "undefined") return undefined;
    const publishHeight = () => document.documentElement.style.setProperty("--streams-composer-height", `${Math.ceil(composer.getBoundingClientRect().height)}px`);
    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(composer);
    window.addEventListener("resize", publishHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publishHeight);
      document.documentElement.style.removeProperty("--streams-composer-height");
    };
  }, []);

  useEffect(() => {
    if (isStreaming) {
      sawStreamingRef.current = true;
      return;
    }
    if (sawStreamingRef.current) {
      submitLockRef.current = false;
      sawStreamingRef.current = false;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!activeMenu) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setActiveMenu(""); };
    const closeOnOutside = (event) => { if (composerRef.current && !composerRef.current.contains(event.target)) setActiveMenu(""); };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [activeMenu]);

  const files = Array.isArray(libraryFiles) ? libraryFiles : [];
  const readyAttachments = files.filter((file) => file.status !== "uploading" && file.status !== "error");
  const hasUploadingFiles = files.some((file) => file.status === "uploading");
  const isDisabled = isStreaming || hasUploadingFiles;
  const placeholder = selectedTool?.id === "url" ? "Paste a link..." : selectedTool?.id === "create_image" ? "Describe the image..." : selectedTool?.id === "web_search" ? "Search the web..." : "Ask anything";

  function clearInput() {
    setMessage("");
    window.requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.value = "";
      inputRef.current.style.height = `${MIN_HEIGHT}px`;
      inputRef.current.style.overflowY = "hidden";
      inputRef.current.scrollTop = 0;
    });
  }

  function submit() {
    if (isDisabled || submitLockRef.current) return;
    const value = message.trim();
    if (!value && !readyAttachments.length) return;
    submitLockRef.current = true;
    let finalMessage = value || ATTACHMENT_ONLY_SENTINEL;
    if (selectedTool?.id === "create_image") finalMessage = `Create an image of ${value || "the attached reference"}`;
    if (selectedTool?.id === "url") finalMessage = `Read the URL: ${value}`;
    clearInput();
    setSelectedTool(null);
    setActiveMenu("");
    try {
      onSubmit?.({ message: finalMessage, composerMode: selectedTool?.id === "url" ? "url" : "chat", mode, webSearchEnabled: selectedTool?.id === "web_search" });
    } catch (error) {
      submitLockRef.current = false;
      throw error;
    }
  }

  function handleFileChange(event) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length) onFilesSelected?.(selectedFiles);
    event.target.value = "";
    setActiveMenu("");
  }

  function handleTool(item) {
    if (item.id === "files") {
      setActiveMenu("");
      window.setTimeout(() => fileInputRef.current?.click(), 40);
      return;
    }
    if (["url", "create_image", "web_search"].includes(item.id)) {
      setSelectedTool((current) => current?.id === item.id ? null : item);
      setActiveMenu("");
      return;
    }
    onToolSelect?.(item.id);
    setActiveMenu("");
  }

  const shellStyle = {
    position: "relative", width: "100%", display: "grid", gridTemplateRows: "auto auto",
    gap: 8, padding: "10px 12px", border: "1px solid rgba(139,92,246,.4)", borderRadius: 22,
    background: "rgba(12,18,38,.96)", boxShadow: "0 10px 30px rgba(0,0,0,.28)",
    boxSizing: "border-box", color: "#fff", overflow: "visible", cursor: "auto",
  };
  const inputStyle = {
    display: "block", position: "relative", width: "100%", minWidth: 0, minHeight: MIN_HEIGHT,
    maxHeight: maxTextareaHeight(), height: MIN_HEIGHT, resize: "none", overflowX: "hidden",
    overflowY: "hidden", border: 0, outline: 0, boxShadow: "none", background: "transparent",
    color: "#fff", padding: "8px 6px", margin: 0, font: "500 15px/1.5 Inter,system-ui,sans-serif",
    whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word", boxSizing: "border-box",
    cursor: "text", scrollbarWidth: "thin", zIndex: 1,
  };
  const actionStyle = {
    position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: "40px minmax(0,1fr) auto auto 44px",
    alignItems: "center", gap: 8, minHeight: 50, width: "100%", borderTop: "1px solid rgba(148,163,184,.11)",
    paddingTop: 7, background: "rgba(12,18,38,.96)", cursor: "auto",
  };

  return (
    <>
      <MessageActionBridge />
      <section ref={composerRef} className="calmStreamsComposer" style={shellStyle} data-feature="chat" aria-label="Streams composer" aria-busy={isStreaming ? "true" : "false"}>
        {files.length ? <div className="calmAttachments">{files.map((file) => {
          const isImage = file.kind === "image" || String(file.mimeType || "").startsWith("image/");
          const previewUrl = file.url || file.storageUrl || file.publicUrl || file.previewUrl;
          return <div key={file.id} className="calmAttachment">{isImage && previewUrl ? <img src={previewUrl} alt={file.name || "Image"} /> : <span>📄</span>}<strong>{file.name || "File"}</strong><button type="button" aria-label={`Remove ${file.name || "attachment"}`} onClick={() => onRemoveFile?.(file.id)}>×</button></div>;
        })}</div> : null}

        {selectedTool ? <div className="calmToolPill"><span>{selectedTool.icon}</span><strong>{selectedTool.label}</strong><button type="button" onClick={() => setSelectedTool(null)}>×</button></div> : null}

        <textarea ref={inputRef} className="calmComposerInput" style={inputStyle} value={message} placeholder={placeholder} rows={2} aria-label="Message Streams AI" spellCheck="true" onChange={(event) => { setMessage(event.target.value); autosizeComposerTextarea(event.target); }} onInput={(event) => autosizeComposerTextarea(event.currentTarget)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} />

        <div className="calmActionRow" style={actionStyle}>
          <button type="button" className="calmAdd" aria-label="Open tools" onClick={() => setActiveMenu(activeMenu === "tools" ? "" : "tools")}>+</button>
          <div className="calmSpacer" />
          <button type="button" className="calmMode" aria-label="Open mode menu" onClick={() => setActiveMenu(activeMenu === "model" ? "" : "model")}>{mode}<span>⌄</span></button>
          <button type="button" className="calmMic" aria-label="Start realtime voice conversation" onClick={() => { setActiveMenu(""); setVoicePanelOpen(true); }}>🎙</button>
          <button type="button" className="calmSend" aria-label={isStreaming ? "Response in progress" : "Send"} onClick={submit} disabled={isDisabled || (!message.trim() && !readyAttachments.length)}>{isStreaming ? "■" : "↑"}</button>
        </div>

        <input aria-label="Add photos and files" type="file" multiple accept={ACCEPTED_UPLOAD_TYPES} hidden ref={fileInputRef} onChange={handleFileChange} />
        {activeMenu === "tools" ? <div className="calmMenu tools" role="menu">{TOOL_ITEMS.map((item) => <button key={item.id} type="button" onClick={() => handleTool(item)}><span>{item.icon}</span><strong>{item.label}</strong><em>{item.id === "web_search" ? "Live" : ""}</em></button>)}</div> : null}
        {activeMenu === "model" ? <div className="calmMenu model" role="menu">{MODES.map((item) => <button key={item} type="button" onClick={() => { setActiveMenu(""); if (item === "Configure...") window.location.assign("/account/personalization"); else { setMode(item); onModeChange?.(item); } }}><strong>{item}</strong><em>{item === mode ? "Active" : ""}</em></button>)}</div> : null}
        {voicePanelOpen ? <RealtimeVoicePanel onClose={() => setVoicePanelOpen(false)} /> : null}

        <style jsx>{`
          .calmActionRow button,.calmMenu button,.calmToolPill button,.calmAttachment button{cursor:pointer!important}
          .calmAdd,.calmSend{display:grid;place-items:center;border:0;color:#fff}.calmAdd{width:38px;height:38px;border-radius:12px;background:rgba(124,58,237,.14);border:1px solid rgba(192,132,252,.24);font-size:20px}.calmSend{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#d946ef,#7c3aed 62%,#06d9ff);font-size:19px;font-weight:900;box-shadow:0 0 13px rgba(124,58,237,.35)}.calmSend:disabled{opacity:.42;cursor:not-allowed!important}
          .calmMode,.calmMic{height:30px;border:0;background:transparent;color:rgba(255,255,255,.78);font-size:12px;font-weight:700;white-space:nowrap}.calmMode span{margin-left:3px}.calmMic{width:30px}
          .calmAttachments{display:flex;gap:6px;overflow-x:auto;padding:1px 2px 5px}.calmAttachment{display:flex;align-items:center;gap:6px;min-width:130px;max-width:210px;padding:5px 25px 5px 6px;border-radius:10px;background:rgba(255,255,255,.06);position:relative}.calmAttachment img{width:34px;height:34px;object-fit:cover;border-radius:7px}.calmAttachment strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.calmAttachment>button{position:absolute;right:5px;top:5px;border:0;background:transparent;color:#fff}
          .calmToolPill{align-self:flex-start;display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:999px;background:rgba(124,58,237,.16);font-size:11px}.calmToolPill button{border:0;background:transparent;color:#fff}
          .calmMenu{position:absolute;z-index:500;bottom:calc(100% + 8px);width:min(340px,calc(100vw - 24px));padding:8px;border:1px solid rgba(192,132,252,.24);border-radius:16px;background:rgba(7,10,22,.98);box-shadow:0 20px 60px rgba(0,0,0,.4)}.calmMenu.tools{left:0}.calmMenu.model{right:0}.calmMenu button{width:100%;min-height:40px;display:grid;grid-template-columns:26px 1fr 56px;align-items:center;gap:7px;border:0;border-radius:10px;background:transparent;color:#fff;text-align:left;padding:6px 8px}.calmMenu button:hover{background:rgba(124,58,237,.16)}.calmMenu em{font-style:normal;color:#94a3b8;text-align:right;font-size:10px}
          @media(max-width:760px){.calmActionRow{grid-template-columns:40px minmax(0,1fr) 44px!important}.calmMode,.calmMic{display:none}}
        `}</style>
      </section>
    </>
  );
}
