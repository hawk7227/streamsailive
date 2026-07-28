import { useEffect, useRef, useState } from "react";
import RealtimeVoicePanel from "../voice/RealtimeVoicePanel";
import MessageActionBridge from "../message-actions/MessageActionBridge";

const MODES = ["Thinking", "Configure..."];
const MIN_HEIGHT = 48;
const MAX_HEIGHT_DESKTOP = 224;
const MAX_HEIGHT_MOBILE = 180;
const ACCEPTED_UPLOAD_TYPES = "image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.json,.md,.html,.htm,.odt,.rtf,.epub";
const ATTACHMENT_ONLY_SENTINEL = "\u200B";

const TOOL_ITEMS = [
  { id: "files", icon: "↥", label: "Add photos & files", feature: "files" },
  { id: "url", icon: "▣", label: "Add link", feature: "research" },
  { id: "create_image", icon: "✦", label: "Create image", feature: "image" },
  { id: "web_search", icon: "◎", label: "Web search", feature: "research" },
];

function maxTextareaHeight() {
  if (typeof window === "undefined") return MAX_HEIGHT_DESKTOP;
  return window.innerWidth <= 760 ? MAX_HEIGHT_MOBILE : MAX_HEIGHT_DESKTOP;
}

export function autosizeComposerTextarea(node) {
  if (!node) return;
  const max = maxTextareaHeight();
  node.style.height = "0px";
  const next = Math.min(max, Math.max(MIN_HEIGHT, node.scrollHeight));
  node.style.height = `${next}px`;
  node.style.overflowY = node.scrollHeight > max ? "auto" : "hidden";
}

function isTerminalActivity(activity) {
  return ["complete", "error", "failed", "cancelled"].includes(String(activity?.phase || "").toLowerCase());
}

export default function StreamsComposer({
  onSubmit,
  onFilesSelected,
  onToolSelect,
  onModeChange,
  libraryFiles = [],
  onRemoveFile,
  isStreaming = false,
}) {
  const [message, setMessage] = useState("");
  const [activeMenu, setActiveMenu] = useState("");
  const [mode, setMode] = useState("Thinking");
  const [selectedTool, setSelectedTool] = useState(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [liveActivity, setLiveActivity] = useState(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const submitLockRef = useRef(false);
  const sawStreamingRef = useRef(false);

  useEffect(() => autosizeComposerTextarea(inputRef.current), [message, selectedTool]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer || typeof ResizeObserver === "undefined") return undefined;
    const publishHeight = () => {
      document.documentElement.style.setProperty("--streams-composer-height", `${Math.ceil(composer.getBoundingClientRect().height)}px`);
    };
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
    const handleActivity = (event) => {
      const next = event?.detail;
      if (!next?.statusText || next.visible === false || ["Ready", "Ask anything", "Chat is ready"].includes(next.statusText)) {
        setLiveActivity(null);
        return;
      }
      setLiveActivity(next);
    };
    window.addEventListener("streams:chat-activity", handleActivity);
    return () => window.removeEventListener("streams:chat-activity", handleActivity);
  }, []);

  useEffect(() => {
    if (!liveActivity || !isTerminalActivity(liveActivity)) return undefined;
    const timer = window.setTimeout(() => setLiveActivity(null), 1600);
    return () => window.clearTimeout(timer);
  }, [liveActivity]);

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
  const uploadingCount = files.filter((file) => file.status === "uploading").length;
  const failedCount = files.filter((file) => file.status === "error").length;
  const hasUploadingFiles = uploadingCount > 0;
  const isDisabled = isStreaming || hasUploadingFiles;

  const placeholder = selectedTool?.id === "url"
    ? "Paste a link..."
    : selectedTool?.id === "create_image"
      ? "Describe the image..."
      : selectedTool?.id === "web_search"
        ? "Search the web..."
        : "Ask anything";

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
    const hasAttachments = readyAttachments.length > 0;
    if (!value && !hasAttachments) return;

    submitLockRef.current = true;
    let finalMessage = value || ATTACHMENT_ONLY_SENTINEL;
    if (selectedTool?.id === "create_image") finalMessage = `Create an image of ${value || "the attached reference"}`;
    if (selectedTool?.id === "url") finalMessage = `Read the URL: ${value}`;

    setLiveActivity({ phase: "created", mode: "chat", statusText: "Thinking…", visible: true });
    clearInput();
    setSelectedTool(null);
    setActiveMenu("");

    try {
      onSubmit?.({
        message: finalMessage,
        composerMode: selectedTool?.id === "url" ? "url" : "chat",
        mode,
        webSearchEnabled: selectedTool?.id === "web_search",
      });
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

  function renderAttachment(file) {
    const isImage = file.kind === "image" || String(file.mimeType || "").startsWith("image/");
    const previewUrl = file.url || file.storageUrl || file.publicUrl || file.previewUrl;
    const label = file.status === "uploading" ? "Uploading…" : file.status === "error" ? "Upload failed" : "Ready";
    return (
      <div key={file.id} className={`calmAttachment${isImage ? " image" : " file"}${file.status === "error" ? " error" : ""}`}>
        {isImage && previewUrl ? <img src={previewUrl} alt={file.name || "Image"} /> : <span>📄</span>}
        <div><strong>{file.name || "File"}</strong><small>{label}</small></div>
        <button type="button" aria-label={`Remove ${file.name || "attachment"}`} onClick={() => onRemoveFile?.(file.id)}>×</button>
      </div>
    );
  }

  const liveStatus = hasUploadingFiles
    ? `Uploading ${uploadingCount} file${uploadingCount === 1 ? "" : "s"}…`
    : failedCount > 0
      ? `${failedCount} upload${failedCount === 1 ? "" : "s"} failed`
      : liveActivity?.statusText || (isStreaming ? "Thinking…" : "");
  const liveStatusError = (failedCount > 0 && !hasUploadingFiles) || ["error", "failed"].includes(String(liveActivity?.phase || "").toLowerCase());

  return (
    <>
      <MessageActionBridge />
      <section ref={composerRef} className="streamsComposer calmStreamsComposer" data-feature="chat" aria-label="Streams composer" aria-busy={hasUploadingFiles || isStreaming ? "true" : "false"}>
        {liveStatus ? <div className={`calmStatus${liveStatusError ? " error" : ""}`} role="status" aria-live="polite"><i />{liveStatus}</div> : null}
        {files.length ? <div className="calmAttachments">{files.map(renderAttachment)}</div> : null}

        <div className="calmTextRegion">
          {selectedTool ? <div className="calmToolPill"><span>{selectedTool.icon}</span><strong>{selectedTool.label}</strong><button type="button" onClick={() => setSelectedTool(null)}>×</button></div> : null}
          <textarea
            ref={inputRef}
            className="streamsComposerInput calmComposerInput"
            value={message}
            placeholder={placeholder}
            rows={2}
            aria-label="Message Streams AI"
            spellCheck="true"
            onChange={(event) => { setMessage(event.target.value); autosizeComposerTextarea(event.target); }}
            onInput={(event) => autosizeComposerTextarea(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </div>

        <div className="calmActionRow">
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
          .calmStreamsComposer{width:100%;min-height:0!important;max-height:none!important;display:grid!important;grid-template-rows:auto auto minmax(${MIN_HEIGHT}px,auto) 52px!important;gap:8px!important;padding:10px 12px!important;overflow:visible!important;cursor:auto!important}
          .calmTextRegion{min-width:0;display:grid;gap:7px;padding:2px 4px 0}
          .calmComposerInput{display:block!important;width:100%!important;min-height:${MIN_HEIGHT}px!important;max-height:${MAX_HEIGHT_DESKTOP}px!important;height:${MIN_HEIGHT}px;resize:none!important;overflow-x:hidden!important;overflow-y:hidden;border:0!important;outline:0!important;background:transparent!important;color:#fff!important;padding:4px 2px!important;margin:0!important;font:600 16px/1.5 Inter,system-ui,sans-serif!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word!important;box-sizing:border-box!important;cursor:text!important;scrollbar-width:thin}
          .calmActionRow{min-width:0;min-height:52px;display:grid;grid-template-columns:44px minmax(0,1fr) auto auto 52px;align-items:center;gap:8px;border-top:1px solid rgba(148,163,184,.12);padding-top:7px}
          .calmActionRow button,.calmMenu button,.calmToolPill button,.calmAttachment button{cursor:pointer!important}
          .calmAdd,.calmSend{display:grid;place-items:center;border:0;color:#fff}
          .calmAdd{width:42px;height:42px;border-radius:14px;background:rgba(124,58,237,.18);border:1px solid rgba(192,132,252,.28)!important;font-size:22px}
          .calmSend{width:50px;height:50px;border-radius:17px;background:linear-gradient(135deg,#d946ef,#7c3aed 62%,#06d9ff);font-size:22px;font-weight:900;box-shadow:0 0 18px rgba(124,58,237,.44)}
          .calmSend:disabled{opacity:.45;cursor:not-allowed!important}
          .calmMode,.calmMic{height:34px;border:0;background:transparent;color:rgba(255,255,255,.82);font-size:13px;font-weight:750;white-space:nowrap}.calmMode span{margin-left:3px}.calmMic{width:34px}
          .calmStatus{display:flex;align-items:center;gap:8px;color:#cbd5e1;font-size:12px;padding:0 4px}.calmStatus i{width:7px;height:7px;border-radius:999px;background:#22d3ee}.calmStatus.error i{background:#ef4444}
          .calmAttachments{display:flex;gap:8px;overflow-x:auto;padding:2px 3px 7px}.calmAttachment{position:relative;display:flex;align-items:center;gap:8px;min-width:150px;max-width:230px;padding:7px 30px 7px 8px;border-radius:12px;background:rgba(255,255,255,.07)}.calmAttachment img{width:42px;height:42px;object-fit:cover;border-radius:9px}.calmAttachment div{min-width:0;display:grid}.calmAttachment strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.calmAttachment small{color:#94a3b8;font-size:10px}.calmAttachment>button{position:absolute;right:7px;top:7px;border:0;background:transparent;color:#fff}
          .calmToolPill{justify-self:start;display:flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(124,58,237,.18);font-size:12px}.calmToolPill button{border:0;background:transparent;color:#fff}
          .calmMenu{position:absolute;z-index:500;bottom:calc(100% + 10px);width:min(360px,calc(100vw - 28px));padding:9px;border:1px solid rgba(192,132,252,.26);border-radius:18px;background:rgba(7,10,22,.98);box-shadow:0 24px 70px rgba(0,0,0,.42)}.calmMenu.tools{left:0}.calmMenu.model{right:0}.calmMenu button{width:100%;min-height:44px;display:grid;grid-template-columns:28px 1fr 60px;align-items:center;gap:8px;border:0;border-radius:11px;background:transparent;color:#fff;text-align:left;padding:7px 9px}.calmMenu button:hover{background:rgba(124,58,237,.18)}.calmMenu em{font-style:normal;color:#94a3b8;text-align:right;font-size:11px}
          @media(max-width:760px){.calmStreamsComposer{grid-template-rows:auto auto minmax(${MIN_HEIGHT}px,auto) 48px!important;padding:9px 10px!important}.calmComposerInput{max-height:${MAX_HEIGHT_MOBILE}px!important;font-size:16px!important}.calmActionRow{grid-template-columns:42px minmax(0,1fr) 48px}.calmMode,.calmMic{display:none}.calmAdd{width:40px;height:40px}.calmSend{width:46px;height:46px}}
        `}</style>
      </section>
    </>
  );
}
