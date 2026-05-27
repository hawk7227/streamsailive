import { useEffect, useRef, useState } from "react";
import "./streams-composer.css";

const MODES = ["Thinking", "Configure..."];

const TOOL_ITEMS = [
  { id: "files", icon: "↥", label: "Add photos & files", shortcut: "Ctrl + U" },
  { id: "url", icon: "▣", label: "Add link" },
  { id: "create_image", icon: "✦", label: "Create image" },
  { id: "web_search", icon: "◎", label: "Web search" },
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
  const [composerMode, setComposerMode] = useState("chat");
  const [mode, setMode] = useState("Thinking");

  function handleModeSelection(nextMode) {
    setActiveMenu("");

    if (nextMode === "Configure...") {
      window.location.assign("/account/personalization");
      return;
    }

    setMode(nextMode);
    onModeChange?.(nextMode);
  }
  const [selectedTool, setSelectedTool] = useState(null);
  const fileInputRef = useRef(null);

  const placeholder = selectedTool ? (selectedTool.id === "url" ? "Paste a link..." : selectedTool.id === "web_search" ? "Search the web" : "Describe the image...") : "Ask anything";

  const hasUploadingFiles = libraryFiles && libraryFiles.some(file => file.status === "uploading");
  const isDisabled = isStreaming || hasUploadingFiles;

  function submit() {
    if (isDisabled) return;
    const value = message.trim();
    const hasAttachments = libraryFiles && libraryFiles.length > 0;
    if (!value && !hasAttachments) return;
    
    let finalMessage = value || " ";
    if (selectedTool?.id === "create_image") finalMessage = "Create an image of " + finalMessage;
    if (selectedTool?.id === "web_search") finalMessage = "Search the web for " + finalMessage;
    if (selectedTool?.id === "url") finalMessage = "Read the URL: " + finalMessage;

    onSubmit?.({ message: finalMessage, composerMode: selectedTool?.id === "url" ? "url" : "chat", provider, mode });
    setMessage("");
    setSelectedTool(null);
    setComposerMode("chat");
    setActiveMenu("");
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) onFilesSelected?.(files);
    event.target.value = "";
    setActiveMenu("");
  }

  function handleTool(item) {
    if (item.id === "files") {
      setActiveMenu(""); // close the menu first
      // Use setTimeout to let the menu close before triggering the file dialog
      setTimeout(() => fileInputRef.current?.click(), 50);
      return;
    }
    if (item.id === "url" || item.id === "create_image" || item.id === "web_search") {
      if (selectedTool?.id === item.id) {
        setSelectedTool(null); // Toggle off
      } else {
        setSelectedTool(item);
      }
      setActiveMenu("");
      return;
    }
    onToolSelect?.(item.id);
    setActiveMenu("");
  }

  useEffect(() => {
    const streamsComposerEscapeClose = (event) => {
      if (event.key === "Escape") setModeMenuOpen(false);
    };
    window.addEventListener("keydown", streamsComposerEscapeClose);
    return () => window.removeEventListener("keydown", streamsComposerEscapeClose);
  }, []);

  return (
    <section 
      className="streamsComposer" 
      aria-label="Streams composer"
      style={libraryFiles && libraryFiles.length > 0 ? {
        flexDirection: "column",
        alignItems: "stretch",
        borderRadius: "24px",
        padding: "12px 14px 6px 14px"
      } : {}}
    >
      {libraryFiles && libraryFiles.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid rgba(0,0,0,0.07)", paddingBottom: "10px", marginBottom: "8px", alignItems: "flex-end" }}>
          {libraryFiles.map(file => {
            const isImage = file.kind === "image" || (file.mimeType || "").startsWith("image/");
            const previewUrl = file.url || file.storageUrl || file.publicUrl || file.previewUrl;
            const isUploading = file.status === "uploading";
            const isError = file.status === "error";
            if (isImage && previewUrl) {
              useEffect(() => {
    const streamsComposerEscapeClose = (event) => {
      if (event.key === "Escape") setModeMenuOpen(false);
    };
    window.addEventListener("keydown", streamsComposerEscapeClose);
    return () => window.removeEventListener("keydown", streamsComposerEscapeClose);
  }, []);

  return (
                <div key={file.id} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", width: "64px", height: "64px", flexShrink: 0 }}>
                  <img
                    src={previewUrl}
                    alt={file.name || "Image"}
                    style={{ width: "64px", height: "64px", objectFit: "cover", display: "block", borderRadius: "10px", opacity: isUploading ? 0.6 : 1, filter: isError ? "brightness(0.5) saturate(0)" : "none" }}
                  />
                  {isUploading && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.9s linear infinite" }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    </div>
                  )}
                  {isError && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>⚠️</div>
                  )}
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => onRemoveFile?.(file.id)}
                      style={{
                        position: "absolute", top: "2px", right: "2px",
                        background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer",
                        borderRadius: "50%", width: "18px", height: "18px",
                        color: "#fff", fontSize: "11px", display: "flex",
                        alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            }
            useEffect(() => {
    const streamsComposerEscapeClose = (event) => {
      if (event.key === "Escape") setModeMenuOpen(false);
    };
    window.addEventListener("keydown", streamsComposerEscapeClose);
    return () => window.removeEventListener("keydown", streamsComposerEscapeClose);
  }, []);

  return (
              <div key={file.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px", background: isError ? "rgba(220,50,50,0.1)" : "rgba(0,0,0,0.06)", padding: "5px 10px 5px 8px", borderRadius: "10px", fontSize: "12px", color: "#333", maxWidth: "160px" }}>
                <span style={{ fontSize: "18px", flexShrink: 0 }}>{isError ? "⚠️" : isUploading ? "⏳" : "📄"}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name || "File"}</span>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => onRemoveFile?.(file.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#888", padding: "0 0 0 4px", lineHeight: 1, flexShrink: 0 }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="streamsComposerRow">
        <button
          type="button"
          className="streamsComposerIconButton"
          aria-label="Open tools"
          onClick={() => setActiveMenu(activeMenu === "tools" ? "" : "tools")}
        >
          +
        </button>

        {selectedTool && (
          <div className="streamsComposerToolPill">
            <span style={{ fontSize: "14px", marginRight: "4px" }}>{selectedTool.icon}</span>
            <span>{selectedTool.label}</span>
            <button
              type="button"
              className="streamsComposerToolPillClose"
              onClick={() => setSelectedTool(null)}
            >
              ×
            </button>
          </div>
        )}

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
        <button type="button" className="streamsComposerSendButton" aria-label="Send" onClick={submit} disabled={isDisabled}>↑</button>
      </div>

      <input
        aria-label="Add photos and files"
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.json,.md"
        style={{ display: "none", position: "absolute", pointerEvents: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {activeMenu === "tools" && (
        <div className="streamsComposerMenu toolsMenu" role="menu">
          {TOOL_ITEMS.map((item) => (
            <button key={item.id} type="button" onClick={() => handleTool(item)}>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
              <em>{item.shortcut || (item.arrow ? "›" : "")}</em>
            </button>
          ))}
        </div>
      )}



      {activeMenu === "model" && (
        <div className="streamsComposerMenu modelMenu" role="menu">
          {MODES.map((item) => (
            <button key={item} type="button" onClick={() => handleModeSelection(item)}>
              <span>{item === mode ? "✓" : ""}</span><strong>{item}</strong><em />
            </button>
          ))}
          <div className="streamsProviderHint">Provider preferences are managed in Account → Personalization.</div>
        </div>
      )}
    </section>
  );
}
