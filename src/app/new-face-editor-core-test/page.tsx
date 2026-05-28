"use client";

import { useRef, useState } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function NewFaceEditorCoreTestPage() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const centerRef = useRef<HTMLIFrameElement | null>(null);
  const [centerPct, setCenterPct] = useState(58);
  const [showEditor, setShowEditor] = useState(true);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const shell = shellRef.current;
    if (!shell) return;

    const rect = shell.getBoundingClientRect();

    function onMove(moveEvent: PointerEvent) {
      const x = moveEvent.clientX - rect.left;
      setCenterPct(clamp((x / rect.width) * 100, 34, 76));
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function testCenterPreview() {
    centerRef.current?.contentWindow?.postMessage(
      {
        type: "streams.preview.render",
        payload: {
          kind: "html",
          title: "Center Preview Test",
          html:
            "<main style='min-height:100vh;background:#05070b;color:white;font-family:Inter,system-ui;padding:48px'><h1>Center Preview Ready</h1><p>This iframe is the chat-controlled preview surface.</p></main>",
        },
      },
      "*"
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#02040a",
        color: "white",
        padding: 14,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <section
        style={{
          height: "calc(100vh - 28px)",
          display: "grid",
          gridTemplateRows: "48px minmax(0, 1fr)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 22,
          overflow: "hidden",
          background: "#05070b",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.035)",
          }}
        >
          <div>
            <strong>New Face Editor Core Test</strong>
            <span style={{ marginLeft: 12, color: "rgba(255,255,255,.52)", fontSize: 12 }}>
              Center Preview iframe + Right EditorPro iframe
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={testCenterPreview} style={buttonStyle}>
              Test center preview
            </button>
            <button onClick={() => setShowEditor((value) => !value)} style={buttonStyle}>
              {showEditor ? "Hide EditorPro" : "Show EditorPro"}
            </button>
          </div>
        </header>

        <div
          ref={shellRef}
          style={{
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: showEditor ? `${centerPct}% 12px minmax(360px, 1fr)` : "1fr",
          }}
        >
          <iframe
            ref={centerRef}
            title="Center Preview Runtime"
            src="/preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              background: "#05070b",
            }}
          />

          {showEditor ? (
            <div
              onPointerDown={startDrag}
              role="separator"
              aria-label="Resize center preview and EditorPro"
              style={{
                cursor: "col-resize",
                background:
                  "linear-gradient(to right, rgba(0,255,210,.18), rgba(255,255,255,.22), rgba(0,145,255,.18))",
              }}
            />
          ) : null}

          {showEditor ? (
            <iframe
              title="Right EditorPro"
              src="/editor"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                background: "#05070b",
              }}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.16)",
  borderRadius: 999,
  background: "rgba(255,255,255,.08)",
  color: "white",
  padding: "8px 12px",
  cursor: "pointer",
};
