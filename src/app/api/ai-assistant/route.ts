import { NextResponse } from "next/server";
import { createAssistantChatResponse, PipelineContext } from "@/lib/openai/responses";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { messages?: unknown; context?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, context } = payload;

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }
  if (!context || typeof context !== "object") {
    return NextResponse.json({ error: "context object is required" }, { status: 400 });
  }

  try {
    const result = await createAssistantChatResponse(
      messages as Parameters<typeof createAssistantChatResponse>[0],
      context as PipelineContext
    );
    return NextResponse.json({
      message: result.message,
      actions: result.actions,
      // Legacy compat
      reply: result.reply,
      action: result.action,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Assistant failed" },
      { status: 500 }
    );
  }
}
