/**
 * src/lib/utils/session-persistence.ts
 *
 * Storage layer for assistant session persistence.
 *
 * Responsibilities:
 * - Read and write persisted session data (messages only — not connection state)
 * - Validate stored data at every boundary before accepting it
 * - Expose usePersistedDraft hook for debounced draft persistence
 *
 * Not responsible for:
 * - Session reconnect logic (that lives in useAssistantSession)
 * - sessionId persistence (server assigns a new one on every session.start)
 * - Activities, previews, connectionState — these are ephemeral
 *
 * Storage keys:
 *   assistant-session:{storageKey}  — messages
 *   assistant-draft:{storageKey}    — draft text
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantChatMessage } from "@/app/pipeline/test/assistant-frame/useAssistantSession";

// ── Schema ────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1 as const;

type PersistedSession = {
  v: typeof SCHEMA_VERSION;
  storageKey: string;
  savedAt: string;
  messages: AssistantChatMessage[];
};

// ── Runtime validators ────────────────────────────────────────────────────

function isValidRole(v: unknown): v is "user" | "assistant" | "system" {
  return v === "user" || v === "assistant" || v === "system";
}

function isValidStatus(v: unknown): v is AssistantChatMessage["status"] {
  return (
    v === "streaming" ||
    v === "complete" ||
    v === "cancelled" ||
    v === "error"
  );
}

function isAssistantChatMessage(raw: unknown): raw is AssistantChatMessage {
  if (!raw || typeof raw !== "object") return false;
  const m = raw as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.turnId === undefined || typeof m.turnId === "string") &&
    isValidRole(m.role) &&
    typeof m.content === "string" &&
    isValidStatus(m.status) &&
    typeof m.createdAt === "string"
  );
}

function validatePersistedSession(raw: unknown): PersistedSession | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.v !== SCHEMA_VERSION) return null;
  if (typeof obj.storageKey !== "string") return null;
  if (typeof obj.savedAt !== "string") return null;
  if (!Array.isArray(obj.messages)) return null;
  for (const msg of obj.messages) {
    if (!isAssistantChatMessage(msg)) return null;
  }
  return obj as unknown as PersistedSession;
}

// ── Storage keys ──────────────────────────────────────────────────────────

function sessionKey(storageKey: string): string {
  return `assistant-session:${storageKey}`;
}

function draftKey(storageKey: string): string {
  return `assistant-draft:${storageKey}`;
}

// ── Core read/write ───────────────────────────────────────────────────────

/**
 * Read and validate stored session. Returns null if absent or invalid.
 * localStorage may be unavailable (SSR, incognito) — always try/catch.
 */
export function readPersistedSession(storageKey: string): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sessionKey(storageKey));
    if (!raw) return null;
    return validatePersistedSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writePersistedSession(
  storageKey: string,
  messages: AssistantChatMessage[],
): void {
  if (typeof window === "undefined") return;
  try {
    const record: PersistedSession = {
      v: SCHEMA_VERSION,
      storageKey,
      savedAt: new Date().toISOString(),
      messages,
    };
    localStorage.setItem(sessionKey(storageKey), JSON.stringify(record));
  } catch {
    // localStorage quota exceeded or unavailable — fail silently
  }
}

export function clearPersistedSession(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(sessionKey(storageKey));
    localStorage.removeItem(draftKey(storageKey));
  } catch {
    // ignore
  }
}

// ── Message rehydration ───────────────────────────────────────────────────

/**
 * Load stored messages and normalize any mid-stream state.
 * Messages with status "streaming" are rehydrated as "cancelled" —
 * the stream cannot be resumed after disconnect.
 */
export function loadStoredMessages(storageKey: string): AssistantChatMessage[] {
  const persisted = readPersistedSession(storageKey);
  if (!persisted) return [];
  return persisted.messages.map((msg) =>
    msg.status === "streaming" ? { ...msg, status: "cancelled" as const } : msg,
  );
}

// ── Draft persistence hook ────────────────────────────────────────────────

/**
 * Drop-in replacement for useState<string>("") with localStorage persistence.
 * Reads synchronously on first render (no flash).
 * Writes are debounced at debounceMs (default 600ms).
 * Clears storage when value is empty string.
 */
export function usePersistedDraft(
  storageKey: string,
  debounceMs = 600,
): [string, (value: string) => void] {
  const key = draftKey(storageKey);

  const [draft, setDraft] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setDraftWithPersist = useCallback(
    (value: string) => {
      setDraft(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          if (value) {
            localStorage.setItem(key, value);
          } else {
            localStorage.removeItem(key);
          }
        } catch {
          // ignore
        }
      }, debounceMs);
    },
    [key, debounceMs],
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [draft, setDraftWithPersist];
}
