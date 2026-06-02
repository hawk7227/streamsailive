"use client";

import { useMemo, useState } from "react";

const CHAT_PERMISSIONS = [
  "accelerometer",
  "autoplay",
  "camera",
  "clipboard-read",
  "clipboard-write",
  "display-capture",
  "encrypted-media",
  "fullscreen",
  "geolocation",
  "microphone",
  "midi",
  "payment",
  "web-share",
].join("; ");

const CHAT_CAPABILITIES = [
  "full chat assistant",
  "streaming responses",
  "file uploads and file context",
  "image generation",
  "image analysis and image edit intent",
  "text-to-video generation",
  "image-to-video generation",
  "voice and audio tools",
  "audio transcription",
  "Snap Pic Click",
  "media library",
  "video editor handoff",
  "provider routing",
  "job status tracking",
  "admin/browser tool awareness",
  "source proof context",
];

export default function StreamsAIStudioFrame() {
  const [rightMode, setRightMode] = useState<"editor" | "quality">("editor");
  const [proofOpen, setProofOpen] = useState(false);

  const chatSrc = useMemo(() => {
    if (typeof window === "undefined") return "/streams-ai?embed=chat";
    return new URL("/streams-ai?embed=chat", window.location.origin).toString();
  }, []);

  const previewSrc = useMemo(() => {
    if (typeof window === "undefined") return "/pipeline/test?embed=1";
    return new URL("/pipeline/test?embed=1", window.location.origin).toString();
  }, []);

  const editorSrc = useMemo(() => {
    if (typeof window === "undefined") return "/editor";
    return new URL("/editor", window.location.origin).toString();
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "520px minmax(520px, 1fr) 380px",
        height: "100dvh",
        width: "100vw",
        overflow: "hidden",
        background: "#02050b",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <section
        style={{
          minWidth: 0,
          height: "100%",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          background: "#0b0f14",
          overflow: "hidden",
        }}
      >
        <PanelHeader title="StreamsAI Chat" meta="Full mobile chat app" />
        <div
          style={{
            height: "calc(100% - 42px)",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            background: "#0b0f14",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "min(100%, 430px)",
              height: "100%",
              background: "#fff",
              overflow: "hidden",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            <iframe
              src={chatSrc}
              title="StreamsAI Chat"
              allow={CHAT_PERMISSIONS}
              referrerPolicy="strict-origin-when-cross-origin"
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                display: "block",
                background: "#fff",
              }}
            />
          </div>
        </div>
      </section>

      <section
        style={{
          minWidth: 0,
          height: "100%",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          background: "#08111f",
          overflow: "hidden",
        }}
      >
        <PanelHeader title="Preview" meta="Media editor / runtime preview" />
        <iframe
          src={previewSrc}
          title="StreamsAI Preview"
          allow="clipboard-write; clipboard-read; camera; microphone; display-capture; fullscreen"
          style={{
            width: "100%",
            height: "calc(100% - 42px)",
            border: 0,
            display: "block",
            background: "#050816",
          }}
        />
      </section>

      <section
        style={{
          minWidth: 0,
          height: "100%",
          background: "#05070d",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 54,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 12px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "#09101a",
          }}
        >
          <Tab active={rightMode === "editor"} onClick={() => setRightMode("editor")}>
            EditorPro
          </Tab>
          <Tab active={rightMode === "quality"} onClick={() => setRightMode("quality")}>
            Quality Gate
          </Tab>
          <button
            type="button"
            onClick={() => setProofOpen((v) => !v)}
            style={{
              marginLeft: "auto",
              border: "1px solid rgba(56,189,248,.35)",
              background: proofOpen ? "rgba(56,189,248,.18)" : "rgba(255,255,255,.04)",
              color: "#67e8f9",
              borderRadius: 999,
              padding: "8px 10px",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            PROOF
          </button>
        </div>

        {rightMode === "editor" ? (
          <iframe
            src={editorSrc}
            title="StreamsAI Editor"
            style={{
              width: "100%",
              height: "calc(100% - 54px)",
              border: 0,
              display: "block",
              background: "#050816",
            }}
          />
        ) : (
          <QualityGateFallback />
        )}

        {proofOpen ? (
          <aside
            style={{
              position: "absolute",
              top: 54,
              right: 0,
              bottom: 0,
              width: 360,
              overflowY: "auto",
              background: "linear-gradient(180deg, rgba(2,6,23,.98), rgba(8,13,25,.98))",
              borderLeft: "1px solid rgba(148,163,184,.18)",
              padding: 14,
              zIndex: 10,
            }}
          >
            <div style={{ color: "#67e8f9", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>
              NO-GUESS BUILD MODE
            </div>
            <h2 style={{ margin: "6px 0 12px", fontSize: 20 }}>Source Proof Gate</h2>

            <ProofLine label="Route" value="/streams-ai" />
            <ProofLine label="Chat iframe" value="/streams-ai?embed=chat" />
            <ProofLine label="Preview iframe" value="/pipeline/test?embed=1" />
            <ProofLine label="Editor iframe" value="/editor" />
            <ProofLine label="File" value="src/app/streams-ai/page.tsx" />
            <ProofLine label="Shell" value="src/components/streams-ai/StreamsAIStudioFrame.tsx" />

            <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: "rgba(15,23,42,.5)", border: "1px solid rgba(148,163,184,.16)" }}>
              <div style={{ marginBottom: 8, color: "#e0f2fe", fontWeight: 800, fontSize: 12 }}>
                Full chat capabilities preserved
              </div>
              {CHAT_CAPABILITIES.map((cap) => (
                <div key={cap} style={{ color: "#a7f3d0", fontSize: 11, marginBottom: 6 }}>
                  • {cap}
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div
      style={{
        height: 42,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
        background: "#09101a",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em" }}>
        {title}
      </strong>
      {meta ? (
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,.48)", fontSize: 11 }}>
          {meta}
        </span>
      ) : null}
    </div>
  );
}

function Tab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? "rgba(68,195,166,.35)" : "rgba(255,255,255,.08)"}`,
        background: active ? "rgba(68,195,166,.15)" : "rgba(255,255,255,.04)",
        color: "#fff",
        borderRadius: 999,
        padding: "9px 12px",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}

function ProofLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        marginBottom: 8,
        padding: 8,
        borderRadius: 8,
        background: "rgba(15,23,42,.42)",
        border: "1px solid rgba(148,163,184,.16)",
        color: "#cbd5e1",
        fontSize: 12,
        wordBreak: "break-word",
      }}
    >
      <b style={{ color: "#bfdbfe" }}>{label}:</b> {value}
    </div>
  );
}

function QualityGateFallback() {
  return (
    <div
      style={{
        height: "calc(100% - 54px)",
        padding: 18,
        color: "#dbeafe",
        background: "#05070d",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20 }}>Quality Gate</h2>
      <p style={{ color: "#94a3b8", lineHeight: 1.5 }}>
        QA/status panel space for checks, build proof, route proof, output proof, and provider status.
      </p>
    </div>
  );
}
