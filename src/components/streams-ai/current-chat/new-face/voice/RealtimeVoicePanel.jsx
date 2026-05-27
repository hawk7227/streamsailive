"use client";

import { useRealtimeVoiceSession } from "./useRealtimeVoiceSession";
import "./realtime-voice-panel.css";

export default function RealtimeVoicePanel({ open, onClose }) {
  const voice = useRealtimeVoiceSession();

  if (!open) return null;

  const active = voice.isActive;

  return (
    <div className="realtimeVoiceBackdrop" role="presentation" onClick={onClose}>
      <section
        className="realtimeVoicePanel"
        role="dialog"
        aria-modal="true"
        aria-label="Realtime voice conversation"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="realtimeVoiceHeader">
          <div>
            <strong>Voice conversation</strong>
            <span>OpenAI Realtime WebRTC session</span>
          </div>
          <button type="button" aria-label="Close voice panel" onClick={() => { voice.stop(); onClose?.(); }}>
            ×
          </button>
        </header>

        <div className="realtimeVoiceOrb" data-state={voice.state}>
          <span />
        </div>

        <p className="realtimeVoiceStatus">{voice.statusText}</p>

        {voice.error ? (
          <div className="realtimeVoiceError">{voice.error}</div>
        ) : null}

        <div className="realtimeVoiceActions">
          {!active ? (
            <button type="button" className="primary" onClick={voice.start}>
              Start voice
            </button>
          ) : (
            <button type="button" className="danger" onClick={voice.stop}>
              Stop voice
            </button>
          )}
        </div>

        <div className="realtimeVoiceTruth">
          Browser mic permission is required. After the voice session starts, conversation is hands-free through Realtime voice activity detection.
        </div>

        {voice.events.length ? (
          <details className="realtimeVoiceEvents">
            <summary>Realtime events</summary>
            <ul>
              {voice.events.slice(0, 8).map((event) => (
                <li key={`${event.at}-${event.type}`}>
                  <span>{event.type}</span>
                  <time>{new Date(event.at).toLocaleTimeString()}</time>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}
