import { NextResponse, type NextRequest } from "next/server";
import { createStreamsRealtimeClientSecret } from "@/lib/streams-ai/realtime/create-realtime-session";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: sign in before starting a voice conversation." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const result = await createStreamsRealtimeClientSecret({
    userId: user.id,
    workspaceId: body?.workspaceId,
    instructions: body?.instructions,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    source: "openai-realtime-webrtc",
    model: result.model,
    clientSecret: result.value,
    expiresAt: result.expiresAt,
  });
}
