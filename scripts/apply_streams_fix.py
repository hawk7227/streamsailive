from pathlib import Path
import re

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

# 1) Restore realtime session route with bearer-session fallback.
write("src/app/api/streams-ai/realtime/session/route.ts", '''import { NextResponse, type NextRequest } from "next/server";
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
''')

# 2) Patch voice hook to send bearer token if AuthContext exposes session.
voice_path = "src/components/streams-ai/current-chat/new-face/voice/useRealtimeVoiceSession.js"
s = read(voice_path)

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

old_fetch = '''      const tokenResponse = await fetch("/api/streams-ai/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });'''

new_fetch = '''      const tokenResponse = await fetch("/api/streams-ai/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({}),
      });'''

if old_fetch in s:
    s = s.replace(old_fetch, new_fetch, 1)

write(voice_path, s)

# 3) Patch shell to forward webSearchEnabled instead of provider-only payload.
shell_path = "src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx"
s = read(shell_path)

new_submit = '''        onSubmit={(payload) => {
          chatRuntime?.sendMessage({
            message: payload.message,
            composerMode: payload.composerMode,
            mode: payload.mode,
            webSearchEnabled: payload.webSearchEnabled,
          });
        }}'''

pattern = re.compile(
    r'''        onSubmit=\{\(\{\s*message,\s*composerMode,\s*mode,\s*provider\s*\}\)\s*=>\s*\{\s*
          chatRuntime\?\.sendMessage\(\{\s*message,\s*composerMode,\s*mode,\s*provider\s*\}\);\s*
        \}\}''',
    re.MULTILINE,
)
s2, count = pattern.subn(new_submit, s, count=1)

if count == 0 and "onSubmit={({ message, composerMode, mode, provider })" in s:
    raise SystemExit("FAILED: old shell provider submit wrapper remains and could not be replaced.")

write(shell_path, s2)

# 4) Patch runtime so web search always uses /api/streams-ai/search.
runtime_path = "src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js"
s = read(runtime_path)

old_sig = 'const sendMessage = useCallback(async ({ message, composerMode = "chat", mode = selectedMode, provider = selectedProvider }) => {'
new_sig = 'const sendMessage = useCallback(async ({ message, composerMode = "chat", mode = selectedMode, provider = selectedProvider, webSearchEnabled = false }) => {'

if old_sig in s:
    s = s.replace(old_sig, new_sig, 1)

insert = '''    const requestedWebSearch =
      webSearchEnabled ||
      /^\\s*(search the web|web search|search online|look up|find latest|latest)\\b/i.test(trimmed);

    if (requestedWebSearch) {
      const query = trimmed
        .replace(/^\\s*(search the web for|search the web|web search for|web search|search online for|search online|look up|find latest|latest)\\s*/i, "")
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
          ? "\\n\\nSources:\\n" + searchData.annotations.map((annotation, index) => {
              const title = annotation.title || annotation.url || `Source ${index + 1}`;
              const url = annotation.url ? ` — ${annotation.url}` : "";
              return `${index + 1}. ${title}${url}`;
            }).join("\\n")
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
    inserted = False
    for needle in candidates:
        if needle in s:
            s = s.replace(needle, insert + needle, 1)
            inserted = True
            break
    if not inserted:
        raise SystemExit("FAILED: no stable insertion point found in useStreamsChatRuntime.js")

fake_start = s.find('            } else if (name === "web_search") {')
if fake_start != -1 and "Web Search Requested" in s[fake_start:fake_start + 900]:
    fake_end_marker = '              setActivity(createActivity("complete", "tool", "Search aborted"));\n            }'
    end_pos = s.find(fake_end_marker, fake_start)
    if end_pos == -1:
        raise SystemExit("FAILED: found fake web_search branch but could not find end marker.")
    end_pos += len(fake_end_marker)
    real_branch = '''            } else if (name === "web_search") {
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
    s = s[:fake_start] + real_branch + s[end_pos:]

write(runtime_path, s)

# Hard fail if known fake/old lines remain.
shell_check = read(shell_path)
runtime_check = read(runtime_path)

failures = []
if "onSubmit={({ message, composerMode, mode, provider })" in shell_check:
    failures.append("old shell provider submit wrapper remains")
if "Web Search Requested" in runtime_check:
    failures.append("fake Web Search Requested remains")
if "Search aborted" in runtime_check:
    failures.append("fake Search aborted remains")
if "const requestedWebSearch =" not in runtime_check:
    failures.append("requestedWebSearch direct branch missing")
if "webSearchEnabled" not in shell_check:
    failures.append("shell does not forward webSearchEnabled")
if "session?.access_token" not in read(voice_path):
    failures.append("voice bearer token missing")

if failures:
    raise SystemExit("FAILED:\\n- " + "\\n- ".join(failures))

print("SUCCESS: voice auth + direct web search routing fixed.")
