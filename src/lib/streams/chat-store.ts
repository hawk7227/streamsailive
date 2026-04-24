/**
 * src/lib/streams/chat-store.ts
 *
 * Persistent chat storage — matches Claude's chat history behavior:
 *   ✅ Survives refresh, new tabs, re-login
 *   ✅ Auto-title from first message
 *   ✅ Date grouping (Today / Yesterday / This Week / Month)
 *   ✅ Message preview under each session
 *   ✅ Search finds specific messages with context
 *   ✅ Draft per session survives refresh
 *   ✅ Cross-tab sync via BroadcastChannel
 *   ✅ Message-level IDs for scroll-to-message linking
 */

export interface StoredMessage {
  id:         string;
  role:       "user" | "assistant";
  text:       string;
  createdAt:  string;           // ISO timestamp
  toolCalls?: Array<{ name: string; status: string; label: string }>;
  mediaUrl?:  string;
  mediaKind?: "image" | "video";
}

export interface StoredSession {
  id:        string;
  title:     string;
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp
  messages:  StoredMessage[];
  preview:   string;           // last message snippet for sidebar
  msgCount:  number;
}

export interface SearchResult {
  session:    StoredSession;
  message:    StoredMessage;
  context:    string;          // snippet around the match
  matchIndex: number;          // char index of match in message text
}

// ── Storage keys ──────────────────────────────────────────────────────────
const SESSIONS_KEY  = "streams:chat_sessions_v2";
const DRAFT_PREFIX  = "streams:chat_draft:";
const MAX_SESSIONS  = 200;
const MAX_MSG_LEN   = 20000;  // truncate very long messages in storage

// ── Cross-tab sync ────────────────────────────────────────────────────────
let _channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!_channel) _channel = new BroadcastChannel("streams-chat-sync");
  return _channel;
}

type SyncMessage =
  | { type: "session_updated"; session: StoredSession }
  | { type: "session_deleted"; id: string }
  | { type: "draft_updated";   sessionId: string; draft: string };

export function broadcastSync(msg: SyncMessage): void {
  getChannel()?.postMessage(msg);
}

export function listenSync(handler: (msg: SyncMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (e: MessageEvent) => handler(e.data as SyncMessage);
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}

// ── Session CRUD ──────────────────────────────────────────────────────────

export function loadSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as StoredSession[]).slice(0, MAX_SESSIONS);
  } catch { return []; }
}

export function saveSession(session: StoredSession): void {
  try {
    const sessions = loadSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    const trimmed: StoredSession = {
      ...session,
      messages: session.messages.map(m => ({
        ...m,
        text: m.text.slice(0, MAX_MSG_LEN),
      })),
    };
    if (idx >= 0) sessions[idx] = trimmed;
    else sessions.unshift(trimmed);
    // Keep newest MAX_SESSIONS, sorted by updatedAt desc
    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
    broadcastSync({ type: "session_updated", session: trimmed });
  } catch { /* storage full or unavailable */ }
}

export function deleteSession(id: string): void {
  try {
    const sessions = loadSessions().filter(s => s.id !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    localStorage.removeItem(`${DRAFT_PREFIX}${id}`);
    broadcastSync({ type: "session_deleted", id });
  } catch {}
}

// ── Draft persistence ─────────────────────────────────────────────────────

export function loadDraft(sessionId: string): string {
  try { return localStorage.getItem(`${DRAFT_PREFIX}${sessionId}`) ?? ""; }
  catch { return ""; }
}

export function saveDraft(sessionId: string, text: string): void {
  try {
    if (text) localStorage.setItem(`${DRAFT_PREFIX}${sessionId}`, text.slice(0, 5000));
    else localStorage.removeItem(`${DRAFT_PREFIX}${sessionId}`);
  } catch {}
}

// ── Build a session object from messages ──────────────────────────────────

export function buildSession(
  id: string,
  title: string,
  messages: StoredMessage[],
  existingCreatedAt?: string,
): StoredSession {
  const lastMsg  = [...messages].reverse().find(m => m.text.trim());
  const preview  = lastMsg
    ? (lastMsg.role === "user" ? "You: " : "Streams: ") + lastMsg.text.replace(/\n/g, " ").slice(0, 80)
    : "";
  return {
    id,
    title,
    createdAt: existingCreatedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages,
    preview,
    msgCount: messages.length,
  };
}

// ── Auto-title generation ─────────────────────────────────────────────────
// Generates a short descriptive title from the first user message.
// Falls back to truncated first message if no key is available.

export async function generateTitle(firstUserMessage: string, apiKey: string): Promise<string> {
  if (!apiKey) return titleFromMessage(firstUserMessage);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 12,
        temperature: 0.3,
        messages: [
          { role: "system", content: "Generate a 3-5 word title for this conversation. No quotes, no punctuation, just the words." },
          { role: "user",   content: firstUserMessage.slice(0, 200) },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const title = data.choices?.[0]?.message?.content?.trim();
    return title && title.length > 2 ? title : titleFromMessage(firstUserMessage);
  } catch {
    return titleFromMessage(firstUserMessage);
  }
}

function titleFromMessage(msg: string): string {
  return msg.replace(/\n/g, " ").trim().slice(0, 50) + (msg.length > 50 ? "…" : "");
}

// ── Date formatting ───────────────────────────────────────────────────────

export function formatSessionDate(isoString: string): string {
  const date  = new Date(isoString);
  const now   = new Date();
  const diff  = now.getTime() - date.getTime();
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7)   return date.toLocaleDateString("en-US", { weekday: "short" });
  if (days < 365) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getDateGroup(isoString: string): string {
  const date = new Date(isoString);
  const now  = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0)  return "Today";
  if (days === 1)  return "Yesterday";
  if (days < 7)   return "Past 7 days";
  if (days < 30)  return "Past 30 days";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Full-text search across all sessions ──────────────────────────────────

export function searchSessions(query: string, limit = 20): SearchResult[] {
  if (!query.trim()) return [];
  const sessions = loadSessions();
  const q        = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const session of sessions) {
    // Search title
    if (session.title.toLowerCase().includes(q)) {
      results.push({
        session,
        message:    session.messages[0] ?? { id: "", role: "user", text: session.title, createdAt: session.createdAt },
        context:    session.title,
        matchIndex: session.title.toLowerCase().indexOf(q),
      });
    }

    // Search messages
    for (const msg of session.messages) {
      const idx = msg.text.toLowerCase().indexOf(q);
      if (idx < 0) continue;

      // Build context: 60 chars before + match + 60 chars after
      const start   = Math.max(0, idx - 60);
      const end     = Math.min(msg.text.length, idx + q.length + 60);
      const context = (start > 0 ? "…" : "") + msg.text.slice(start, end) + (end < msg.text.length ? "…" : "");

      results.push({ session, message: msg, context, matchIndex: idx });
      if (results.length >= limit) return results;
    }
  }

  return results.slice(0, limit);
}
