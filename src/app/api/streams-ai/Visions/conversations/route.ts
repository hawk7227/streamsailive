import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVisionsIdentityAccess } from "@/lib/streams-visions/identity-server";

async function requireAccess(user: { id: string; email_confirmed_at?: string | null; phone_confirmed_at?: string | null }) {
  const access = await getVisionsIdentityAccess(user);
  if (!access.enrolled) return NextResponse.json({ error: "Complete the required Streams Visions identity setup first." }, { status: 403 });
  if (!access.biometricFresh) return NextResponse.json({ error: "Unlock Streams Visions with your protected device before continuing." }, { status: 423 });
  return null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireAccess(user);
  if (denied) return denied;

  const { data, error } = await supabase
    .from("streams_visions_conversations")
    .select("id,title,mode,active_preview,created_at,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireAccess(user);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const { data, error } = await supabase
    .from("streams_visions_conversations")
    .insert({ user_id: user.id, title: String(body.title || "New vision").slice(0, 100), mode: body.mode || "ask_first" })
    .select("id,title,mode,active_preview,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
