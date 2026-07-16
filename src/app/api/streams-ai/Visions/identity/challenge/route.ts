import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PURPOSES = new Set(["capture", "webauthn_register", "webauthn_authenticate"]);
const CAPTURE_STEPS = ["front", "left_three_quarter", "right_three_quarter", "upper_body"];

function randomChallenge() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { purpose?: string };
  const purpose = String(body.purpose || "");
  if (!PURPOSES.has(purpose)) return NextResponse.json({ error: "Unsupported challenge purpose." }, { status: 400 });

  const admin = createAdminClient();
  const challenge = randomChallenge();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await admin.from("streams_visions_identity_profiles").upsert({
    user_id: user.id,
    challenge,
    challenge_purpose: purpose,
    challenge_expires_at: expiresAt,
    ...(purpose === "capture" ? { liveness_status: "capturing", likeness_profile_status: "capturing" } : {}),
  }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "A secure challenge could not be created." }, { status: 500 });

  const response: Record<string, unknown> = { challenge, expiresAt };
  if (purpose === "capture") {
    const sequence = [...CAPTURE_STEPS].sort(() => Math.random() - 0.5);
    response.sequence = sequence;
    response.captureWindowMs = 180000;
  }
  return NextResponse.json(response);
}
