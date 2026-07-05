import { useEffect, useRef, useState } from "react";
import "./streams-composer.css";
import "./streams-composer-layout-fix.css";
import "./chat-message-text-fix.css";
import RealtimeVoicePanel from "../voice/RealtimeVoicePanel";

const MODES = ["Thinking", "Configure..."];
const COMPOSER_TEXTAREA_MIN_HEIGHT = 30;
const COMPOSER_TEXTAREA_MAX_HEIGHT = 168;

const BASE_TOOL_ITEMS = [
  { id: "files", icon: "+", label: "Add photos & files", shortcut: "Ctrl + U", enabled: true },
  { id: "url", icon: "link", label: "Add link", enabled: true },
  { id: "create_image", icon: "image", label: "Create image", enabled: true },
  { id: "web_search", icon: "web", label: "Web search", enabled: true, shortcut: "Live" },
];

const MOBILE_TOOL_ITEMS = [
  { id: "mode_thinking", icon: "mode", label: "Mode: Thinking", shortcut: "Active", enabled: true },
  { id: "configure", icon: "settings", label: "Configure...", shortcut: "/account/personalization", enabled: true },
  { id: "voice_mic", icon: "mic", label: "Voice / Mic", shortcut: "Realtime", enabled: true },
];

function autosizeComposerTextarea(node) {
  if (!node) return;
  node.style.height = "0px";
  const nextHeight = Math.min(COMPOSER_TEXTAREA_MAX_HEIGHT, Math.max(COMPOSER_TEXTAREA_MIN_HEIGHT, node.scrollHeight));
  node.style.height = `${nextHeight}px`;
  node.style.overflowY = node.scrollHeight > COMPOSER_TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
}

function isPromiseLike(value) {
  return value && typeof value.then === "function";
}

export default function StreamsComposer({ onSubmit, onFilesSelected, onToolSelect, onModeChange, libraryFiles = [], onRemoveFile, isStreaming = false }) {
  const [message, setMessage] = useState("");
  const [activeMenu, setActiveMenu] = useState("");
  const [mode, setMode] = useState("Thinking");
  const [selectedTool, setSelectedTool] = useState(null);
  const [blockedNotice, setBlockedNotice] = useState("");
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [isMobileComposer, setIsMobileComposer] = useState(false);
  const [webSearchStatus, setWebSearchStatus] = useState({ configured: false, blockedReason: "Checking real web search configuration..." });

  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { autosizeComposerTextarea(inputRef.current); }, [message, selectedTool]);

  useEffect(() => {
    const updateMobileState = () => setIsMobileComposer(window.innerWidth < 900);
    updateMobileState();
    window.addEventListener("resize", updateMobileState);
    window.addEventListener("orientationchange", updateMobileState);
    return () => {
      window.removeEventListener("resize", updateMobileState);
      window.removeEventListener("orientationchange", updateMobileState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/streams-ai/search/status", { method: "GET" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setWebSearchStatus({ configured: Boolean(data?.configured), blockedReason: data?.blockedReason || "OPENAI_API_KEY is required for real web search." });
      })
      .catch(() => {
        if (cancelled) return;
        setWebSearchStatus({ configured: false, blockedReason: "Unable to verify real web search backend configuration." });
      });
    return () => { cancelled = true; };
  }, []);

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

  const baseToolItems = BASE_TOOL_ITEMS.map((item) => item.id === "web_search" ? { ...item, enabled: webSearchStatus.configured, shortcut: webSearchStatus.configured ? "Live" : "Not configured", blockedReason: webSearchStatus.blockedReason } : item);
  const toolItems = isMobileComposer ? [...baseToolItems, ...MOBILE_TOOL_ITEMS] : baseToolItems;
  const placeholder = selectedTool ? selectedTool.id === "url" ? "Paste a link..." : selectedTool.id === "create_image" ? "Describe the image..." : selectedTool.id === "web_search" ? "Search the web..." : "Ask anything" : "Ask anything";
  const hasUploadingFiles = libraryFiles?.some((file) => file.status === "uploading");
  const isDisabled = isStreaming || hasUploadingFiles;

  function hardClearInput() {
    setMessage("");
    window.dispatchEvent(new CustomEvent("streams:composer-submitted", { detail: { cleared: true, at: new Date().toISOString() } }));
    window.requestAnimationFrame(() => {
      const input = inputRef.current || document.querySelector(".streamsComposerInput");
      if (!input) return;
      input.value = "";
      input.style.height = `${COMPOSER_TEXTAREA_MIN_HEIGHT}px`;
      input.style.overflowY = "hidden";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function restoreDraft(draft, error) {
    setMessage(draft);
    setBlockedNotice(error?.message || "Message failed before it was safely accepted. Your draft was restored.");
    window.requestAnimationFrame(() => autosizeComposerTextarea(inputRef.current));
  }

  function handleModeSelection(nextMode) {
    setActiveMenu("");
    if (nextMode === "Configure...") {
      window.location.assign("/account/personalization");
      return;
    }
    setMode(nextMode);
    onModeChange?.(nextMode);
  }

  function submit() {
    if (isDisabled) return;
    const value = message.trim();
    const readyAttachments = Array.isArray(libraryFiles) ? libraryFiles.filter((file) => file.status !== "uploading") : [];
    const hasAttachments = readyAttachments.length > 0;
    if (!value && !hasAttachments) return;

    let finalMessage = value || `Review the attached file${readyAttachments.length === 1 ? "" : "s"}.`;
    if (selectedTool?.id === "create_image") finalMessage = "Create an image of " + finalMessage;
    if (selectedTool?.id === "url") finalMessage = "Read the URL: " + finalMessage;
    if (selectedTool?.id === "web_search") {
      if (!webSearchStatus.configured) {
        setBlockedNotice(webSearchStatus.blockedReason);
        setSelectedTool(null);
        setActiveMenu("");
        return;
      }
      finalMessage = value;
    }

    const draftToRecover = message;
    setSelectedTool(null);
    setActiveMenu("");
    setBlockedNotice("");

    try {
      const result = onSubmit?.({ message: finalMessage, composerMode: selectedTool?.id === "url" ? "url" : "chat", mode, webSearchEnabled: selectedTool?.id === "web_search" });
      if (isPromiseLike(result)) result.then(() => hardClearInput()).catch((error) => restoreDraft(draftToRecover, error));
      else hardClearInput();
    } catch (error) {
      restoreDraft(draftToRecover, error);
    }
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) onFilesSelected?.(files);
    event.target.value = "";
    setActiveMenu("");
  }

  function handleTool(item) {
    if (!item.enabled) {
      setBlockedNotice(item.blockedReason || `${item.label} is not configured.`);
      setActiveMenu("");
      return;
    }
    if (item.id === "files") { setActiveMenu(""); setTimeout(() => fileInputRef.current?.click(), 50); return; }
    if (item.id === "url" || item.id === "create_image" || item.id === "web_search") { setSelectedTool((current) => (current?.id === item.id ? null : item)); setBlockedNotice(""); setActiveMenu(""); return; }
    if (item.id === "mode_thinking") { handleModeSelection("Thinking"); return; }
    if (item.id === "configure") { handleModeSelection("Configure..."); return; }
    if (item.id === "voice_mic") { setActiveMenu(""); setVoicePanelOpen(true); return; }
    onToolSelect?.(item.id);
    setActiveMenu("");
  }

  function renderFileAttachment(file) {
    const isImage = file.kind === "image" || (file.mimeType || "").startsWith("image/");
    const previewUrl = file.url || file.storageUrl || file.publicUrl || file.previewUrl;
    const isUploading = file.status === "uploading";
    const isError = file.status === "error";
    const removeButton = !isUploading ? <button type="button" aria-label={`Remove ${file.name || "attachment"}`} onClick={() => onRemoveFile?.(file.id)}>x</button> : null;

    if (isImage && previewUrl) {
      return <div key={file.id} className={isError ? "streamsComposerAttachmentImage isError" : "streamsComposerAttachmentImage"}><img src={previewUrl} alt={file.name || "Image"} />{isUploading ? <span className="streamsComposerAttachmentOverlay">Uploading</span> : null}{isError ? <span className="streamsComposerAttachmentOverlay">Upload failed. Remove and try again.</span> : null}{removeButton}</div>;
    }
    return <div key={file.id} className={isError ? "streamsComposerAttachmentFile isError" : "streamsComposerAttachmentFile"}><span>{isError ? "Error" : isUploading ? "Uploading" : "File"}</span><strong>{file.name || "File"}</strong>{isError ? <em>Upload failed. Remove and try again.</em> : null}{removeButton}</div>;
  }

  return (
    <section ref={composerRef} className="streamsComposer" aria-label="Streams composer">
      {libraryFiles && libraryFiles.length > 0 ? <div className="streamsComposerAttachments">{libraryFiles.map(renderFileAttachment)}</div> : null}
      {blockedNotice ? <div className="streamsComposerBlockedNotice" role="status">{blockedNotice}</div> : null}
      <div className="streamsComposerRow">
        <button type="button" className="streamsComposerIconButton" aria-label="Open tools" onClick={() => setActiveMenu(activeMenu === "tools" ? "" : "tools")}>+</button>
        {selectedTool ? <div className="streamsComposerToolPill"><span>{selectedTool.icon}</span><strong>{selectedTool.label}</strong><button type="button" className="streamsComposerToolPillClose" aria-label={`Clear ${selectedTool.label}`} onClick={() => setSelectedTool(null)}>x</button></div> : null}
        <textarea ref={inputRef} className="streamsComposerInput" value={message} placeholder={placeholder} rows={1} aria-label="Message Streams AI" spellCheck="true" onChange={(event) => { setMessage(event.target.value); autosizeComposerTextarea(event.target); }} onInput={(event) => autosizeComposerTextarea(event.currentTarget)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} />
        <button type="button" className="streamsComposerPill" aria-label="Open model menu" onClick={() => setActiveMenu(activeMenu === "model" ? "" : "model")}>{mode}⌄</button>
        <button type="button" className="streamsComposerMicButton" aria-label="Start realtime voice conversation" onClick={() => { setActiveMenu(""); setVoicePanelOpen(true); }}>mic</button>
        <button type="button" className="streamsComposerSendButton" aria-label="Send" onClick={submit} disabled={isDisabled}>↑</button>
      </div>
      <input aria-label="Add photos and files" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.json,.md" hidden ref={fileInputRef} onChange={handleFileChange} />
      {activeMenu === "tools" ? <div className="streamsComposerMenu toolsMenu" role="menu">{toolItems.map((item) => <button key={item.id} type="button" disabled={!item.enabled} aria-disabled={!item.enabled} onClick={() => handleTool(item)}><span>{item.icon}</span><strong>{item.label}</strong><em>{item.enabled ? item.shortcut || "" : "Not configured"}</em></button>)}</div> : null}
      {activeMenu === "model" ? <div className="streamsComposerMenu modelMenu" role="menu">{MODES.map((item) => <button key={item} type="button" onClick={() => handleModeSelection(item)}><strong>{item}</strong><em>{item === mode ? "Active" : ""}</em></button>)}</div> : null}
      {voicePanelOpen ? <RealtimeVoicePanel onClose={() => setVoicePanelOpen(false)} /> : null}
    </section>
  );
}
