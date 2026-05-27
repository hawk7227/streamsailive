from pathlib import Path

p = Path("src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx")
s = p.read_text(encoding="utf-8")

# Add auto-open policy helper after openAssistantMessageInPreview helper block.
if "function shouldAutoOpenPreviewForAssistantMessage" not in s:
    marker = "function ChatInlineImage({ src, alt }) {"
    if marker not in s:
        raise SystemExit("ChatInlineImage marker not found.")

    helper = r'''
function shouldAutoOpenPreviewForAssistantMessage(message) {
  if (!message || message.role !== "assistant") return false;
  if (message.isStreaming) return false;
  if (message.isStatusOnly) return false;
  if (message.status && message.status !== "complete") return false;

  const content = String(message.content || message.text || "");

  if (!content.trim()) return false;

  const source = extractPreviewSource(content);
  if (!source) return false;

  // Auto-open only for visual/source artifacts.
  if (/<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]|<svg[\s>]/i.test(source)) {
    return true;
  }

  if (/export\s+default|className=|function\s+[A-Z]|const\s+[A-Z][A-Za-z0-9_]*\s*=/.test(source)) {
    return true;
  }

  return false;
}

'''
    s = s.replace(marker, helper + marker, 1)

# Add auto-open state/effect inside StreamsWorkspaceShell component.
if "lastAutoPreviewMessageId" not in s:
    state_marker = "const [previewOpen, setPreviewOpen] = useState(false);"
    if state_marker not in s:
        raise SystemExit("previewOpen state marker not found.")

    s = s.replace(
        state_marker,
        state_marker + '\n  const [lastAutoPreviewMessageId, setLastAutoPreviewMessageId] = useState("");',
        1
    )

    effect_marker = "const [mode, setMode] = useState(\"start\");"
    if effect_marker not in s:
        raise SystemExit("mode state marker not found.")

    line_end = s.find("\n", s.find(effect_marker))

    effect = r'''
  useEffect(() => {
    const messages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];

    if (!messages.length) return;

    const latestAssistant = [...messages]
      .reverse()
      .find((message) => shouldAutoOpenPreviewForAssistantMessage(message));

    if (!latestAssistant) return;
    if (latestAssistant.id === lastAutoPreviewMessageId) return;

    const opened = openAssistantMessageInPreview(
      latestAssistant.content || latestAssistant.text || "",
      "Assistant Preview"
    );

    if (opened) {
      setPreviewOpen(true);
      setLastAutoPreviewMessageId(latestAssistant.id);
    }
  }, [chatRuntime?.messages, lastAutoPreviewMessageId]);

'''
    s = s[:line_end + 1] + effect + s[line_end + 1:]

p.write_text(s, encoding="utf-8")
print("added safe post-response auto-open preview policy")
