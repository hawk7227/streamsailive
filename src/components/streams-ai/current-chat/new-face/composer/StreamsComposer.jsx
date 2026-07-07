import { useEffect, useRef, useState } from "react";
import "./streams-composer.css";
import "./streams-composer-layout-fix.css";
import "./chat-message-text-fix.css";
import RealtimeVoicePanel from "../voice/RealtimeVoicePanel";

const MODES = ["Thinking", "Configure..."];
const COMPOSER_TEXTAREA_MIN_HEIGHT = 30;
const COMPOSER_TEXTAREA_MAX_HEIGHT = 168;
const ACCEPTED_UPLOAD_TYPES = "image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.json,.md,.html,.htm,.odt,.rtf,.epub";

const TOOL_ITEMS = [
  { id: "files", icon: "↥", label: "Add photos & files", enabled: true },
  { id: "url", icon: "▣", label: "Add link", enabled: true },
  { id: "create_image", icon: "✦", label: "Create image", enabled: true },
  { id: "web_search", icon: "◎", label: "Web search", enabled: true },
];

function autosizeComposerTextarea(node) {
  if (!node) return;
  node.style.height = "0px";
  const nextHeight = Math.min(COMPOSER_TEXTAREA_MAX_HEIGHT, Math.max(COMPOSER_TEXTAREA_MIN_HEIGHT, node.scrollHeight));
  node.style.height = `${nextHeight}px`;
  node.style.overflowY = node.scrollHeight > COMPOSER_TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
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
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    autosizeComposerTextarea(inputRef.current);
  }, [message, selectedTool]);

  useEffect(() => {
    if (!activeMenu) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setActiveMenu("");
    };
    const closeOnOutside = (event) => {
      if (!composerRef.current) return;
      if (!composerRef.current.contains(event.target)) setActiveMenu("");
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [activeMenu]);

  const readyAttachments = Array.isArray(libraryFiles) ? libraryFiles.filter((file) => file.status !== "uploading") : [];
  const hasUploadingFiles = Array.isArray(libraryFiles) && libraryFiles.some((file) => file.status === "uploading");
  const isDisabled = isStreaming || hasUploadingFiles;

  const placeholder = selectedTool
    ? selectedTool.id === "url"
      ? "Paste a link..."
      : selectedTool.id === "create_image"
        ? "Describe the image..."
        : selectedTool.id === "web_search"
          ? "Search the web..."
          : "Ask anything"
    : "Ask anything";

  function clearInput() {
    setMessage("");
    window.requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.value = "";
      inputRef.current.style.height = `${COMPOSER_TEXTAREA_MIN_HEIGHT}px`;
      inputRef.current.style.overflowY = "hidden";
    });
  }

  function submit() {
    if (isDisabled) return;
    const value = message.trim();
    const hasAttachments = readyAttachments.length > 0;
    if (!value && !hasAttachments) return;

    let finalMessage = value || `Review the attached file${readyAttachments.length === 1 ? "" : "s"}.`;
    if (selectedTool?.id === "create_image") finalMessage = `Create an image of ${finalMessage}`;
    if (selectedTool?.id === "url") finalMessage = `Read the URL: ${finalMessage}`;

    clearInput();
    setSelectedTool(null);
    setActiveMenu("");
    onSubmit?.({
      message: finalMessage,
      composerMode: selectedTool?.id === "url" ? "url" : "chat",
      mode,
      webSearchEnabled: selectedTool?.id === "web_search",
    });
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) onFilesSelected?.(files);
    event.target.value = "";
    setActiveMenu("");
  }

  function handleTool(item) {
    if (item.id === "files") {
      setActiveMenu("");
      setTimeout(() => fileInputRef.current?.click(), 40);
      return;
    }
    if (item.id === "url" || item.id === "create_image" || item.id === "web_search") {
      setSelectedTool((current) => (current?.id === item.id ? null : item));
      setActiveMenu("");
      return;
    }
    onToolSelect?.(item.id);
    setActiveMenu("");
  }

  function renderAttachment(file) {
    const isImage = file.kind === "image" || String(file.mimeType || "").startsWith("image/");
    const previewUrl = file.url || file.storageUrl || file.publicUrl || file.previewUrl;
    if (isImage && previewUrl) {
      return (
        <div key={file.id} className="streamsComposerAttachmentImage">
          <img src={previewUrl} alt={file.name || "Image"} />
          <button type="button" aria-label={`Remove ${file.name || "attachment"}`} onClick={() => onRemoveFile?.(file.id)}>×</button>
        </div>
      );
    }
    return (
      <div key={file.id} className="streamsComposerAttachmentFile">
        <span>📄</span>
        <strong>{file.name || "File"}</strong>
        <button type="button" aria-label={`Remove ${file.name || "attachment"}`} onClick={() => onRemoveFile?.(file.id)}>×</button>
      </div>
    );
  }

  return (
    <section ref={composerRef} className="streamsComposer" aria-label="Streams composer">
      {libraryFiles?.length ? <div className="streamsComposerAttachments">{libraryFiles.map(renderAttachment)}</div> : null}

      <div className="streamsComposerRow">
        <button type="button" className="streamsComposerIconButton" aria-label="Open tools" onClick={() => setActiveMenu(activeMenu === "tools" ? "" : "tools")}>+</button>

        {selectedTool ? (
          <div className="streamsComposerToolPill">
            <span>{selectedTool.icon}</span>
            <strong>{selectedTool.label}</strong>
            <button type="button" className="streamsComposerToolPillClose" aria-label={`Clear ${selectedTool.label}`} onClick={() => setSelectedTool(null)}>×</button>
          </div>
        ) : null}

        <textarea
          ref={inputRef}
          className="streamsComposerInput"
          value={message}
          placeholder={placeholder}
          rows={1}
          aria-label="Message Streams AI"
          spellCheck="true"
          onChange={(event) => {
            setMessage(event.target.value);
            autosizeComposerTextarea(event.target);
          }}
          onInput={(event) => autosizeComposerTextarea(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />

        <button type="button" className="streamsComposerPill" aria-label="Open model menu" onClick={() => setActiveMenu(activeMenu === "model" ? "" : "model")}>{mode}⌄</button>
        <button type="button" className="streamsComposerMicButton" aria-label="Start realtime voice conversation" onClick={() => { setActiveMenu(""); setVoicePanelOpen(true); }}>🎙</button>
        <button type="button" className="streamsComposerSendButton" aria-label="Send" onClick={submit} disabled={isDisabled}>↑</button>
      </div>

      <input aria-label="Add photos and files" type="file" multiple accept={ACCEPTED_UPLOAD_TYPES} hidden ref={fileInputRef} onChange={handleFileChange} />

      {activeMenu === "tools" ? (
        <div className="streamsComposerMenu toolsMenu" role="menu">
          {TOOL_ITEMS.map((item) => (
            <button key={item.id} type="button" onClick={() => handleTool(item)}>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
              <em>{item.id === "web_search" ? "Live" : ""}</em>
            </button>
          ))}
        </div>
      ) : null}

      {activeMenu === "model" ? (
        <div className="streamsComposerMenu modelMenu" role="menu">
          {MODES.map((item) => (
            <button key={item} type="button" onClick={() => {
              setActiveMenu("");
              if (item === "Configure...") window.location.assign("/account/personalization");
              else {
                setMode(item);
                onModeChange?.(item);
              }
            }}>
              <strong>{item}</strong>
              <em>{item === mode ? "Active" : ""}</em>
            </button>
          ))}
        </div>
      ) : null}

      {voicePanelOpen ? <RealtimeVoicePanel onClose={() => setVoicePanelOpen(false)} /> : null}
    </section>
  );
}
