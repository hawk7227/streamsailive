import { useRef, useState } from "react";
import "./streams-composer.css";

const PROVIDERS = ["Auto", "fal.ai", "Runway", "Kling", "Veo", "ElevenLabs"];
const MODES = ["Instant", "Thinking", "Pro", "Configure..."];

const TOOL_ITEMS = [
  { id: "files", icon: "↥", label: "Add photos & files", shortcut: "Ctrl + U" },
  { id: "url", icon: "▣", label: "Add link" },
  { id: "recent_files", icon: "▤", label: "Recent files", arrow: true },
  { id: "create_image", icon: "✦", label: "Create image" },
  { id: "deep_research", icon: "⌕", label: "Deep research" },
  { id: "web_search", icon: "◎", label: "Web search" },
  { id: "more", icon: "…", label: "More", arrow: true },
];

export default function StreamsComposer({
  onSubmit,
  onFilesSelected,
  onToolSelect,
  onProviderChange,
  onModeChange,
}) {
  const [message, setMessage] = useState("");
  const [activeMenu, setActiveMenu] = useState("");
  const [composerMode, setComposerMode] = useState("chat");
  const [provider, setProvider] = useState("Auto");
  const [mode, setMode] = useState("Thinking");
  const fileInputRef = useRef(null);

  const placeholder = composerMode === "url" ? "Paste a link to analyze..." : "Ask anything";

  function submit() {
    const value = message.trim();
    if (!value) return;
    onSubmit?.({ message: value, composerMode, provider, mode });
    setMessage("");
    setComposerMode("chat");
    setActiveMenu("");
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) onFilesSelected?.(files);
    event.target.value = "";
    setActiveMenu("");
  }

  function activateLinkMode() {
    setComposerMode("url");
    setActiveMenu("");
  }

  function handleTool(item) {
    if (item.id === "files") return fileInputRef.current?.click();
    if (item.id === "url") return activateLinkMode();
    if (item.id === "more") return setActiveMenu("more");
    onToolSelect?.(item.id);
    setActiveMenu("");
  }

  return (
    <section className="streamsComposer" aria-label="Streams composer">
      <div className="streamsComposerRow">
        <button
          type="button"
          className="streamsComposerIconButton"
          aria-label="Open tools"
          onClick={() => setActiveMenu(activeMenu === "tools" ? "" : "tools")}
        >
          +
        </button>

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

        <button type="button" className="streamsComposerIconButton" aria-label="Voice">⌕</button>
        <button type="button" className="streamsComposerSendButton" aria-label="Send" onClick={submit}>↑</button>
      </div>

      <input
        aria-label="Add photos and files"
        type="file"
        multiple
        hidden
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {activeMenu === "tools" && (
        <div className="streamsComposerMenu" role="menu">
          {TOOL_ITEMS.map((item) => (
            <button key={item.id} type="button" onClick={() => handleTool(item)}>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
              <em>{item.shortcut || (item.arrow ? "›" : "")}</em>
            </button>
          ))}
        </div>
      )}

      {activeMenu === "more" && (
        <div className="streamsComposerMenu" role="menu">
          <button type="button" onClick={() => onToolSelect?.("agent_mode")}><span>◇</span><strong>Agent mode</strong><em /></button>
          <button type="button" onClick={() => onToolSelect?.("add_sources")}><span>＋</span><strong>Add sources</strong><em /></button>
          <button type="button" onClick={() => onToolSelect?.("canvas_editor")}><span>▱</span><strong>Canvas / Editor</strong><em /></button>
          <button type="button" onClick={() => onToolSelect?.("github")}><span>⌘</span><strong>GitHub</strong><em /></button>
          <button type="button" onClick={activateLinkMode}><span>▣</span><strong>Read URL</strong><em /></button>
        </div>
      )}

      {activeMenu === "model" && (
        <div className="streamsComposerMenu modelMenu" role="menu">
          {MODES.map((item) => (
            <button key={item} type="button" onClick={() => { setMode(item); onModeChange?.(item); setActiveMenu(""); }}>
              <span>{item === mode ? "✓" : ""}</span><strong>{item}</strong><em />
            </button>
          ))}
          <div className="streamsProviderHint">Providers</div>
          {PROVIDERS.map((item) => (
            <button key={item} type="button" onClick={() => { setProvider(item); onProviderChange?.(item); setActiveMenu(""); }}>
              <span>{item === provider ? "✓" : ""}</span><strong>{item}</strong><em />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
