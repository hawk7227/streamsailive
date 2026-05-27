import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createStreamsRealtimeClientSecret } from "@/lib/streams-ai/realtime/create-realtime-session";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const bearerClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user: bearerUser },
  } = await bearerClient.auth.getUser(token);

  return bearerUser || null;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized: sign in before starting a voice conversation. Server did not receive a Supabase cookie or bearer session.",
      },
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
