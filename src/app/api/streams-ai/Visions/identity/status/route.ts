import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VISIONS_IDENTITY_CONSENT_VERSION,
  VISIONS_LIKENESS_BUCKET,
  canEnterVisions,
  type VisionsIdentityStatus,
} from "@/lib/streams-visions/identity";

export const dynamic = "force-dynamic";

type AuthUserShape = {
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
};

function profileStatus(user: AuthUserShape, profile: Record<string, unknown> | null, assetCount: number): VisionsIdentityStatus {
  const fullName = typeof profile?.full_name === "string" ? profile.full_name : String(user.user_metadata?.full_name || "");
  const dateOfBirth = typeof profile?.date_of_birth === "string" ? profile.date_of_birth : "";
  const country = typeof profile?.country === "string" ? profile.country : "";
  const stateRegion = typeof profile?.state_region === "string" ? profile.state_region : "";
  const accountDetailsComplete = Boolean(fullName.trim() && dateOfBirth && country.trim() && stateRegion.trim());
  const status: VisionsIdentityStatus = {
    authenticated: true,
    emailVerified: Boolean(user.email_confirmed_at),
    phoneVerified: Boolean(user.phone_confirmed_at),
    phone: String(user.phone || ""),
    accountDetailsComplete,
    fullName,
    dateOfBirth,
    country,
    stateRegion,
    noticeAccepted: Boolean(profile?.notice_accepted_at) && profile?.consent_version === VISIONS_IDENTITY_CONSENT_VERSION,
    consentVersion: typeof profile?.consent_version === "string" ? profile.consent_version : null,
    livenessStatus: (profile?.liveness_status as VisionsIdentityStatus["livenessStatus"]) || "not_started",
    likenessProfileStatus: (profile?.likeness_profile_status as VisionsIdentityStatus["likenessProfileStatus"]) || "locked",
    biometricLockEnabled: Boolean(profile?.biometric_lock_enabled),
    reviewReason: typeof profile?.review_reason === "string" ? profile.review_reason : null,
    assetCount,
    requiredAssetCount: 4,
    canEnterVisions: false,
  };
  status.canEnterVisions = canEnterVisions(status);
  return status;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { count }] = await Promise.all([
    admin.from("streams_visions_identity_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("streams_visions_likeness_assets").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
  ]);

  return NextResponse.json({ status: profileStatus(user, profile, count || 0) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    action?: string;
    confirmations?: boolean[];
    fullName?: string;
    dateOfBirth?: string;
    country?: string;
    stateRegion?: string;
  };
  const admin = createAdminClient();

  if (body.action === "save_account_details") {
    const fullName = String(body.fullName || "").trim();
    const dateOfBirth = String(body.dateOfBirth || "");
    const country = String(body.country || "").trim();
    const stateRegion = String(body.stateRegion || "").trim();
    if (fullName.length < 2 || fullName.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || country.length < 2 || country.length > 80 || stateRegion.length < 2 || stateRegion.length > 100) {
      return NextResponse.json({ error: "Complete your name, date of birth, country, and state or region." }, { status: 400 });
    }
    const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
    const ageMs = Date.now() - birthDate.getTime();
    if (!Number.isFinite(birthDate.getTime()) || ageMs < 13 * 365.2425 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Streams Visions requires an eligible date of birth." }, { status: 400 });
    }
    const { error } = await admin.from("streams_visions_identity_profiles").upsert({ user_id: user.id, full_name: fullName, date_of_birth: dateOfBirth, country, state_region: stateRegion, deleted_at: null }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "Account details could not be saved." }, { status: 500 });
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "account_details_saved", result: "success" });
    return GET();
  }

  if (body.action === "accept_notice") {
    if (!Array.isArray(body.confirmations) || body.confirmations.length !== 3 || body.confirmations.some((value) => value !== true)) {
      return NextResponse.json({ error: "All identity and privacy confirmations are required." }, { status: 400 });
    }
    const { error } = await admin.from("streams_visions_identity_profiles").upsert({
      user_id: user.id,
      consent_version: VISIONS_IDENTITY_CONSENT_VERSION,
      notice_accepted_at: new Date().toISOString(),
      deleted_at: null,
    }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "Identity consent could not be saved." }, { status: 500 });
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "notice_accepted", result: "success", metadata: { consent_version: VISIONS_IDENTITY_CONSENT_VERSION } });
    return GET();
  }

  if (body.action === "replace_likeness") {
    const { data: assets } = await admin.from("streams_visions_likeness_assets").select("storage_path").eq("user_id", user.id).is("deleted_at", null);
    const paths = (assets || []).map((asset) => asset.storage_path);
    if (paths.length) await admin.storage.from(VISIONS_LIKENESS_BUCKET).remove(paths);
    await admin.from("streams_visions_likeness_assets").update({ deleted_at: new Date().toISOString(), verification_status: "deleted" }).eq("user_id", user.id).is("deleted_at", null);
    await admin.from("streams_visions_identity_profiles").upsert({ user_id: user.id, liveness_status: "not_started", likeness_profile_status: "locked", review_reason: null, profile_asset_id: null, verified_at: null }, { onConflict: "user_id" });
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "likeness_replaced", result: "reset" });
    return GET();
  }

  if (body.action === "delete_likeness") {
    const { data: assets } = await admin.from("streams_visions_likeness_assets").select("storage_path").eq("user_id", user.id).is("deleted_at", null);
    const paths = (assets || []).map((asset) => asset.storage_path);
    if (paths.length) await admin.storage.from(VISIONS_LIKENESS_BUCKET).remove(paths);
    const now = new Date().toISOString();
    await admin.from("streams_visions_likeness_assets").update({ deleted_at: now, verification_status: "deleted" }).eq("user_id", user.id).is("deleted_at", null);
    await admin.from("streams_visions_identity_profiles").upsert({ user_id: user.id, likeness_profile_status: "deleted", liveness_status: "not_started", biometric_lock_enabled: false, biometric_credential_id: null, biometric_public_key: null, deleted_at: now }, { onConflict: "user_id" });
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "likeness_deleted", result: "visions_locked" });
    return NextResponse.json({ ok: true, visionsLocked: true });
  }

  if (body.action === "appeal") {
    await admin.from("streams_visions_identity_profiles").upsert({ user_id: user.id, liveness_status: "manual_review", likeness_profile_status: "pending_review", review_reason: "Appeal requested by user" }, { onConflict: "user_id" });
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "appeal_requested", result: "manual_review" });
    return GET();
  }

  if (body.action === "report_compromise") {
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "account_compromise_reported", result: "sessions_revoked" });
    await supabase.auth.signOut({ scope: "global" });
    return NextResponse.json({ ok: true, signedOut: true });
  }

  return NextResponse.json({ error: "Unsupported identity action." }, { status: 400 });
}
