"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

function makeSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `voice_${crypto.randomUUID()}`;
  }
  return `voice_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cleanText(value) {
  return String(value || "").trim();
}

export default function LiveVoiceConversationPanel({ projectId = PROJECT_ID }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState("Closed");
  const [error, setError] = useState("");
  const [callActive, setCallActive] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const [wakeActive, setWakeActive] = useState(false);
  const [wakeSupported, setWakeSupported] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [sessionId] = useState(() => makeSessionId());

  const vapiRef = useRef(null);
  const wakeRef = useRef(null);
  const callIdRef = useRef(null);
  const initializingRef = useRef(false);

  const vapiReady = Boolean(config?.vapi?.enabled && config?.vapi?.publicKey && config?.vapi?.assistantId);
  const wakeLabel = config?.wakeWord?.label || "Hey Streams";

  const latestLine = useMemo(() => transcripts[transcripts.length - 1], [transcripts]);

  async function loadConfig() {
    const res = await fetch("/api/admingeneration/voice/session", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Voice session config failed.");
    }
    setConfig(data);
    return data;
  }

  async function persistTranscript(entry) {
    try {
      await fetch("/api/admingeneration/voice/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "live-voice-panel",
          provider: "vapi",
          projectId,
          sessionId,
          vapiCallId: callIdRef.current,
          role: entry.role,
          transcript: entry.transcript,
          text: entry.transcript,
          timestamp: entry.timestamp,
          metadata: {
            route: "admingeneration-live-voice",
            callActive,
          },
        }),
      });
    } catch {
      // Memory persistence is best-effort from client.
      // Vapi webhook remains the authoritative server-side persistence path when configured.
    }
  }

  function addTranscript(role, transcript) {
    const text = cleanText(transcript);
    if (!text) return;

    const entry = {
      role: role === "assistant" ? "assistant" : "user",
      transcript: text,
      timestamp: new Date().toISOString(),
    };

    setTranscripts((items) => [...items.slice(-40), entry]);
    persistTranscript(entry);
  }

  async function ensureVapi() {
    if (vapiRef.current) return vapiRef.current;
    if (initializingRef.current) return null;

    initializingRef.current = true;
    setError("");
    setStatus("Loading voice engine…");

    try {
      const cfg = config || (await loadConfig());

      if (!cfg?.vapi?.enabled) {
        throw new Error(`Vapi is not configured. Missing: ${(cfg?.vapi?.missing || []).join(", ") || "Vapi keys"}`);
      }

      const mod = await import("@vapi-ai/web");
      const Vapi = mod.default || mod.Vapi || mod;
      const vapi = new Vapi(cfg.vapi.publicKey);

      vapi.on("call-start", () => {
        setCallActive(true);
        setStatus("Live voice connected");
      });

      vapi.on("call-end", () => {
        setCallActive(false);
        setPttActive(false);
        setStatus("Voice call ended");
      });

      vapi.on("speech-start", () => {
        setStatus("Listening…");
      });

      vapi.on("speech-end", () => {
        setStatus("Processing speech…");
      });

      vapi.on("message", (message) => {
        if (!message) return;

        if (message.type === "conversation-update" && message.conversation) {
          const last = message.conversation[message.conversation.length - 1];
          if (last?.role && last?.content) addTranscript(last.role, last.content);
        }

        if (message.type === "transcript") {
          const isFinal = !message.transcriptType || message.transcriptType === "final";
          if (isFinal && message.transcript) {
            addTranscript(message.role, message.transcript);
          }
        }

        if (message.type === "function-call" || message.type === "tool-call") {
          setStatus("Tool call received");
        }

        if (message.call?.id) {
          callIdRef.current = message.call.id;
        }
      });

      vapi.on("error", (err) => {
        setError(err?.message || String(err || "Vapi error"));
        setStatus("Voice error");
      });

      vapiRef.current = vapi;
      setStatus("Voice engine ready");
      return vapi;
    } finally {
      initializingRef.current = false;
    }
  }

  async function startVoice() {
    setOpen(true);
    setMinimized(false);
    setError("");

    try {
      const cfg = config || (await loadConfig());
      const vapi = await ensureVapi();

      if (!vapi) return;

      setStatus("Starting voice call…");
      const call = await vapi.start(cfg.vapi.assistantId);
      if (call?.id) callIdRef.current = call.id;
      setCallActive(true);
      setStatus("Live voice connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Start voice failed");
    }
  }

  async function stopVoice() {
    try {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    } catch {}
    setCallActive(false);
    setPttActive(false);
    setStatus("Voice stopped");
  }

  async function holdStart() {
    setPttActive(true);
    if (!callActive) await startVoice();
  }

  async function holdEnd() {
    setPttActive(false);
    await stopVoice();
  }

  function setupBrowserWake() {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setWakeSupported(false);
      return null;
    }

    setWakeSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const chunks = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        chunks.push(event.results[i][0]?.transcript || "");
      }
      const heard = chunks.join(" ").toLowerCase();
      if (heard.includes("hey streams") || heard.includes("hey stream")) {
        setStatus("Wake word heard");
        startVoice();
      }
    };

    recognition.onerror = (event) => {
      setStatus(`Wake listener error: ${event.error || "unknown"}`);
    };

    recognition.onend = () => {
      if (wakeRef.current && wakeActive) {
        try {
          recognition.start();
        } catch {}
      }
    };

    return recognition;
  }

  async function toggleWake() {
    setError("");

    if (wakeActive) {
      try {
        wakeRef.current?.stop();
      } catch {}
      wakeRef.current = null;
      setWakeActive(false);
      setStatus("Wake word off");
      return;
    }

    let recognition = wakeRef.current || setupBrowserWake();

    if (!recognition) {
      setError("Browser wake listener is not supported here. Use Start Voice or Hold To Talk.");
      return;
    }

    try {
      wakeRef.current = recognition;
      recognition.start();
      setWakeActive(true);
      setStatus(`Wake word on: ${wakeLabel}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setWakeActive(false);
    }
  }

  useEffect(() => {
    loadConfig().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });

    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setWakeSupported(Boolean(SpeechRecognition));

    return () => {
      try {
        wakeRef.current?.stop();
      } catch {}
      try {
        vapiRef.current?.stop();
      } catch {}
    };
  }, []);

  if (!open) {
    return (
      <button style={styles.closedTab} onClick={() => { setOpen(true); setMinimized(false); }}>
        Live Voice
      </button>
    );
  }

  if (minimized) {
    return (
      <div style={styles.minibar}>
        <button style={styles.miniTitle} onClick={() => setMinimized(false)}>
          Live Voice
        </button>
        <span style={styles.miniStatus}>{callActive ? "Connected" : status}</span>
        <button style={styles.iconButton} onClick={() => setOpen(false)}>×</button>
      </div>
    );
  }

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Live Voice</div>
          <strong>Voice Conversation</strong>
          <div style={styles.subtle}>Vapi call + transcript memory + push-to-talk + wake fallback</div>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.iconButton} onClick={() => setMinimized(true)}>–</button>
          <button style={styles.iconButton} onClick={() => setOpen(false)}>×</button>
        </div>
      </div>

      <div style={styles.statusBox}>
        <div>{status}</div>
        <div style={styles.subtle}>
          Vapi: {vapiReady ? "configured" : "not configured"} · Wake: {wakeSupported ? "browser supported" : "push-to-talk fallback"}
        </div>
        {error ? <div style={styles.error}>{error}</div> : null}
      </div>

      <div style={styles.grid}>
        {!callActive ? (
          <button style={styles.primaryButton} onClick={startVoice}>Start Voice</button>
        ) : (
          <button style={styles.dangerButton} onClick={stopVoice}>Stop Voice</button>
        )}

        <button
          style={pttActive ? styles.greenButton : styles.secondaryButton}
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onMouseLeave={() => pttActive && holdEnd()}
          onTouchStart={(event) => { event.preventDefault(); holdStart(); }}
          onTouchEnd={(event) => { event.preventDefault(); holdEnd(); }}
        >
          Hold To Talk
        </button>

        <button style={wakeActive ? styles.greenButton : styles.secondaryButton} onClick={toggleWake}>
          {wakeActive ? "Wake On" : "Enable Wake"}
        </button>
      </div>

      <div style={styles.transcriptBox}>
        <div style={styles.boxTitle}>Transcript Memory</div>
        {transcripts.length === 0 ? (
          <div style={styles.subtle}>Voice transcripts will appear here and persist through the voice memory route/webhook.</div>
        ) : (
          transcripts.slice(-8).map((item, index) => (
            <div key={`${item.timestamp}-${index}`} style={styles.line}>
              <b>{item.role}:</b> {item.transcript}
            </div>
          ))
        )}
      </div>

      {latestLine ? (
        <div style={styles.latest}>
          <span>Latest:</span> {latestLine.transcript}
        </div>
      ) : null}
    </section>
  );
}

const baseButton = {
  minHeight: 40,
  borderRadius: 12,
  padding: "0 14px",
  color: "#f8fafc",
  cursor: "pointer",
  border: "1px solid rgba(148,163,184,0.25)",
};

const styles = {
  closedTab: {
    position: "fixed",
    left: 18,
    bottom: 18,
    zIndex: 120,
    ...baseButton,
    background: "#2563eb",
    borderColor: "rgba(96,165,250,0.55)",
    boxShadow: "0 16px 46px rgba(0,0,0,0.35)",
  },
  minibar: {
    position: "fixed",
    left: 18,
    bottom: 18,
    zIndex: 120,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    background: "rgba(8,13,24,0.96)",
    border: "1px solid rgba(148,163,184,0.24)",
    color: "#f8fafc",
    boxShadow: "0 16px 46px rgba(0,0,0,0.35)",
  },
  miniTitle: {
    ...baseButton,
    minHeight: 34,
    background: "#2563eb",
  },
  miniStatus: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  panel: {
    position: "fixed",
    left: 18,
    bottom: 18,
    zIndex: 120,
    width: "min(430px, calc(100vw - 36px))",
    maxHeight: "calc(100dvh - 72px)",
    overflow: "auto",
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(8,13,24,0.96)",
    color: "#f8fafc",
    boxShadow: "0 24px 80px rgba(0,0,0,0.38)",
    backdropFilter: "blur(12px)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  headerActions: {
    display: "flex",
    gap: 6,
  },
  kicker: {
    color: "#93c5fd",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  subtle: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 1.45,
  },
  iconButton: {
    ...baseButton,
    minHeight: 30,
    width: 32,
    padding: 0,
    background: "#1e293b",
  },
  statusBox: {
    display: "grid",
    gap: 4,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.86)",
    fontSize: 13,
  },
  error: {
    color: "#fecaca",
    fontSize: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
  },
  primaryButton: {
    ...baseButton,
    background: "#2563eb",
    borderColor: "rgba(96,165,250,0.55)",
  },
  secondaryButton: {
    ...baseButton,
    background: "#1e293b",
  },
  greenButton: {
    ...baseButton,
    background: "#047857",
    borderColor: "rgba(52,211,153,0.45)",
  },
  dangerButton: {
    ...baseButton,
    background: "#991b1b",
    borderColor: "rgba(248,113,113,0.45)",
  },
  transcriptBox: {
    display: "grid",
    gap: 7,
    padding: 10,
    borderRadius: 12,
    background: "rgba(15,23,42,0.86)",
    border: "1px solid rgba(148,163,184,0.18)",
  },
  boxTitle: {
    color: "#93c5fd",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  line: {
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 1.4,
  },
  latest: {
    color: "#cbd5e1",
    fontSize: 12,
    borderTop: "1px solid rgba(148,163,184,0.16)",
    paddingTop: 8,
  },
};
