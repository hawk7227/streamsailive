import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function missing(name: string) {
  return !process.env[name] || String(process.env[name]).trim().length === 0;
}

export async function GET() {
  const vapiMissing = [
    missing("NEXT_PUBLIC_VAPI_PUBLIC_KEY") ? "NEXT_PUBLIC_VAPI_PUBLIC_KEY" : "",
    missing("NEXT_PUBLIC_VAPI_ASSISTANT_ID") ? "NEXT_PUBLIC_VAPI_ASSISTANT_ID" : "",
  ].filter(Boolean);

  const wakeWordMissing = [
    missing("PICOVOICE_ACCESS_KEY") ? "PICOVOICE_ACCESS_KEY" : "",
    missing("NEXT_PUBLIC_PICOVOICE_WAKEWORD_MODEL_PATH") ? "NEXT_PUBLIC_PICOVOICE_WAKEWORD_MODEL_PATH" : "",
  ].filter(Boolean);

  return NextResponse.json({
    ok: true,
    route: "admingeneration-voice-session",
    vapi: {
      enabled: vapiMissing.length === 0,
      publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "",
      assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "",
      missing: vapiMissing,
    },
    wakeWord: {
      enabled: wakeWordMissing.length === 0,
      accessKey: process.env.PICOVOICE_ACCESS_KEY || "",
      modelPath: process.env.NEXT_PUBLIC_PICOVOICE_WAKEWORD_MODEL_PATH || "",
      label: "Hey Streams",
      missing: wakeWordMissing,
    },
    modes: ["wake-word", "push-to-talk", "manual"],
    memoryModes: ["none", "session", "project", "long-term", "full"],
    responseStyles: ["natural", "friendly", "professional", "director", "producer", "coach", "technical", "emotional", "fast", "detailed"],
  });
}
