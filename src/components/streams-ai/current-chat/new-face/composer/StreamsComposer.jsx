import { useEffect, useRef, useState } from "react";
import "./streams-composer.css";
import "./streams-composer-layout-fix.css";
import "./chat-message-text-fix.css";
import RealtimeVoicePanel from "../voice/RealtimeVoicePanel";

const MODES = ["Thinking", "Configure..."];

const BASE_TOOL_ITEMS = [
  { id: "files", icon: "↥", label: "Add photos & files", shortcut: "Ctrl + U", enabled: true },
  { id: "url", icon: "▣", label: "Add link", enabled: true },
  { id: "create_image", icon: "✦", label: "Create image", enabled: true },
  { id: "web_search", icon: "◎", label: "Web search", enabled: true, shortcut: "Live" },
];

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
  const [blockedNotice, setBlockedNotice] = useState("");
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [webSearchStatus, setWebSearchStatus] = useState({
    configured: false,
    blockedReason: "Checking real web search configuration...",
  });

  const composerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const id = "streams-chat-plain-bold-white-text-fix";
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .shell .chatPanel .msg .bubble,
      .shell .chatPanel .msg.user .bubble,
      .shell .chatPanel .msg.assistant .bubble {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        color: #ffffff !important;
        font-size: 17px !important;
        font-weight: 800 !important;
        line-height: 1.55 !important;
        padding: 4px 0 !important;
        border-radius: 0 !important;
      }
      .shell .chatPanel .msg .bubble *,
      .shell .chatPanel .msg.user .bubble *,
      .shell .chatPanel .msg.assistant .bubble * {
        color: #ffffff !important;
        font-weight: 800 !important;
      }
      .shell .chatPanel .msg.user,
      .shell .chatPanel .msg.assistant {
        max-width: 980px !important;
      }
      @media (max-width: 760px) {
        .shell .chatPanel .msg .bubble,
        .shell .chatPanel .msg.user .bubble,
        .shell .chatPanel .msg.assistant .bubble {
          font-size: 15px !important;
          line-height: 1.5 !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/streams-ai/search/status", { method: "GET" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setWebSearchStatus({
          configured: Boolean(data?.configured),
          blockedReason: data?.blockedReason || "OPENAI_API_KEY is required for real web search.",
        });
      })
      .catch(() => {
        if (cancelled) return;
        setWebSearchStatus({
          configured: false,
          blockedReason: "Unable to verify real web search backend configuration.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const toolItems = BASE_TOOL_ITEMS.map((item) => {
    if (item.id !== "web_search") return item;
    return {
      ...item,
      enabled: webSearchStatus.configured,
      shortcut: webSearchStatus.configured ? "Live" : "Not configured",
      blockedReason: webSearchStatus.blockedReason,
    };
  });

  const placeholder = selectedTool
    ? selectedTool.id === "url"
      ? "Paste a link..."
      : selectedTool.id === "create_image"
        ? "Describe the image..."
        : selectedTool.id === "web_search"
          ? "Search the web..."
          : "Ask anything"
    : "Ask anything";

  const hasUploadingFiles = libraryFiles?.some((file) => file.status === "uploading");
  const isDisabled = isStreaming || hasUploadingFiles;

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
    const hasAttachments = libraryFiles && libraryFiles.length > 0;
    if (!value && !hasAttachments) return;

    let finalMessage = value || " ";

    if (selectedTool?.id === "create_image") {
      finalMessage = "Create an image of " + finalMessage;
    }

    if (selectedTool?.id === "url") {
      finalMessage = "Read the URL: " + finalMessage;
    }

    if (selectedTool?.id === "web_search") {
      if (!webSearchStatus.configured) {
        setBlockedNotice(webSearchStatus.blockedReason);
        setSelectedTool(null);
        setActiveMenu("");
        return;
      }

      finalMessage = value;
    }

    onSubmit?.({
      message: finalMessage,
      composerMode: selectedTool?.id === "url" ? "url" : "chat",
      mode,
      webSearchEnabled: selectedTool?.id === "web_search",
    });

    setMessage("");
    setSelectedTool(null);
    setActiveMenu("");
    setBlockedNotice("");
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

    if (item.id === "files") {
      setActiveMenu("");
      setTimeout(() => fileInputRef.current?.click(), 50);
      return;
    }

    if (item.id === "url" || item.id === "create_image" || item.id === "web_search") {
      setSelectedTool((current) => (current?.id === item.id ? null : item));
      setBlockedNotice("");
      setActiveMenu("");
      return;
    }

    onToolSelect?.(item.id);
    setActiveMenu("");
  }

  function renderFileAttachment(file) {
    const isImage = file.kind === "image" || (file.mimeType || "").startsWith("image/");
    const previewUrl = file.url || file.storageUrl || file.publicUrl || file.previewUrl;
    const isUploading = file.status === "uploading";
    const isError = file.status === "error";

    if (isImage && previewUrl) {
      return (
        <div key={file.id} className="streamsComposerAttachmentImage">
          <img src={previewUrl} alt={file.name || "Image"} />
          {isUploading ? <span className="streamsComposerAttachmentOverlay">Uploading</span> : null}
          {isError ? <span className="streamsComposerAttachmentOverlay">⚠️</span> : null}
          {!isUploading ? (
            <button
              type="button"
              aria-label={`Remove ${file.name || "attachment"}`}
              onClick={() => onRemoveFile?.(file.id)}
            >
              ×
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <div key={file.id} className={isError ? "streamsComposerAttachmentFile isError" : "streamsComposerAttachmentFile"}>
        <span>{isError ? "⚠️" : isUploading ? "⏳" : "📄"}</span>
        <strong>{file.name || "File"}</strong>
        {!isUploading ? (
          <button
            type="button"
            aria-label={`Remove ${file.name || "attachment"}`}
            onClick={() => onRemoveFile?.(file.id)}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section ref={composerRef} className="streamsComposer" aria-label="Streams composer">
      {libraryFiles && libraryFiles.length > 0 ? (
        <div className="streamsComposerAttachments">
          {libraryFiles.map(renderFileAttachment)}
        </div>
      ) : null}

      {blockedNotice ? (
        <div className="streamsComposerBlockedNotice" role="status">
          {blockedNotice}
        </div>
      ) : null}

      <div className="streamsComposerRow">
        <button
          type="button"
          className="streamsComposerIconButton"
          aria-label="Open tools"
          onClick={() => setActiveMenu(activeMenu === "tools" ? "" : "tools")}
        >
          +
        </button>

        {selectedTool ? (
          <div className="streamsComposerToolPill">
            <span>{selectedTool.icon}</span>
            <strong>{selectedTool.label}</strong>
            <button
              type="button"
              className="streamsComposerToolPillClose"
              aria-label={`Clear ${selectedTool.label}`}
              onClick={() => setSelectedTool(null)}
            >
              ×
            </button>
          </div>
        ) : null}

        <input
          className="streamsComposerInput"
          value={message}
          placeholder={placeholder}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />

        <button
          type="button"
          className="streamsComposerPill"
          aria-label="Open model menu"
          onClick={() => setActiveMenu(activeMenu === "model" ? "" : "model")}
        >
          {mode}⌄
        </button>

        <button
          type="button"
          className="streamsComposerMicButton"
          aria-label="Start realtime voice conversation"
          onClick={() => {
            setActiveMenu("");
            setVoicePanelOpen(true);
          }}
        >
          🎙
        </button>

        <button type="button" className="streamsComposerSendButton" aria-label="Send" onClick={submit} disabled={isDisabled}>
          ↑
        </button>
      </div>

      <input
        aria-label="Add photos and files"
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.json,.md"
        hidden
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {activeMenu === "tools" ? (
        <div className="streamsComposerMenu toolsMenu" role="menu">
          {toolItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!item.enabled}
              aria-disabled={!item.enabled}
              onClick={() => handleTool(item)}
            >
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
              <em>{item.enabled ? item.shortcut || "" : "Not configured"}</em>
            </button>
          ))}
        </div>
      ) : null}

      {activeMenu === "model" ? (
        <div className="streamsComposerMenu modelMenu" role="menu">
          {MODES.map((item) => (
            <button key={item} type="button" onClick={() => handleModeSelection(item)}>
              <span>{item === mode ? "✓" : ""}</span>
              <strong>{item}</strong>
              <em />
            </button>
          ))}
          <div className="streamsProviderHint">Provider preferences are managed in Account → Personalization.</div>
        </div>
      ) : null}

      <RealtimeVoicePanel open={voicePanelOpen} onClose={() => setVoicePanelOpen(false)} />
    </section>
  );
}
