import { NextResponse, type NextRequest } from "next/server";
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

  return NextResponse.json({ ok: true, action, session: updated });
}
