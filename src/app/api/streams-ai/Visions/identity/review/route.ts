import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const configuredSecret = process.env.ADMIN_SECRET_KEY;
  const providedSecret = request.headers.get("x-admin-secret");
  if (!configuredSecret || !providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { userId?: string; decision?: string; reason?: string };
  const userId = String(body.userId || "");
  const decision = String(body.decision || "");
  const reason = String(body.reason || "").slice(0, 500);
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["approve", "retake", "reject"].includes(decision)) {
    return NextResponse.json({ error: "userId and a valid review decision are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const update = decision === "approve"
    ? { liveness_status: "verified", likeness_profile_status: "approved", review_reason: null, verified_at: now }
    : decision === "retake"
      ? { liveness_status: "retake_required", likeness_profile_status: "retake_required", review_reason: reason || "Retake the required likeness images.", verified_at: null }
      : { liveness_status: "rejected", likeness_profile_status: "rejected", review_reason: reason || "The identity submission did not pass review.", verified_at: null };

  const { data: profile, error } = await admin
    .from("streams_visions_identity_profiles")
    .update(update)
    .eq("user_id", userId)
    .select("user_id,liveness_status,likeness_profile_status,review_reason,verified_at")
    .maybeSingle();
  if (error || !profile) return NextResponse.json({ error: "The identity profile could not be reviewed." }, { status: 404 });

  await admin.from("streams_visions_likeness_assets").update({ verification_status: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "submitted" }).eq("user_id", userId).is("deleted_at", null);
  await admin.from("streams_visions_identity_events").insert({ user_id: userId, event_type: "manual_review_completed", result: decision, metadata: { reason } });
  return NextResponse.json({ ok: true, profile });
}
