from pathlib import Path

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

# ------------------------------------------------------------
# 1. Split preview bridge
# ------------------------------------------------------------
write("src/components/streams-ai/current-chat/new-face/runtime/streamsSplitPreviewBridge.js", '''export const STREAMS_SPLIT_PREVIEW_EVENT = "streams:split-preview";

export function openStreamsSplitPreview(payload = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, {
      detail: {
        action: "open",
        id: payload.id || `preview_${Date.now()}`,
        title: payload.title || "Preview",
        kind: payload.kind || "html",
        sourceVisible: Boolean(payload.sourceVisible),
        conversationCodeSuppressed: payload.conversationCodeSuppressed !== false,
        previewPanelOpen: true,
        sourceCode: payload.sourceCode || "",
        previewHtml: payload.previewHtml || "",
        repoFullName: payload.repoFullName || "",
        branch: payload.branch || "",
        filePath: payload.filePath || "",
        fileSha: payload.fileSha || "",
      },
    })
  );
}

export function closeStreamsSplitPreview() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, {
      detail: {
        action: "close",
      },
    })
  );
}

export function updateStreamsSplitPreview(payload = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, {
      detail: {
        action: "update",
        ...payload,
      },
    })
  );
}

export function subscribeToStreamsSplitPreview(listener) {
  if (typeof window === "undefined") return () => {};

  const handler = (event) => {
    listener(event.detail || {});
  };

  window.addEventListener(STREAMS_SPLIT_PREVIEW_EVENT, handler);
  return () => window.removeEventListener(STREAMS_SPLIT_PREVIEW_EVENT, handler);
}

export function isPreviewOnlyRequest(text = "") {
  return /\\b(show in preview|preview only|render it|visual only|frontend only|hide code|no code in conversation|open preview|split preview)\\b/i.test(
    String(text || "")
  );
}
''')

# ------------------------------------------------------------
# 2. Split preview panel
# ------------------------------------------------------------
write("src/components/streams-ai/current-chat/new-face/preview/StreamsSplitPreview.jsx", '''"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeToStreamsSplitPreview } from "../runtime/streamsSplitPreviewBridge";
import "./streams-split-preview.css";

const EMPTY_PREVIEW = `<!doctype html>
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
        background: radial-gradient(circle at top left, rgba(124,58,237,.18), transparent 34%), #0b0b10;
        color: white;
      }
      main {
        width: min(720px, calc(100vw - 36px));
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 28px;
        background: rgba(255,255,255,.08);
        padding: 32px;
        box-shadow: 0 30px 100px rgba(0,0,0,.35);
      }
      h1 { margin: 0 0 10px; letter-spacing: -.06em; font-size: clamp(34px, 8vw, 76px); line-height: .9; }
      p { color: rgba(255,255,255,.72); line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Split Preview</h1>
      <p>Select or generate a preview artifact. Source stays hidden by default for preview-only requests.</p>
    </main>
  </body>
</html>`;

function buildSrcDoc(previewHtml, sourceCode, kind) {
  if (previewHtml && String(previewHtml).trim()) return previewHtml;

  if (kind === "html" && sourceCode && String(sourceCode).trim()) {
    return sourceCode;
  }

  return EMPTY_PREVIEW;
}

export default function StreamsSplitPreview() {
  const [state, setState] = useState({
    open: false,
    id: "",
    title: "Preview",
    kind: "html",
    sourceVisible: false,
    conversationCodeSuppressed: true,
    previewHtml: "",
    sourceCode: "",
    repoFullName: "",
    branch: "",
    filePath: "",
    fileSha: "",
  });

  useEffect(() => {
    return subscribeToStreamsSplitPreview((event) => {
      if (event.action === "close") {
        setState((current) => ({ ...current, open: false }));
        return;
      }

      if (event.action === "open") {
        setState((current) => ({
          ...current,
          ...event,
          open: true,
        }));
        return;
      }

      if (event.action === "update") {
        setState((current) => ({
          ...current,
          ...event,
          open: event.open ?? current.open,
        }));
      }
    });
  }, []);

  const srcDoc = useMemo(
    () => buildSrcDoc(state.previewHtml, state.sourceCode, state.kind),
    [state.previewHtml, state.sourceCode, state.kind]
  );

  if (!state.open) return null;

  return (
    <aside className="streamsSplitPreview" aria-label="Split preview panel">
      <header className="streamsSplitPreviewHeader">
        <div>
          <p>STREAMS Preview</p>
          <h2>{state.title || "Preview"}</h2>
          <span>
            {state.repoFullName ? `${state.repoFullName} · ` : ""}
            {state.branch ? `${state.branch} · ` : ""}
            {state.filePath || state.kind}
          </span>
        </div>

        <div className="streamsSplitPreviewActions">
          <button
            type="button"
            onClick={() => setState((current) => ({ ...current, sourceVisible: !current.sourceVisible }))}
          >
            {state.sourceVisible ? "Hide source" : "Show source"}
          </button>
          <button type="button" onClick={() => setState((current) => ({ ...current, open: false }))}>
            Close
          </button>
        </div>
      </header>

      <section className="streamsSplitPreviewBody">
        <div className="streamsSplitPreviewFrameWrap">
          <div className="streamsPhoneChrome">
            <div className="streamsPhoneIsland" />
            <iframe
              title={state.title || "STREAMS Preview"}
              sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              srcDoc={srcDoc}
            />
          </div>
        </div>

        {state.sourceVisible ? (
          <pre className="streamsSplitPreviewSource">
            <code>{state.sourceCode || state.previewHtml || "No source available for this preview."}</code>
          </pre>
        ) : (
          <div className="streamsSplitPreviewSourceHidden">
            <strong>Source hidden</strong>
            <p>
              Preview-only mode is active. Source code stays out of the chat and hidden here until explicitly shown.
            </p>
          </div>
        )}
      </section>
    </aside>
  );
}
''')

write("src/components/streams-ai/current-chat/new-face/preview/streams-split-preview.css", '''.streamsSplitPreview {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 1800;
  width: min(680px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 30px;
  background:
    radial-gradient(circle at 12% 0%, rgba(124,58,237,.18), transparent 34%),
    linear-gradient(180deg, rgba(9,9,13,.98), rgba(20,20,28,.98));
  color: #fff;
  box-shadow: 0 30px 100px rgba(0,0,0,.38);
  overflow: hidden;
}

.streamsSplitPreviewHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  padding: 18px;
  border-bottom: 1px solid rgba(255,255,255,.1);
}

.streamsSplitPreviewHeader p {
  margin: 0 0 6px;
  color: #93c5fd;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.streamsSplitPreviewHeader h2 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -.05em;
}

.streamsSplitPreviewHeader span {
  display: block;
  margin-top: 5px;
  color: rgba(255,255,255,.56);
  font-size: 12px;
}

.streamsSplitPreviewActions {
  display: flex;
  gap: 8px;
}

.streamsSplitPreviewActions button {
  min-height: 40px;
  border: 0;
  border-radius: 999px;
  padding: 0 14px;
  font-weight: 850;
  cursor: pointer;
}

.streamsSplitPreviewActions button:first-child {
  background: rgba(255,255,255,.12);
  color: #fff;
}

.streamsSplitPreviewActions button:last-child {
  background: #fff;
  color: #111;
}

.streamsSplitPreviewBody {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(280px, 390px) 1fr;
  gap: 14px;
  padding: 16px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.streamsSplitPreviewFrameWrap {
  display: grid;
  place-items: start center;
  min-width: 0;
}

.streamsPhoneChrome {
  position: relative;
  width: min(360px, 100%);
  height: min(760px, calc(100dvh - 150px));
  min-height: 560px;
  border: 10px solid #050507;
  border-radius: 44px;
  background: #050507;
  box-shadow: 0 24px 70px rgba(0,0,0,.45);
  overflow: hidden;
}

.streamsPhoneIsland {
  position: absolute;
  top: 9px;
  left: 50%;
  z-index: 3;
  width: 92px;
  height: 28px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #050507;
}

.streamsPhoneChrome iframe {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 33px;
  background: #fff;
}

.streamsSplitPreviewSource,
.streamsSplitPreviewSourceHidden {
  min-width: 0;
  margin: 0;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 22px;
  background: rgba(255,255,255,.07);
  color: rgba(255,255,255,.86);
}

.streamsSplitPreviewSource {
  padding: 16px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
}

.streamsSplitPreviewSourceHidden {
  align-self: start;
  padding: 18px;
}

.streamsSplitPreviewSourceHidden strong {
  display: block;
  font-size: 18px;
  letter-spacing: -.03em;
}

.streamsSplitPreviewSourceHidden p {
  color: rgba(255,255,255,.62);
  line-height: 1.5;
}

@media (max-width: 860px) {
  .streamsSplitPreview {
    inset: 0;
    width: auto;
    border-radius: 0;
  }

  .streamsSplitPreviewHeader {
    align-items: flex-start;
    flex-direction: column;
  }

  .streamsSplitPreviewActions {
    width: 100%;
  }

  .streamsSplitPreviewActions button {
    flex: 1;
    min-height: 44px;
  }

  .streamsSplitPreviewBody {
    grid-template-columns: 1fr;
  }

  .streamsPhoneChrome {
    width: min(390px, 100%);
    height: min(720px, 78dvh);
  }
}
''')

# ------------------------------------------------------------
# 3. Patch StreamsWorkspaceShell to render split preview panel
# ------------------------------------------------------------
shell_path = "src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx"
shell = read(shell_path)

if 'StreamsSplitPreview' not in shell:
    shell = shell.replace(
        'import StreamsComposer from "./composer/StreamsComposer";',
        'import StreamsComposer from "./composer/StreamsComposer";\nimport StreamsSplitPreview from "./preview/StreamsSplitPreview";'
    )

if '<StreamsSplitPreview />' not in shell:
    # Insert near existing global overlays if available.
    anchors = [
        '      <StreamsActivityTimeline',
        '      <SharePopover',
        '      <ImageViewerModal',
    ]

    inserted = False
    for anchor in anchors:
        idx = shell.find(anchor)
        if idx != -1:
            shell = shell[:idx] + '      <StreamsSplitPreview />\n' + shell[idx:]
            inserted = True
            break

    if not inserted:
        marker = '    </div>\n  );\n}'
        if marker not in shell:
            raise SystemExit("Could not find shell render insertion point")
        shell = shell.replace(marker, '      <StreamsSplitPreview />\n' + marker, 1)

write(shell_path, shell)

# ------------------------------------------------------------
# 4. Add tiny dev/proof button in shell only if no runtime command exists.
#    This is not a fake backend. It opens the panel with local static HTML
#    so layout can be browser-tested before GitHub pull is wired.
# ------------------------------------------------------------
proof_path = "src/components/streams-ai/current-chat/new-face/preview/StreamsSplitPreviewProofButton.jsx"
write(proof_path, '''"use client";

import { openStreamsSplitPreview } from "../runtime/streamsSplitPreviewBridge";

export default function StreamsSplitPreviewProofButton() {
  return (
    <button
      type="button"
      className="streamsSplitPreviewProofButton"
      onClick={() =>
        openStreamsSplitPreview({
          title: "Split Preview Proof",
          kind: "html",
          sourceVisible: false,
          conversationCodeSuppressed: true,
          previewHtml: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui;background:linear-gradient(135deg,#111827,#312e81);color:white}main{width:min(560px,calc(100vw - 32px));border:1px solid rgba(255,255,255,.18);border-radius:28px;background:rgba(255,255,255,.1);padding:28px;box-shadow:0 30px 90px rgba(0,0,0,.35)}h1{font-size:clamp(36px,10vw,76px);line-height:.9;letter-spacing:-.07em;margin:0 0 12px}p{color:rgba(255,255,255,.72);line-height:1.5}</style></head><body><main><h1>Preview is live</h1><p>This proves the split preview panel opens without replacing the working chat runtime.</p></main></body></html>`,
          sourceCode: "",
        })
      }
    >
      Open split preview
    </button>
  );
}
''')

css_path = "src/components/streams-ai/current-chat/new-face/preview/streams-split-preview.css"
css = read(css_path)
if ".streamsSplitPreviewProofButton" not in css:
    css += '''

.streamsSplitPreviewProofButton {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(18px + env(safe-area-inset-bottom));
  z-index: 1300;
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: #111;
  color: #fff;
  padding: 0 16px;
  font-weight: 900;
  box-shadow: 0 14px 44px rgba(0,0,0,.22);
  cursor: pointer;
}

@media (max-width: 860px) {
  .streamsSplitPreviewProofButton {
    right: 12px;
    left: 12px;
    width: auto;
  }
}
'''
write(css_path, css)

if 'StreamsSplitPreviewProofButton' not in shell:
    shell = read(shell_path)
    shell = shell.replace(
        'import StreamsSplitPreview from "./preview/StreamsSplitPreview";',
        'import StreamsSplitPreview from "./preview/StreamsSplitPreview";\nimport StreamsSplitPreviewProofButton from "./preview/StreamsSplitPreviewProofButton";'
    )
    if '<StreamsSplitPreviewProofButton />' not in shell:
        shell = shell.replace('<StreamsSplitPreview />', '<StreamsSplitPreview />\n      <StreamsSplitPreviewProofButton />', 1)
    write(shell_path, shell)

print("Built split preview v1 and mounted it into StreamsWorkspaceShell.")
