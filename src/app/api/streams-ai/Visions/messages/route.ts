import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STREAMS_VISIONS_SYSTEM_PROMPT } from "@/lib/streams-visions/prompts";
import type { VisionsPreviewSpec } from "@/lib/streams-visions/types";

function parseModelJson(raw: string): { reply: string; visual: Omit<VisionsPreviewSpec, "id"> | null } {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return { reply: String(parsed.reply || "I’m ready to help."), visual: parsed.visual || null };
  } catch {
    return { reply: raw || "I’m ready to help.", visual: null };
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("streams_visions_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const conversationId = String(body.conversationId || "");
  const content = String(body.content || "").trim();
  const mode = body.mode === "off" || body.mode === "automatic" ? body.mode : "ask_first";
  if (!conversationId || !content) return NextResponse.json({ error: "conversationId and content required" }, { status: 400 });

  const { data: conversation } = await supabase
    .from("streams_visions_conversations")
    .select("id,user_id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { data: userMessage, error: userMessageError } = await supabase
    .from("streams_visions_messages")
    .insert({ conversation_id: conversationId, user_id: user.id, role: "user", content })
    .select("id,role,content,created_at")
    .single();
  if (userMessageError) return NextResponse.json({ error: userMessageError.message }, { status: 500 });

  const { data: history } = await supabase
    .from("streams_visions_messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Visions provider is not configured" }, { status: 503 });

  const providerResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.STREAMS_VISIONS_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STREAMS_VISIONS_SYSTEM_PROMPT },
        ...(history || []).map((message) => ({ role: message.role, content: message.content })),
        { role: "user", content: `Visions mode is ${mode}. ${mode === "off" ? "Do not create a visual." : "Create a visual only when useful."}\n\n${content}` },
      ],
    }),
  });

  const providerJson = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) return NextResponse.json({ error: providerJson?.error?.message || "Visions provider failed" }, { status: 502 });

  const raw = providerJson?.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(raw);
  const preview = parsed.visual && mode !== "off" ? { ...parsed.visual, id: crypto.randomUUID() } : null;

  const { data: assistantMessage, error: assistantError } = await supabase
    .from("streams_visions_messages")
    .insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: parsed.reply })
    .select("id,role,content,created_at")
    .single();
  if (assistantError) return NextResponse.json({ error: assistantError.message }, { status: 500 });

  await supabase
    .from("streams_visions_conversations")
    .update({ active_preview: preview, mode, updated_at: new Date().toISOString(), title: content.slice(0, 80) })
    .eq("id", conversationId)
    .eq("user_id", user.id);

  return NextResponse.json({ conversationId, userMessage, message: assistantMessage, preview });
}
