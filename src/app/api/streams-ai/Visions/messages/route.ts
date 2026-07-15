import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STREAMS_VISIONS_SYSTEM_PROMPT } from "@/lib/streams-visions/prompts";
import type { VisionsPreviewSpec } from "@/lib/streams-visions/types";

function parseModelJson(raw: string): { reply: string; visual: Omit<VisionsPreviewSpec, "id"> | null } {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const visual = parsed.visual && typeof parsed.visual === "object" ? parsed.visual : null;
    return { reply: String(parsed.reply || "I’m ready to help."), visual };
  } catch {
    return { reply: raw || "I’m ready to help.", visual: null };
  }
}

function disabled() {
  return process.env.STREAMS_VISIONS_ENABLED === "false";
}

export async function GET(request: NextRequest) {
  if (disabled()) return NextResponse.json({ error: "Streams Visions is disabled" }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("streams_visions_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data || [] });
}

export async function POST(request: NextRequest) {
  if (disabled()) return NextResponse.json({ error: "Streams Visions is disabled" }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const conversationId = String(body.conversationId || "");
  const content = String(body.content || "").trim();
  const mode = body.mode === "off" || body.mode === "automatic" ? body.mode : "ask_first";
  if (!conversationId || !content) return NextResponse.json({ error: "conversationId and content required" }, { status: 400 });
  if (content.length > 12000) return NextResponse.json({ error: "Message is too long" }, { status: 413 });

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
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(20);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Visions provider is not configured" }, { status: 503 });

  const providerResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model: process.env.STREAMS_VISIONS_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STREAMS_VISIONS_SYSTEM_PROMPT },
        { role: "system", content: `Current Visions mode: ${mode}. ${mode === "off" ? "Always return visual as null." : "Create a visual only when it directly improves the user's request."}` },
        ...(history || []).map((message) => ({ role: message.role, content: message.content })),
      ],
    }),
  });

  const providerJson = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) return NextResponse.json({ error: providerJson?.error?.message || "Visions provider failed" }, { status: 502 });

  const raw = providerJson?.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(raw);
  const preview = parsed.visual && mode !== "off" ? {
    id: crypto.randomUUID(),
    title: String(parsed.visual.title || "New vision").slice(0, 80),
    eyebrow: String(parsed.visual.eyebrow || "STREAMS VISIONS").slice(0, 60),
    headline: String(parsed.visual.headline || "Your idea, visible.").slice(0, 160),
    subheadline: String(parsed.visual.subheadline || "A visual direction based on your conversation.").slice(0, 280),
    primaryCta: String(parsed.visual.primaryCta || "Get Started").slice(0, 40),
    secondaryCta: String(parsed.visual.secondaryCta || "Learn More").slice(0, 40),
    accent: /^#[0-9a-f]{6}$/i.test(String(parsed.visual.accent || "")) ? String(parsed.visual.accent) : "#6f5cff",
    sections: Array.isArray(parsed.visual.sections) ? parsed.visual.sections.slice(0, 3).map((section: any) => ({ title: String(section?.title || "Feature").slice(0, 60), body: String(section?.body || "").slice(0, 180) })) : [],
  } : null;

  const { data: assistantMessage, error: assistantError } = await supabase
    .from("streams_visions_messages")
    .insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: parsed.reply })
    .select("id,role,content,created_at")
    .single();
  if (assistantError) return NextResponse.json({ error: assistantError.message }, { status: 500 });

  const { error: conversationError } = await supabase
    .from("streams_visions_conversations")
    .update({ active_preview: preview, mode, updated_at: new Date().toISOString(), title: content.slice(0, 80) })
    .eq("id", conversationId)
    .eq("user_id", user.id);
  if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 });

  return NextResponse.json({ conversationId, userMessage, message: assistantMessage, preview });
}
