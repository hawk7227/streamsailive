import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type GroupAction = "create" | "invite" | "remove" | "leave" | "rename";

type Body = {
  sessionId?: string;
  action?: GroupAction;
  email?: string;
  name?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isAction(value: unknown): value is GroupAction {
  return (
    value === "create" ||
    value === "invite" ||
    value === "remove" ||
    value === "leave" ||
    value === "rename"
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: sign in before changing group chat." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const sessionId = String(body.sessionId || "").trim();
  const action = body.action;

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
  }

  if (!isAction(action)) {
    return NextResponse.json(
      { ok: false, error: "action must be create, invite, remove, leave, or rename" },
      { status: 400 }
    );
  }

  const { data: existing, error: lookupError } = await supabase
    .from("streams_chat_sessions")
    .select("id,user_id,title,metadata")
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
    return NextResponse.json({ ok: false, error: "Session not found for this user." }, { status: 404 });
  }

  const metadata =
    existing.metadata && typeof existing.metadata === "object"
      ? { ...existing.metadata }
      : {};

  const groupChat =
    metadata.group_chat && typeof metadata.group_chat === "object"
      ? { ...metadata.group_chat }
      : {
          enabled: false,
          name: existing.title || "Group chat",
          owner_user_id: user.id,
          participants: [],
          invitations: [],
          events: [],
        };

  const participants = Array.isArray(groupChat.participants) ? [...groupChat.participants] : [];
  const invitations = Array.isArray(groupChat.invitations) ? [...groupChat.invitations] : [];
  const events = Array.isArray(groupChat.events) ? [...groupChat.events] : [];

  const pushEvent = (event: Record<string, unknown>) => {
    events.unshift({
      ...event,
      at: nowIso(),
      actor_user_id: user.id,
    });
    groupChat.events = events.slice(0, 50);
  };

  if (action === "create") {
    groupChat.enabled = true;
    groupChat.owner_user_id = groupChat.owner_user_id || user.id;
    groupChat.name = String(body.name || groupChat.name || existing.title || "Group chat");
    groupChat.created_at = groupChat.created_at || nowIso();

    if (!participants.some((participant: any) => participant.user_id === user.id)) {
      participants.push({
        user_id: user.id,
        email: user.email || "",
        role: "owner",
        status: "active",
        joined_at: nowIso(),
      });
    }

    groupChat.participants = participants;
    pushEvent({ type: "group_created" });
  }

  if (action === "rename") {
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    }

    groupChat.enabled = true;
    groupChat.name = name;
    groupChat.renamed_at = nowIso();
    pushEvent({ type: "group_renamed", name });
  }

  if (action === "invite") {
    const email = cleanEmail(body.email);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 });
    }

    groupChat.enabled = true;

    const existingInvite = invitations.find((invite: any) => cleanEmail(invite.email) === email);
    if (!existingInvite) {
      invitations.push({
        email,
        status: "pending",
        invited_by_user_id: user.id,
        invited_at: nowIso(),
      });
    }

    groupChat.invitations = invitations;
    pushEvent({ type: "participant_invited", email });
  }

  if (action === "remove") {
    const email = cleanEmail(body.email);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 });
    }

    groupChat.participants = participants.filter((participant: any) => cleanEmail(participant.email) !== email);
    groupChat.invitations = invitations.map((invite: any) =>
      cleanEmail(invite.email) === email
        ? { ...invite, status: "removed", removed_at: nowIso(), removed_by_user_id: user.id }
        : invite
    );

    pushEvent({ type: "participant_removed", email });
  }

  if (action === "leave") {
    groupChat.participants = participants.map((participant: any) =>
      participant.user_id === user.id || cleanEmail(participant.email) === cleanEmail(user.email)
        ? { ...participant, status: "left", left_at: nowIso() }
        : participant
    );

    pushEvent({ type: "participant_left", email: user.email || "" });
  }

  groupChat.participants = groupChat.participants || participants;
  groupChat.invitations = groupChat.invitations || invitations;
  groupChat.updated_at = nowIso();

  metadata.group_chat = groupChat;
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
      { ok: false, error: "Group chat update failed.", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    action,
    groupChat,
    session: updated,
  });
}
