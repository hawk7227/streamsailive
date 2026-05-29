"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WakeWordLayer from "./WakeWordLayer";
import "./voice-conversation-layer.css";

function readBuilderContext() {
  const route = window.location.pathname;
  const textareas = Array.from(document.querySelectorAll("textarea")).map((node) => node.value).filter(Boolean);
  const inputs = Array.from(document.querySelectorAll("input, select")).map((node) => ({
    name: node.getAttribute("name") || node.getAttribute("aria-label") || node.previousSibling?.textContent || "",
    value: node.value,
  })).filter((entry) => entry.value);

  return {
    route,
    title: document.title,
    promptPreview: textareas[0] || "",
    fields: textareas.slice(0, 12),
    controls: inputs.slice(0, 24),
  };
}

function normalizeVapiMessage(message) {
  const text =
    message?.transcript ||
    message?.text ||
    message?.content ||
    message?.message ||
    message?.artifact?.transcript ||
    "";

  const rawRole =
    message?.role ||
    message?.speaker ||
    message?.transcriptRole ||
    message?.message?.role ||
    "";

  const role = String(rawRole).toLowerCase().includes("assistant") || String(rawRole).toLowerCase().includes("bot")
    ? "assistant"
    : "user";

  const transcriptType =
    message?.transcriptType ||
    message?.transcript_type ||
    message?.type ||
    "final";

  return {
    role,
    text: typeof text === "string" ? text.trim() : "",
    transcriptType,
  };
}

export default function VoiceConversationLayer() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState("Voice layer ready.");
  const [callActive, setCallActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [memoryMode, setMemoryMode] = useState("session");
  const [responseStyle, setResponseStyle] = useState("natural");
  const [minimized, setMinimized] = useState(false);
  const vapiRef = useRef(null);
  const callIdRef = useRef(null);

  useEffect(() => {
    let alive = true;

    fetch("/api/admingeneration/voice/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (alive) {
          setConfig(data);
          if (!data?.vapi?.enabled) {
            setStatus(`Vapi not configured: ${(data?.vapi?.missing || []).join(", ") || "missing config"}`);
          }
        }
      })
      .catch((error) => {
        if (alive) setStatus(`Voice config failed: ${error instanceof Error ? error.message : String(error)}`);
      });

    return () => {
      alive = false;
    };
  }, []);

  const persistTranscript = useCallback(async (entry) => {
    const context = readBuilderContext();

    try {
      const response = await fetch("/api/admingeneration/voice/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entry,
          memoryMode,
          responseStyle,
          vapiCallId: callIdRef.current,
          context,
          metadata: {
            provider: "vapi",
            layer: "VoiceConversationLayer",
          },
        }),
      });

      const data = await response.json().catch(() => null);

      setTranscripts((current) => [
        ...current,
        {
          ...entry,
          persisted: response.ok,
          persistStatus: response.status,
          persistResult: data,
          createdAt: new Date().toISOString(),
        },
      ].slice(-30));

      if (!response.ok) {
        setStatus("Transcript received, but STREAMS memory persistence is blocked.");
      }
    } catch (error) {
      setTranscripts((current) => [
        ...current,
        {
          ...entry,
          persisted: false,
          persistStatus: 0,
          persistResult: { error: error instanceof Error ? error.message : String(error) },
          createdAt: new Date().toISOString(),
        },
      ].slice(-30));

      setStatus("Transcript received, but memory persistence failed.");
    }
  }, [memoryMode, responseStyle]);

  const handleVapiMessage = useCallback((message) => {
    const normalized = normalizeVapiMessage(message);

    if (!normalized.text) return;

    const isFinal = String(normalized.transcriptType).toLowerCase().includes("final") ||
      String(normalized.transcriptType).toLowerCase() === "transcript";

    if (isFinal) {
      persistTranscript({
        eventType: "transcript",
        role: normalized.role,
        text: normalized.text,
        transcriptType: "final",
        source: "vapi",
      });
    } else {
      setTranscripts((current) => [
        ...current,
        {
          ...normalized,
          persisted: false,
          partial: true,
          createdAt: new Date().toISOString(),
        },
      ].slice(-30));
    }
  }, [persistTranscript]);

  const startVoiceCall = useCallback(async (source = "manual") => {
    if (callActive || loading) return;

    if (!config?.vapi?.enabled) {
      setStatus(`Vapi not configured: ${(config?.vapi?.missing || []).join(", ") || "missing config"}`);
      return;
    }

    setLoading(true);
    setStatus("Starting live Vapi voice conversation...");

    try {
      const module = await import(/* webpackIgnore: true */ "https://esm.sh/@vapi-ai/web");
      const VapiCtor = module.default || module.Vapi || module.default?.Vapi;

      if (!VapiCtor) {
        throw new Error("Vapi Web SDK did not load correctly.");
      }

      const vapi = new VapiCtor(config.vapi.publicKey);
      vapiRef.current = vapi;

      vapi.on?.("call-start", () => {
        setCallActive(true);
        setStatus("Live voice conversation active.");
      });

      vapi.on?.("call-end", () => {
        setCallActive(false);
        setStatus("Live voice conversation ended.");
      });

      vapi.on?.("speech-start", () => setStatus("Assistant speaking..."));
      vapi.on?.("speech-end", () => setStatus("Listening..."));
      vapi.on?.("message", handleVapiMessage);
      vapi.on?.("error", (error) => {
        setStatus(`Vapi error: ${error?.message || String(error)}`);
      });

      const metadata = {
        source,
        memoryMode,
        responseStyle,
        app: "admingeneration",
        context: readBuilderContext(),
      };

      try {
        const call = await vapi.start(config.vapi.assistantId, { metadata });
        callIdRef.current = call?.id || null;
      } catch {
        const call = await vapi.start(config.vapi.assistantId);
        callIdRef.current = call?.id || null;
      }
    } catch (error) {
      setStatus(`Voice start blocked: ${error instanceof Error ? error.message : String(error)}`);
      setCallActive(false);
    } finally {
      setLoading(false);
    }
  }, [callActive, config, handleVapiMessage, loading, memoryMode, responseStyle]);

  const stopVoiceCall = useCallback(async () => {
    try {
      await vapiRef.current?.stop?.();
    } catch {
      // stop best effort
    }

    setCallActive(false);
    setStatus("Voice conversation stopped.");
  }, []);

  const pushToTalkDown = useCallback(() => {
    startVoiceCall("push-to-talk");
  }, [startVoiceCall]);

  const pushToTalkUp = useCallback(() => {
    stopVoiceCall();
  }, [stopVoiceCall]);

  const memoryOptions = useMemo(() => config?.memoryModes || ["none", "session", "project", "long-term", "full"], [config]);
  const styleOptions = useMemo(() => config?.responseStyles || ["natural", "friendly", "professional"], [config]);

  if (minimized) {
    return (
      <button className="voice-layer-minimized" onClick={() => setMinimized(false)} type="button">
        🎙️ Voice
      </button>
    );
  }

  return (
    <section className="voice-layer-shell">
      <div className="voice-layer-header">
        <div>
          <strong>Live Voice Conversation</strong>
          <span>{status}</span>
        </div>
        <button onClick={() => setMinimized(true)} type="button">×</button>
      </div>

      <div className="voice-layer-controls">
        <button className={callActive ? "active" : ""} disabled={loading} onClick={() => (callActive ? stopVoiceCall() : startVoiceCall("manual"))} type="button">
          {callActive ? "Stop Voice" : loading ? "Starting..." : "Start Voice"}
        </button>

        <button
          className="push-talk"
          onMouseDown={pushToTalkDown}
          onMouseUp={pushToTalkUp}
          onMouseLeave={() => callActive && stopVoiceCall()}
          onTouchStart={pushToTalkDown}
          onTouchEnd={pushToTalkUp}
          type="button"
        >
          Hold To Talk
        </button>
      </div>

      <WakeWordLayer
        config={config}
        disabled={callActive}
        onStatus={setStatus}
        onWake={() => startVoiceCall("wake-word")}
      />

      <div className="voice-layer-settings">
        <label>
          <span>Memory</span>
          <select value={memoryMode} onChange={(event) => setMemoryMode(event.target.value)}>
            {memoryOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <label>
          <span>Style</span>
          <select value={responseStyle} onChange={(event) => setResponseStyle(event.target.value)}>
            {styleOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="voice-transcript-list">
        {transcripts.length === 0 ? (
          <p>Voice transcripts will appear here and persist into STREAMS memory when the backend accepts them.</p>
        ) : transcripts.slice(-5).map((entry, index) => (
          <article className={entry.role === "assistant" ? "assistant" : "user"} key={`${entry.createdAt}-${index}`}>
            <strong>{entry.role === "assistant" ? "AI" : "You"} {entry.persisted ? "✓" : entry.partial ? "…" : "!"}</strong>
            <span>{entry.text}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
