from pathlib import Path

# -----------------------------
# 1. Restore realtime session route
# -----------------------------
Path("src/app/api/streams-ai/realtime/session").mkdir(parents=True, exist_ok=True)
Path("src/app/api/streams-ai/realtime/session/route.ts").write_text(r'''import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createStreamsRealtimeClientSecret } from "@/lib/streams-ai/realtime/create-realtime-session";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const bearerClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user: bearerUser },
  } = await bearerClient.auth.getUser(token);

  return bearerUser || null;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized: sign in before starting a voice conversation. Server did not receive a Supabase cookie or bearer session.",
      },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const result = await createStreamsRealtimeClientSecret({
    userId: user.id,
    workspaceId: body?.workspaceId,
    instructions: body?.instructions,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    source: "openai-realtime-webrtc",
    model: result.model,
    clientSecret: result.value,
    expiresAt: result.expiresAt,
  });
}
''', encoding="utf-8")

# -----------------------------
# 2. Patch voice hook bearer auth
# -----------------------------
voice = Path("src/components/streams-ai/current-chat/new-face/voice/useRealtimeVoiceSession.js")
s = voice.read_text(encoding="utf-8")

if 'import { useAuth } from "@/contexts/AuthContext";' not in s:
    s = s.replace(
        'import { useCallback, useRef, useState } from "react";',
        'import { useCallback, useRef, useState } from "react";\nimport { useAuth } from "@/contexts/AuthContext";'
    )

if "const { session } = useAuth();" not in s:
    s = s.replace(
        "export function useRealtimeVoiceSession() {",
        "export function useRealtimeVoiceSession() {\n  const { session } = useAuth();"
    )

old = '''      const tokenResponse = await fetch("/api/streams-ai/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });'''

new = '''      const tokenResponse = await fetch("/api/streams-ai/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({}),
      });'''

if old in s:
    s = s.replace(old, new, 1)

voice.write_text(s, encoding="utf-8")

# -----------------------------
# 3. Patch shell forwarding
# -----------------------------
shell = Path("src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx")
s = shell.read_text(encoding="utf-8")

old = '''        onSubmit={({ message, composerMode, mode, provider }) => {
          chatRuntime?.sendMessage({ message, composerMode, mode, provider });
        }}'''

new = '''        onSubmit={(payload) => {
          chatRuntime?.sendMessage({
            message: payload.message,
            composerMode: payload.composerMode,
            mode: payload.mode,
            webSearchEnabled: payload.webSearchEnabled,
          });
        }}'''

if old in s:
    s = s.replace(old, new, 1)

shell.write_text(s, encoding="utf-8")

# -----------------------------
# 4. Patch runtime search route
# -----------------------------
runtime = Path("src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js")
s = runtime.read_text(encoding="utf-8")

old_sig = 'const sendMessage = useCallback(async ({ message, composerMode = "chat", mode = selectedMode, provider = selectedProvider }) => {'
new_sig = 'const sendMessage = useCallback(async ({ message, composerMode = "chat", mode = selectedMode, provider = selectedProvider, webSearchEnabled = false }) => {'

if old_sig in s:
    s = s.replace(old_sig, new_sig, 1)

insert = r'''    const requestedWebSearch =
      webSearchEnabled ||
      /^\s*(search the web|web search|search online|look up|find latest|latest)\b/i.test(trimmed);

    if (requestedWebSearch) {
      const query = trimmed
        .replace(/^\s*(search the web for|search the web|web search for|web search|search online for|search online|look up|find latest|latest)\s*/i, "")
        .trim() || trimmed;

      setActivity(createActivity("thinking", "tool", "Searching the web…"));
      setMessages((current) => [...current, {
        id: assistantId,
        role: "assistant",
        content: "Searching the web…",
        isStreaming: true,
        status: "thinking",
        createdAt: new Date().toISOString()
      }]);

      try {
        const searchResponse = await fetch("/api/streams-ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        const searchData = await searchResponse.json();

        if (!searchResponse.ok || !searchData?.ok) {
          throw new Error(searchData?.error || "Web search failed");
        }

        const sourceLines = Array.isArray(searchData.annotations) && searchData.annotations.length
          ? "\n\nSources:\n" + searchData.annotations.map((annotation, index) => {
              const title = annotation.title || annotation.url || `Source ${index + 1}`;
              const url = annotation.url ? ` — ${annotation.url}` : "";
              return `${index + 1}. ${title}${url}`;
            }).join("\n")
          : "";

        setMessages((current) => current.map((item) => item.id === assistantId ? {
          ...item,
          content: `${searchData.text || "No search answer returned."}${sourceLines}`,
          isStreaming: false,
          status: "complete",
          sources: searchData.annotations || [],
        } : item));

        setActivity(createActivity("complete", "tool", "Search complete"));
      } catch (error) {
        setMessages((current) => current.map((item) => item.id === assistantId ? {
          ...item,
          content: `Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          isStreaming: false,
          status: "error",
        } : item));
        setActivity(createActivity("error", "tool", "Search failed"));
      }

      return;
    }

'''

if "const requestedWebSearch =" not in s:
    candidates = [
        '    if (composerMode === "url") {',
        "    if (composerMode === 'url') {",
        '    if (isImageRequest) {',
        '    setActivity(createActivity("thinking", "chat", CHAT_STATUS_FALLBACK));',
    ]
    for needle in candidates:
        if needle in s:
            s = s.replace(needle, insert + needle, 1)
            break
    else:
        raise SystemExit("No stable insertion point found in useStreamsChatRuntime.js")

old_placeholder = '''            } else if (name === "web_search") {
              setMessages((current) => current.map(item => item.id === assistantId ? { ...item, content: `**Web Search Requested:** "${args?.query}"\\n\\n*Note: Web search requires a backend API configuration (like Tavily or Serper) which is not currently integrated in STREAMS.*`, isStreaming: false, status: "complete" } : item));
              setActivity(createActivity("complete", "tool", "Search aborted"));
            }'''

new_placeholder = '''            } else if (name === "web_search") {
              const query = String(args?.query || trimmed || "").trim();
              setActivity(createActivity("thinking", "tool", "Searching the web…"));

              try {
                const searchResponse = await fetch("/api/streams-ai/search", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ query }),
                });

                const searchData = await searchResponse.json();

                if (!searchResponse.ok || !searchData?.ok) {
                  throw new Error(searchData?.error || "Web search failed");
                }

                setMessages((current) => current.map(item => item.id === assistantId ? {
                  ...item,
                  content: searchData.text || "No search answer returned.",
                  isStreaming: false,
                  status: "complete",
                  sources: searchData.annotations || [],
                } : item));

                setActivity(createActivity("complete", "tool", "Search complete"));
              } catch (error) {
                setMessages((current) => current.map(item => item.id === assistantId ? {
                  ...item,
                  content: `Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                  isStreaming: false,
                  status: "error",
                } : item));
                setActivity(createActivity("error", "tool", "Search failed"));
              }
            }'''

if old_placeholder in s:
    s = s.replace(old_placeholder, new_placeholder, 1)

runtime.write_text(s, encoding="utf-8")

print("✅ patch file applied")
