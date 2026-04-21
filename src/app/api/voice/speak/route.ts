import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { generateVoice } from "@/lib/voice-runtime/generateVoice";
import { listVoices } from "@/lib/voice/tts";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    text?: string;
    voice?: string;
    provider?: "elevenlabs" | "openai";
    speed?: number;
    style?: string;
    emotion?: string;
    format?: "mp3" | "wav";
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (body.text.length > 5000) {
    return NextResponse.json({ error: "Text too long. Max 5000 chars." }, { status: 400 });
  }

  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);
  const workspaceId = selection.current.workspace.id;

  try {
    // Delegate to the single authoritative voice generation gate.
    // generateVoice() handles normalization, validation, TTS, upload, and persistence.
    const result = await generateVoice({
      text: body.text,
      voice: body.voice,
      provider: body.provider,
      speed: body.speed,
      style: body.style,
      emotion: body.emotion,
      format: body.format,
      workspaceId,
    });

    return NextResponse.json({
      ok: result.ok,
      generationId: result.generationId,
      status: result.status,
      outputUrl: result.outputUrl,
      provider: result.provider,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voice generation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const voices = await listVoices();
  return NextResponse.json({ data: voices });
}
