"use client";

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
