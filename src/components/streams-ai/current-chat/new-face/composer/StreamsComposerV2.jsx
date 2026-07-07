"use client";

import { useEffect, useRef, useState } from "react";
import "./streams-composer-v2.css";

const TEXTAREA_MIN = 28;
const TEXTAREA_MAX_DESKTOP = 168;
const TEXTAREA_MAX_MOBILE = 148;
const MODES = ["Thinking", "Configure..."];

function isMobileViewport() {
  return typeof window !== "undefined" && (window.innerWidth < 760 || window.matchMedia?.("(pointer: coarse)")?.matches);
}

function autosizeTextarea(node) {
  if (!node) return;
  const max = isMobileViewport() ? TEXTAREA_MAX_MOBILE : TEXTAREA_MAX_DESKTOP;
  node.style.height = "0px";
  const next = Math.min(max, Math.max(TEXTAREA_MIN, node.scrollHeight));
  node.style.height = `${next}px`;
  node.style.overflowY = node.scrollHeight > max ? "auto" : "hidden";
}

export default function StreamsComposerV2({
  onSubmit,
  onFilesSelected,
  disabled = false,
  defaultMode = "Thinking",
  defaultValue = "",
}) {
  const [message, setMessage] = useState(defaultValue);
  const [mode, setMode] = useState(defaultMode);
  const [menu, setMenu] = useState("");
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    autosizeTextarea(inputRef.current);
  }, [message]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setMenu("");
    };
    const escape = (event) => {
      if (event.key === "Escape") setMenu("");
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [menu]);

  function send() {
    const value = message.trim();
    if (!value || disabled) return;
    setMessage("");
    window.requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.style.height = `${TEXTAREA_MIN}px`;
        inputRef.current.style.overflowY = "hidden";
      }
    });
    onSubmit?.({ message: value, mode });
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isMobileViewport()) return;
    event.preventDefault();
    send();
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) onFilesSelected?.(files);
    event.target.value = "";
  }

  return (
    <section ref={rootRef} className="streamsComposerV2" data-streams-composer-version="v2-preview-chatgpt-claude" aria-label="Streams Composer V2 preview">
      <div className="streamsComposerV2TextLayer">
        <textarea
          ref={inputRef}
          className="streamsComposerV2Input"
          rows={1}
          value={message}
          placeholder="Ask anything"
          aria-label="Message Streams AI"
          spellCheck="true"
          onChange={(event) => {
            setMessage(event.target.value);
            autosizeTextarea(event.target);
          }}
          onInput={(event) => autosizeTextarea(event.currentTarget)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="streamsComposerV2ActionLayer">
        <button type="button" className="streamsComposerV2IconButton" aria-label="Add photos and files" onClick={() => fileRef.current?.click()}>+</button>
        <div className="streamsComposerV2Spacer" />
        <button type="button" className="streamsComposerV2ModeButton" aria-label="Open mode menu" onClick={() => setMenu(menu === "mode" ? "" : "mode")}>{mode}<span>⌄</span></button>
        <button type="button" className="streamsComposerV2MicButton" aria-label="Start voice">🎙</button>
        <button type="button" className="streamsComposerV2SendButton" aria-label="Send" onClick={send} disabled={disabled || !message.trim()}>↑</button>
      </div>

      <input ref={fileRef} type="file" multiple hidden aria-label="Add files" onChange={handleFileChange} />

      {menu === "mode" ? (
        <div className="streamsComposerV2Menu" role="menu" aria-label="Mode menu">
          {MODES.map((item) => (
            <button key={item} type="button" onClick={() => { setMode(item); setMenu(""); }}>
              <strong>{item}</strong>
              <span>{item === mode ? "Active" : ""}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
