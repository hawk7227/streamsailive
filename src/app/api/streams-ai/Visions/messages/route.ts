import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STREAMS_VISIONS_SYSTEM_PROMPT } from "@/lib/streams-visions/prompts";
import type { VisionsPreviewSpec } from "@/lib/streams-visions/types";

function parseModelJson(raw: string): { reply: string; visual: Omit<VisionsPreviewSpec, "id"> | null } {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const visual = parsed.visual && typeof parsed.visual === "object" ? parsed.visual : null;
    return { reply: String(parsed.reply || "I’m with you."), visual };
  } catch {
    return { reply: raw || "I’m with you.", visual: null };
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

  const [{ data: messages, error }, { data: conversation }] = await Promise.all([
    supabase.from("streams_visions_messages").select("id,role,content,created_at").eq("conversation_id", conversationId).eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("streams_visions_conversations").select("active_preview,mode").eq("id", conversationId).eq("user_id", user.id).maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: messages || [], preview: conversation?.active_preview || null, mode: conversation?.mode || "ask_first" });
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

  const { data: conversation } = await supabase.from("streams_visions_conversations").select("id,user_id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { data: userMessage, error: userMessageError } = await supabase.from("streams_visions_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", content }).select("id,role,content,created_at").single();
  if (userMessageError) return NextResponse.json({ error: userMessageError.message }, { status: 500 });

  const { data: history } = await supabase.from("streams_visions_messages").select("role,content").eq("conversation_id", conversationId).eq("user_id", user.id).order("created_at", { ascending: true }).limit(20);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Visions is not configured" }, { status: 503 });

  const providerResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model: process.env.STREAMS_VISIONS_MODEL || "gpt-4o-mini",
      temperature: 0.78,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STREAMS_VISIONS_SYSTEM_PROMPT },
        { role: "system", content: `Current Visions mode: ${mode}. ${mode === "off" ? "Always return visual as null." : "Create a visual only when it directly deepens the user's request."}` },
        ...(history || []).map((message) => ({ role: message.role, content: message.content })),
      ],
    }),
  });

  const providerJson = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) return NextResponse.json({ error: "Visions could not shape that scene" }, { status: 502 });

  const parsed = parseModelJson(providerJson?.choices?.[0]?.message?.content || "");
  const visual = parsed.visual as Record<string, unknown> | null;
  const preview: VisionsPreviewSpec | null = visual && mode !== "off" ? {
    id: crypto.randomUUID(),
    title: String(visual.title || "New vision").slice(0, 80),
    eyebrow: String(visual.eyebrow || "A FUTURE COMING INTO VIEW").slice(0, 60),
    headline: String(visual.headline || "Your idea, becoming real.").slice(0, 160),
    subheadline: String(visual.subheadline || "A future scene shaped from what matters to you.").slice(0, 280),
    primaryCta: String(visual.primaryCta || "Enter vision").slice(0, 40),
    secondaryCta: String(visual.secondaryCta || "Continue this vision").slice(0, 40),
    accent: /^#[0-9a-f]{6}$/i.test(String(visual.accent || "")) ? String(visual.accent) : "#7568ff",
    atmosphere: String(visual.atmosphere || "Soft light, depth, and a calm cinematic atmosphere.").slice(0, 320),
    futureSelf: String(visual.futureSelf || "A non-identifying future version of the user is present inside the scene.").slice(0, 320),
    environment: String(visual.environment || "A believable environment showing the goal working in everyday life.").slice(0, 320),
    motion: String(visual.motion || "Slow parallax, drifting light, and gentle human movement.").slice(0, 240),
    emotionalOutcome: String(visual.emotionalOutcome || "Confidence, relief, and the feeling that the future is possible.").slice(0, 240),
    revealMs: Math.min(8000, Math.max(4200, Number(visual.revealMs) || 5200)),
    sections: Array.isArray(visual.sections) ? visual.sections.slice(0, 3).map((section: any) => ({ title: String(section?.title || "Visible detail").slice(0, 60), body: String(section?.body || "").slice(0, 180) })) : [],
  } : null;

  const { data: assistantMessage, error: assistantError } = await supabase.from("streams_visions_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: parsed.reply }).select("id,role,content,created_at").single();
  if (assistantError) return NextResponse.json({ error: assistantError.message }, { status: 500 });

  const { error: conversationError } = await supabase.from("streams_visions_conversations").update({ active_preview: preview, mode, updated_at: new Date().toISOString(), title: content.slice(0, 80) }).eq("id", conversationId).eq("user_id", user.id);
  if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 });

  return NextResponse.json({ conversationId, userMessage, message: assistantMessage, preview });
}
