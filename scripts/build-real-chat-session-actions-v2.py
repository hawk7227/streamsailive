from pathlib import Path

ROOT = Path.cwd()

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def write(path: str, text: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

# ---------------------------------------------------------------------
# 1. Add real session action route.
# ---------------------------------------------------------------------
write("src/app/api/streams-ai/sessions/actions/route.ts", '''import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SessionAction = "pin" | "unpin" | "archive" | "unarchive" | "delete";

type Body = {
  sessionId?: string;
  action?: SessionAction;
};

function isAction(value: unknown): value is SessionAction {
  return (
    value === "pin" ||
    value === "unpin" ||
    value === "archive" ||
    value === "unarchive" ||
    value === "delete"
  );
}

function nowIso() {
  return new Date().toISOString();
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: sign in before changing chat session state." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const sessionId = String(body.sessionId || "").trim();
  const action = body.action;

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "sessionId is required" },
      { status: 400 }
    );
  }

  if (!isAction(action)) {
    return NextResponse.json(
      { ok: false, error: "action must be pin, unpin, archive, unarchive, or delete" },
      { status: 400 }
    );
  }

  const { data: existing, error: lookupError } = await supabase
    .from("streams_chat_sessions")
    .select("id,user_id,metadata")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { ok: false, error: "Session lookup failed.", details: lookupError.message },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Session not found for this user." },
      { status: 404 }
    );
  }

  const metadata =
    existing.metadata && typeof existing.metadata === "object"
      ? { ...existing.metadata }
      : {};

  if (action === "pin") {
    metadata.pinned = true;
    metadata.pinned_at = nowIso();
  }

  if (action === "unpin") {
    metadata.pinned = false;
    metadata.unpinned_at = nowIso();
  }

  if (action === "archive") {
    metadata.archived = true;
    metadata.archived_at = nowIso();
  }

  if (action === "unarchive") {
    metadata.archived = false;
    metadata.unarchived_at = nowIso();
  }

  if (action === "delete") {
    metadata.deleted = true;
    metadata.deleted_at = nowIso();
  }

  metadata.updated_by_action = action;
  metadata.updated_at = nowIso();

  const { data: updated, error: updateError } = await supabase
    .from("streams_chat_sessions")
    .update({ metadata, updated_at: nowIso() })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id,title,metadata,updated_at,created_at")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: "Session update failed.", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    action,
    session: updated,
  });
}
''')

# ---------------------------------------------------------------------
# 2. Add client helper for real session actions.
# ---------------------------------------------------------------------
write("src/components/streams-ai/current-chat/new-face/runtime/streamsSessionActionsClient.js", '''import { emitChatActionActivity } from "./streamsGlobalActivityBridge";
import { STREAMS_ACTIVITY_PHASES } from "./streamsActivityEvents";

export async function runStreamsSessionAction({ sessionId, action }) {
  if (!sessionId) {
    throw new Error("No active chat session selected.");
  }

  emitChatActionActivity(
    STREAMS_ACTIVITY_PHASES.RUNNING,
    `${action} chat...`,
    { tool: action, sessionId }
  );

  const response = await fetch("/api/streams-ai/sessions/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    const reason = data?.error || data?.details || `${action} chat failed`;
    emitChatActionActivity(
      STREAMS_ACTIVITY_PHASES.FAILED,
      reason,
      { tool: action, sessionId }
    );
    throw new Error(reason);
  }

  emitChatActionActivity(
    STREAMS_ACTIVITY_PHASES.COMPLETE,
    `${action} chat complete`,
    { tool: action, sessionId }
  );

  return data;
}
''')

# ---------------------------------------------------------------------
# 3. Patch StreamsWorkspaceShell to import and expose real helper.
# ---------------------------------------------------------------------
shell_path = "src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx"
shell = read(shell_path)

if 'runStreamsSessionAction' not in shell:
    if 'import { emitChatActionActivity, emitGroupChatActivity } from "./runtime/streamsGlobalActivityBridge";' in shell:
        shell = shell.replace(
            'import { emitChatActionActivity, emitGroupChatActivity } from "./runtime/streamsGlobalActivityBridge";',
            'import { emitChatActionActivity, emitGroupChatActivity } from "./runtime/streamsGlobalActivityBridge";\nimport { runStreamsSessionAction } from "./runtime/streamsSessionActionsClient";'
        )
    else:
        shell = shell.replace(
            'import StreamsComposer from "./composer/StreamsComposer";',
            'import StreamsComposer from "./composer/StreamsComposer";\nimport { runStreamsSessionAction } from "./runtime/streamsSessionActionsClient";'
        )

if "async function runRealSessionAction" not in shell:
    marker = "function blockedMessageAction(actionName) {"
    if marker not in shell:
        marker = "function blockedChatAction(actionName) {"
    if marker not in shell:
        raise SystemExit("No blocked action function found to insert helper before.")

    helper = '''async function runRealSessionAction(chatRuntime, actionName, action) {
  const sessionId = chatRuntime?.sessionId || chatRuntime?.currentSessionId || chatRuntime?.activeSessionId;

  try {
    await runStreamsSessionAction({ sessionId, action });
    chatRuntime?.refreshSidebarData?.();
    if (action === "delete") {
      chatRuntime?.newChat?.();
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : `Failed to ${actionName}.`);
  }
}

'''
    shell = shell.replace(marker, helper + marker, 1)

# Best-effort replacement of existing blocked handlers if exact strings exist.
replacements = {
    'blockedChatAction("pin chat")': 'runRealSessionAction(chatRuntime, "pin chat", "pin")',
    'blockedChatAction("archive chat")': 'runRealSessionAction(chatRuntime, "archive chat", "archive")',
    'blockedChatAction("delete chat")': 'runRealSessionAction(chatRuntime, "delete chat", "delete")',
    'blockedMessageAction("pin chat")': 'runRealSessionAction(chatRuntime, "pin chat", "pin")',
    'blockedMessageAction("archive chat")': 'runRealSessionAction(chatRuntime, "archive chat", "archive")',
    'blockedMessageAction("delete chat")': 'runRealSessionAction(chatRuntime, "delete chat", "delete")',
    'blockedMessageAction("pin")': 'runRealSessionAction(chatRuntime, "pin chat", "pin")',
    'blockedMessageAction("archive")': 'runRealSessionAction(chatRuntime, "archive chat", "archive")',
    'blockedMessageAction("delete")': 'runRealSessionAction(chatRuntime, "delete chat", "delete")',
}
for old, new in replacements.items():
    shell = shell.replace(old, new)

write(shell_path, shell)

# ---------------------------------------------------------------------
# 4. Patch runtime return to expose session id + refreshSidebarData.
# ---------------------------------------------------------------------
runtime_path = "src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js"
runtime = read(runtime_path)

if "refreshSidebarData," not in runtime:
    runtime = runtime.replace(
        "    sessions,",
        "    sessions,\n    refreshSidebarData,",
        1
    )

if "currentSessionId:" not in runtime:
    runtime = runtime.replace(
        "    sessionId,",
        "    sessionId,\n    currentSessionId: sessionId,\n    activeSessionId: sessionId,",
        1
    )

write(runtime_path, runtime)

print("Built real chat session pin/archive/delete backend and client wiring.")
