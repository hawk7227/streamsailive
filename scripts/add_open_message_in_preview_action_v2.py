from pathlib import Path

p = Path("src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx")
s = p.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1. Add passive preview helpers before ChatInlineImage.
# ------------------------------------------------------------
helper_marker = "function ChatInlineImage({ src, alt }) {"

helpers = r'''
const STREAMS_SPLIT_PREVIEW_EVENT = "streams:split-preview";
const STREAMS_SPLIT_PREVIEW_LAST_KEY = "streams:split-preview:last";

function hasPreviewableContent(content = "") {
  const value = String(content || "");
  return /```(?:html|tsx|jsx|react|javascript|js|typescript|ts)?[\s\S]*?```/i.test(value)
    || /<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]|<svg[\s>]/i.test(value);
}

function extractPreviewSource(content = "") {
  const value = String(content || "");
  const fenced = value.match(/```(?:html|tsx|jsx|react|javascript|js|typescript|ts)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]?.trim()) return fenced[1].trim();

  const htmlStart = value.search(/<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]|<svg[\s>]/i);
  return htmlStart >= 0 ? value.slice(htmlStart).trim() : "";
}

function escapePreviewText(value = "") {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPreviewHtmlFromSource(source = "") {
  const value = String(source || "").trim();

  if (/<!doctype html|<html[\s>]/i.test(value)) return value;

  if (/<svg[\s>]/i.test(value)) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b10;color:white}</style></head><body>${value}</body></html>`;
  }

  if (/<[a-z][\s\S]*>/i.test(value) && !/export\s+default|className=/.test(value)) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;font-family:Inter,system-ui;background:#f7f7f8;color:#111}</style></head><body>${value}</body></html>`;
  }

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui;background:#0b0b10;color:white}main{width:min(760px,calc(100vw - 36px));border:1px solid rgba(255,255,255,.14);border-radius:30px;background:rgba(255,255,255,.08);padding:30px}pre{white-space:pre-wrap;overflow:auto;color:rgba(255,255,255,.82)}</style></head><body><main><pre>${escapePreviewText(value || "No previewable source was found.")}</pre></main></body></html>`;
}

function openAssistantMessageInPreview(content = "", title = "Assistant Preview") {
  if (typeof window === "undefined") return false;

  const sourceCode = extractPreviewSource(content);
  if (!sourceCode) return false;

  const detail = {
    action: "open",
    id: `assistant_preview_${Date.now()}`,
    title,
    kind: /export\s+default|className=/.test(sourceCode) ? "tsx" : "html",
    sourceVisible: false,
    conversationCodeSuppressed: true,
    previewPanelOpen: true,
    sourceCode,
    previewHtml: buildPreviewHtmlFromSource(sourceCode),
    repoFullName: "",
    branch: "",
    filePath: "assistant-message",
    fileSha: "",
  };

  try {
    window.sessionStorage.setItem(STREAMS_SPLIT_PREVIEW_LAST_KEY, JSON.stringify(detail));
  } catch {}

  window.dispatchEvent(new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, { detail }));
  return true;
}

'''

if "function openAssistantMessageInPreview" not in s:
    if helper_marker not in s:
        raise SystemExit("ChatInlineImage marker not found.")
    s = s.replace(helper_marker, helpers + "\n" + helper_marker, 1)

# ------------------------------------------------------------
# 2. Open preview pane when the preview event fires.
# ------------------------------------------------------------
preview_state_marker = 'const [previewOpen, setPreviewOpen] = useState(false);'

if "[STREAMS_PREVIEW_EVENT_OPEN_PANE]" not in s:
    if preview_state_marker not in s:
        raise SystemExit("previewOpen state marker not found.")

    line_end = s.find("\n", s.find(preview_state_marker))
    listener = r'''
  useEffect(() => {
    const handler = (event) => {
      if (event?.detail?.action === "open") {
        console.info("[STREAMS_PREVIEW_EVENT_OPEN_PANE]", event.detail?.title || "Preview");
        setPreviewOpen(true);
      }
    };

    window.addEventListener(STREAMS_SPLIT_PREVIEW_EVENT, handler);
    return () => window.removeEventListener(STREAMS_SPLIT_PREVIEW_EVENT, handler);
  }, []);
'''
    s = s[:line_end + 1] + listener + s[line_end + 1:]

# ------------------------------------------------------------
# 3. Patch AssistantActions real JSX.
# The current file has: const text = String(message?.content || message?.text || "");
# and <div className="assistantMessageActions" ...>
# ------------------------------------------------------------
if "aria-label=\"Open in Preview\"" not in s:
    anchor = '''      <button type="button" aria-label="Regenerate response" onClick={regenerate}>'''
    if anchor not in s:
        raise SystemExit("Regenerate button anchor not found.")

    preview_button = r'''      {hasPreviewableContent(text) ? (
        <button
          type="button"
          aria-label="Open in Preview"
          onClick={() => {
            const opened = openAssistantMessageInPreview(text, "Assistant Preview");
            if (!opened) setStatus("No previewable content found.");
          }}
        >
          <Icon name="panel"/>
          <span>Preview</span>
        </button>
      ) : null}

'''
    s = s.replace(anchor, preview_button + anchor, 1)

p.write_text(s, encoding="utf-8")
print("added assistant Open in Preview action safely")
