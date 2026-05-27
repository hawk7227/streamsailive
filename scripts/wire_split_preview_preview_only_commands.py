from pathlib import Path

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

# ---------------------------------------------------------------------
# 1. Extend split preview bridge with source extraction + safe preview HTML.
# ---------------------------------------------------------------------
bridge_path = "src/components/streams-ai/current-chat/new-face/runtime/streamsSplitPreviewBridge.js"
s = read(bridge_path)

if "export function extractPreviewSourceFromText" not in s:
    s += '''

export function extractPreviewSourceFromText(text = "") {
  const value = String(text || "");

  const fenced = value.match(/```(?:html|tsx|jsx|react|javascript|js|typescript|ts)?\\s*([\\s\\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim();
  }

  const htmlStart = value.search(/<!doctype html|<html[\\s>]|<body[\\s>]|<main[\\s>]|<section[\\s>]|<div[\\s>]/i);
  if (htmlStart >= 0) {
    return value.slice(htmlStart).trim();
  }

  return "";
}

export function inferPreviewKindFromSource(source = "") {
  const value = String(source || "").trim();

  if (/<!doctype html|<html[\\s>]/i.test(value)) return "html";
  if (/export\\s+default\\s+function|function\\s+[A-Z]|const\\s+[A-Z].*=>|className=/s.test(value)) return "tsx";
  if (/<svg[\\s>]/i.test(value)) return "svg";

  return "html";
}

export function createPreviewHtmlFromSource(source = "", title = "Preview") {
  const value = String(source || "").trim();

  if (/<!doctype html|<html[\\s>]/i.test(value)) {
    return value;
  }

  if (/<svg[\\s>]/i.test(value)) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b10;color:white}</style></head><body>${value}</body></html>`;
  }

  if (/<[a-z][\\s\\S]*>/i.test(value) && !/export\\s+default|className=/.test(value)) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;font-family:Inter,system-ui;background:#f7f7f8;color:#111}</style></head><body>${value}</body></html>`;
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top left, rgba(124,58,237,.2), transparent 35%), #0b0b10;
        color: white;
      }
      main {
        width: min(760px, calc(100vw - 36px));
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 30px;
        background: rgba(255,255,255,.08);
        padding: 30px;
        box-shadow: 0 30px 90px rgba(0,0,0,.35);
      }
      pre {
        white-space: pre-wrap;
        overflow: auto;
        color: rgba(255,255,255,.82);
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(34px, 8vw, 72px);
        line-height: .9;
        letter-spacing: -.07em;
      }
      p {
        color: rgba(255,255,255,.68);
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>This preview-only request was routed into Split Preview. Source is hidden by default.</p>
      ${value ? `<pre>${value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]))}</pre>` : ""}
    </main>
  </body>
</html>`;
}

export function openPreviewOnlyArtifact({ message = "", title = "Preview-only result" } = {}) {
  const sourceCode = extractPreviewSourceFromText(message);
  const kind = inferPreviewKindFromSource(sourceCode);
  const previewHtml = createPreviewHtmlFromSource(sourceCode, title);

  openStreamsSplitPreview({
    title,
    kind,
    sourceVisible: false,
    conversationCodeSuppressed: true,
    sourceCode,
    previewHtml,
  });

  return {
    sourceCode,
    kind,
    previewHtml,
  };
}
'''

write(bridge_path, s)

# ---------------------------------------------------------------------
# 2. Wire preview-only branch into useStreamsChatRuntime.
# ---------------------------------------------------------------------
runtime_path = "src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js"
r = read(runtime_path)

if "openPreviewOnlyArtifact" not in r:
    # Prefer existing split preview import location if present.
    if 'from "../runtime/streamsSplitPreviewBridge";' in r:
        r = r.replace(
            'from "../runtime/streamsSplitPreviewBridge";',
            'openPreviewOnlyArtifact, isPreviewOnlyRequest } from "../runtime/streamsSplitPreviewBridge";'
        )
        r = r.replace('import { openPreviewOnlyArtifact, isPreviewOnlyRequest }', 'import { openPreviewOnlyArtifact, isPreviewOnlyRequest }')
    else:
        marker = 'import { emitStreamsActivity } from "../runtime/streamsGlobalActivityBridge";'
        if marker in r:
            r = r.replace(
                marker,
                marker + '\\nimport { openPreviewOnlyArtifact, isPreviewOnlyRequest } from "../runtime/streamsSplitPreviewBridge";',
                1
            )
        else:
            marker = 'import { usePathname } from "next/navigation";'
            if marker not in r:
                raise SystemExit("Could not find import marker in useStreamsChatRuntime.js")
            r = r.replace(
                marker,
                marker + '\\nimport { openPreviewOnlyArtifact, isPreviewOnlyRequest } from "../runtime/streamsSplitPreviewBridge";',
                1
            )

# Defensive repair if import got malformed.
r = r.replace('import { openPreviewOnlyArtifact, isPreviewOnlyRequest }openPreviewOnlyArtifact, isPreviewOnlyRequest }', 'import { openPreviewOnlyArtifact, isPreviewOnlyRequest }')

branch = '''    const requestedPreviewOnly = isPreviewOnlyRequest(trimmed);

    if (requestedPreviewOnly) {
      const previewTitle = trimmed.length > 90 ? "Preview-only result" : trimmed || "Preview-only result";
      openPreviewOnlyArtifact({
        message: trimmed,
        title: previewTitle,
      });

      setActivity(createActivity("complete", "preview", "Opened in split preview"));
      setMessages((current) => completeStatusMessage(
        current,
        assistantId,
        "Opened in Split Preview. Source is hidden by default; use Show source inside the preview panel if you need to inspect it.",
        {
          previewOnly: true,
          conversationCodeSuppressed: true,
          status: "complete",
        }
      ));

      refreshSidebarData();
      return;
    }

'''

if "const requestedPreviewOnly = isPreviewOnlyRequest(trimmed);" not in r:
    marker = "    const requestedWebSearch ="
    if marker not in r:
        raise SystemExit("requestedWebSearch insertion marker not found")
    r = r.replace(marker, branch + marker, 1)

write(runtime_path, r)

# ---------------------------------------------------------------------
# 3. Add preview-only examples to the proof button tooltip/text.
# ---------------------------------------------------------------------
proof_path = "src/components/streams-ai/current-chat/new-face/preview/StreamsSplitPreviewProofButton.jsx"
if Path(proof_path).exists():
    p = read(proof_path)
    p = p.replace(
        ">\\n      Open split preview\\n    </button>",
        ' title="Preview-only commands: show in preview, no code in conversation, render it">\\n      Open split preview\\n    </button>'
    )
    write(proof_path, p)

print("Wired split preview to preview-only chat commands.")
