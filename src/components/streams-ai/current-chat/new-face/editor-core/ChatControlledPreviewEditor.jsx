"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_EDITOR_WIDTH = 360;
const MAX_EDITOR_WIDTH = 980;
const DEFAULT_EDITOR_WIDTH = 520;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function ChatControlledPreviewEditor({ chatRuntime }) {
  const previewRef = useRef(null);
  const shellRef = useRef(null);
  const dragRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [title, setTitle] = useState("Preview Runtime");
  const [editorWidth, setEditorWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_EDITOR_WIDTH;
    const saved = Number(window.localStorage.getItem("streams:editor:right-width"));
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_EDITOR_WIDTH;
  });

  const postToPreview = useCallback((payload) => {
    const frame = previewRef.current;
    if (!frame?.contentWindow) return false;

    frame.contentWindow.postMessage(
      {
        type: "streams.preview.render",
        payload,
        createdAt: Date.now(),
      },
      "*"
    );

    if (payload?.title) setTitle(payload.title);
    return true;
  }, []);

  useEffect(() => {
    function onPreviewEvent(event) {
      const detail = event.detail || {};
      postToPreview(detail.payload || detail);
    }

    window.addEventListener("streams:preview:render", onPreviewEvent);
    window.addEventListener("streams.preview.render", onPreviewEvent);

    return () => {
      window.removeEventListener("streams:preview:render", onPreviewEvent);
      window.removeEventListener("streams.preview.render", onPreviewEvent);
    };
  }, [postToPreview]);

  useEffect(() => {
    if (!chatRuntime || typeof chatRuntime !== "object") return;

    // Passive bridge only. Does not touch sendMessage or chat runtime.
    chatRuntime.renderPreview = postToPreview;

    return () => {
      if (chatRuntime.renderPreview === postToPreview) {
        delete chatRuntime.renderPreview;
      }
    };
  }, [chatRuntime, postToPreview]);

  function startDrag(event) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = editorWidth;
    const shellWidth = shellRef.current?.getBoundingClientRect?.().width || window.innerWidth;

    dragRef.current = { startX, startWidth, shellWidth };
    setDragging(true);

    function onMove(moveEvent) {
      if (!dragRef.current) return;

      const dx = moveEvent.clientX - dragRef.current.startX;
      const maxWidth = Math.min(
        MAX_EDITOR_WIDTH,
        Math.max(MIN_EDITOR_WIDTH, dragRef.current.shellWidth - 420)
      );

      // Right edge stays locked. Dragging the left edge left expands EditorPro.
      const next = clamp(dragRef.current.startWidth - dx, MIN_EDITOR_WIDTH, maxWidth);

      setEditorWidth(next);
      window.localStorage.setItem("streams:editor:right-width", String(next));
    }

    function onUp() {
      setDragging(false);
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function testPreview() {
    postToPreview({
      kind: "html",
      title: "Center Preview Controlled",
      html:
        "<main style='min-height:100vh;background:#05070b;color:white;font-family:Inter,system-ui;padding:48px'><h1>Center Preview Controlled</h1><p>This is the chat-controlled center preview iframe. EditorPro stays locked to the far right.</p></main>",
    });
  }

  const columns = editorOpen
    ? `minmax(0, 1fr) 12px ${editorWidth}px`
    : "minmax(0, 1fr)";

  return (
    <section
      ref={shellRef}
      data-streams-preview-editor="true"
      style={{
        height: "100%",
        minHeight: 0,
        width: "100%",
        display: "grid",
        gridTemplateRows: "44px minmax(0, 1fr)",
        background: "#05070b",
        color: "white",
        overflow: "hidden",
        userSelect: dragging ? "none" : "auto",
        cursor: dragging ? "col-resize" : "default",
      }}
    >
      {dragging ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            cursor: "col-resize",
            background: "rgba(0,0,0,0.001)",
          }}
        />
      ) : null}

      <header
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(2,6,23,0.92)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong>Streams Preview</strong>
          <span style={{ color: "rgba(255,255,255,.55)", fontSize: 12 }}>{title}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={testPreview} style={buttonStyle}>
            Test preview
          </button>
          <button type="button" onClick={() => setEditorOpen((v) => !v)} style={buttonStyle}>
            {editorOpen ? "Hide EditorPro" : "Show EditorPro"}
          </button>
        </div>
      </header>

      <div
        style={{
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: columns,
          transition: dragging ? "none" : "grid-template-columns 160ms cubic-bezier(.4,0,.2,1)",
        }}
      >
        <iframe
          ref={previewRef}
          src="/preview"
          title="StreamsAI Center Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          style={{
            width: "100%",
            height: "100%",
            minWidth: 0,
            border: 0,
            display: "block",
            background: "#050816",
          }}
        />

        {editorOpen ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize EditorPro"
            onPointerDown={startDrag}
            style={{
              width: 12,
              cursor: "col-resize",
              background: dragging
                ? "rgba(68,195,166,0.22)"
                : "linear-gradient(to right, rgba(68,195,166,0.08), rgba(68,195,166,0.38), rgba(68,195,166,0.08))",
              position: "relative",
              zIndex: 30,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: 2,
                background: dragging ? "rgba(68,195,166,.85)" : "rgba(68,195,166,.45)",
              }}
            />
          </div>
        ) : null}

        {editorOpen ? (
          <aside
            style={{
              minWidth: 0,
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderLeft: "1px solid rgba(68,195,166,.32)",
              background: "#02040a",
            }}
          >
            <iframe
              src="/editor"
              title="EditorPro"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                display: "block",
                background: "#02040a",
              }}
            />
          </aside>
        ) : null}
      </div>
    </section>
  );
}

const buttonStyle = {
  border: "1px solid rgba(255,255,255,.16)",
  borderRadius: 999,
  background: "rgba(255,255,255,.08)",
  color: "white",
  padding: "7px 11px",
  cursor: "pointer",
};
