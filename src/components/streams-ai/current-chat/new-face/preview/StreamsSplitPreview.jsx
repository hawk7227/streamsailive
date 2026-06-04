"use client";

import { useEffect, useMemo, useState } from "react";
import { getLastStreamsSplitPreview, subscribeToStreamsSplitPreview } from "../runtime/streamsSplitPreviewBridge";
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

export default function StreamsSplitPreview({ embedded = false, initialOpen = false, onClose, onOpenLatestPreview } = {}) {
  const [state, setState] = useState(() => {
    const last = initialOpen ? getLastStreamsSplitPreview() : null;
    return {
      open: initialOpen,
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
      ...(last || {}),
      open: initialOpen || Boolean(last?.open),
      sourceVisible: Boolean(last?.sourceVisible),
    };
  });

  useEffect(() => {
    return subscribeToStreamsSplitPreview((event) => {
      if (event.action === "close") {
        setState((current) => ({ ...current, open: false }));
        onClose?.();
        return;
      }

      if (event.action === "open") {
        setState((current) => ({
          ...current,
          ...event,
          open: true,
          sourceVisible: Boolean(event.sourceVisible),
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
  }, [initialOpen, onClose]);

  const srcDoc = useMemo(
    () => buildSrcDoc(state.previewHtml, state.sourceCode, state.kind),
    [state.previewHtml, state.sourceCode, state.kind]
  );

  if (!state.open && !embedded) return null;

  return (
    <aside className={embedded ? "streamsSplitPreview embedded" : "streamsSplitPreview"} aria-label="Split preview panel">
      <header className="streamsSplitPreviewHeader">
        <div>
          <p>STREAMS Preview</p>
          <h2>{state.title || (embedded ? "Split Preview" : "Preview")}</h2>
          <span>
            {state.repoFullName ? `${state.repoFullName} · ` : ""}
            {state.branch ? `${state.branch} · ` : ""}
            {state.filePath || state.kind}
          </span>
        </div>

        <div className="streamsSplitPreviewActions">
          {typeof onOpenLatestPreview === "function" ? (
            <button
              type="button"
              onClick={onOpenLatestPreview}
            >
              Open latest code
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setState((current) => ({ ...current, sourceVisible: !current.sourceVisible }))}
          >
            {state.sourceVisible ? "Hide source" : "Show source"}
          </button>
          <button
            type="button"
            onClick={() => {
              setState((current) => ({ ...current, open: false }));
              onClose?.();
            }}
          >
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
