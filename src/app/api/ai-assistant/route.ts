import { NextResponse } from "next/server";
import { createAssistantChatResponse } from "@/lib/openai/responses";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const { messages, context } = payload;

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
  }

  if (!context || typeof context !== "object") {
    return NextResponse.json({ error: "Context object is required" }, { status: 400 });
  }

  try {
    const { reply, action } = await createAssistantChatResponse(messages, context);
    return NextResponse.json({ reply, action });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Assistant failed",
      },
      { status: 500 }
    );
  }
}
