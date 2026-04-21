/**
 * src/lib/utils/session-persistence.ts
 *
 * Storage layer for assistant session persistence.
 *
 * Responsibilities:
 * - Read and write persisted session data (messages only — not connection state)
 * - Validate stored data at every boundary before accepting it
 * - Maintain a global session index for sidebar history
 * - Expose usePersistedDraft hook for debounced draft persistence
 *
 * Storage keys:
 *   assistant-session:{storageKey}  — session messages
 *   assistant-draft:{storageKey}    — draft text
 *   assistant-sessions:index        — list of recent session summaries
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantChatMessage } from "@/app/pipeline/test/assistant-frame/useAssistantSession";

// ── Schema ────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1 as const;
const MAX_INDEX_ENTRIES = 20;
const SESSION_INDEX_KEY = "assistant-sessions:index";

type PersistedSession = {
  v: typeof SCHEMA_VERSION;
  storageKey: string;
  savedAt: string;
  messages: AssistantChatMessage[];
};

// ── Session summary (for sidebar history index) ───────────────────────────

export type SessionSummary = {
  storageKey: string;
  conversationId: string;
  firstMessage: string;
  /** Last assistant message content (≤120 chars). Used as session preview. */
  lastAssistantMessage?: string;
  messageCount: number;
  savedAt: string;
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

function isValidSessionSummary(raw: unknown): raw is SessionSummary {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Record<string, unknown>;
  return (
    typeof s.storageKey === "string" &&
    typeof s.conversationId === "string" &&
    typeof s.firstMessage === "string" &&
    typeof s.messageCount === "number" &&
    typeof s.savedAt === "string" &&
    (s.lastAssistantMessage === undefined || typeof s.lastAssistantMessage === "string")
  );
}

// ── Storage keys ──────────────────────────────────────────────────────────

function sessionKey(storageKey: string): string {
  return `assistant-session:${storageKey}`;
}

function draftKey(storageKey: string): string {
  return `assistant-draft:${storageKey}`;
}

// ── Core read/write ───────────────────────────────────────────────────────

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
  conversationId?: string,
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

    // Keep the global session index up-to-date after every write
    if (conversationId) {
      updateSessionIndex(storageKey, conversationId, messages);
    }
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

// ── Session index ─────────────────────────────────────────────────────────

/**
 * Read the global list of recent sessions.
 * Used by the sidebar to show session history.
 */
export function readSessionIndex(): SessionSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSION_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSessionSummary);
  } catch {
    return [];
  }
}

/**
 * Update the global session index with the latest state of this session.
 * Called automatically by writePersistedSession when conversationId is provided.
 */
function updateSessionIndex(
  storageKey: string,
  conversationId: string,
  messages: AssistantChatMessage[],
): void {
  if (typeof window === "undefined") return;
  try {
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (!firstUserMsg) return;

    const lastAssistantMsg = messages.slice().reverse().find((m) => m.role === "assistant");
    const summary: SessionSummary = {
      storageKey,
      conversationId,
      firstMessage: firstUserMsg.content.slice(0, 100).trim(),
      lastAssistantMessage: lastAssistantMsg?.content?.slice(0, 120).trim(),
      messageCount: messages.length,
      savedAt: new Date().toISOString(),
    };

    const existing = readSessionIndex();
    const filtered = existing.filter((s) => s.storageKey !== storageKey);
    const updated = [summary, ...filtered].slice(0, MAX_INDEX_ENTRIES);
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(updated));
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [draft, setDraftWithPersist];
}
