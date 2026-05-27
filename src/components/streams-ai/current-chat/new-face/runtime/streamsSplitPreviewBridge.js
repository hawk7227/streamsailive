export const STREAMS_SPLIT_PREVIEW_EVENT = "streams:split-preview";

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
  return /\b(show in preview|preview only|render it|visual only|frontend only|hide code|no code in conversation|open preview|split preview)\b/i.test(
    String(text || "")
  );
}


export function extractPreviewSourceFromText(text = "") {
  const value = String(text || "");

  const fenced = value.match(/```(?:html|tsx|jsx|react|javascript|js|typescript|ts)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim();
  }

  const htmlStart = value.search(/<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]/i);
  if (htmlStart >= 0) {
    return value.slice(htmlStart).trim();
  }

  return "";
}

export function inferPreviewKindFromSource(source = "") {
  const value = String(source || "").trim();

  if (/<!doctype html|<html[\s>]/i.test(value)) return "html";
  if (/export\s+default\s+function|function\s+[A-Z]|const\s+[A-Z].*=>|className=/s.test(value)) return "tsx";
  if (/<svg[\s>]/i.test(value)) return "svg";

  return "html";
}

export function createPreviewHtmlFromSource(source = "", title = "Preview") {
  const value = String(source || "").trim();

  if (/<!doctype html|<html[\s>]/i.test(value)) {
    return value;
  }

  if (/<svg[\s>]/i.test(value)) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b10;color:white}</style></head><body>${value}</body></html>`;
  }

  if (/<[a-z][\s\S]*>/i.test(value) && !/export\s+default|className=/.test(value)) {
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
