import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VISIONS_CAPTURE_TYPES,
  VISIONS_LIKENESS_BUCKET,
  type VisionsCaptureMetadata,
  type VisionsCaptureType,
} from "@/lib/streams-visions/identity";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

function isCaptureType(value: unknown): value is VisionsCaptureType {
  return typeof value === "string" && VISIONS_CAPTURE_TYPES.includes(value as VisionsCaptureType);
}

function challengeValid(profile: Record<string, unknown> | null, challenge: string) {
  return Boolean(
    profile
    && profile.challenge === challenge
    && profile.challenge_purpose === "capture"
    && typeof profile.challenge_expires_at === "string"
    && new Date(profile.challenge_expires_at).getTime() > Date.now(),
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    action?: string;
    challenge?: string;
    captureType?: string;
    contentType?: string;
    sizeBytes?: number;
    captures?: VisionsCaptureMetadata[];
  };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("streams_visions_identity_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!challengeValid(profile, String(body.challenge || ""))) {
    return NextResponse.json({ error: "The secure capture session expired. Start again." }, { status: 409 });
  }
  if (!profile?.notice_accepted_at) return NextResponse.json({ error: "Accept the Identity and Privacy Notice first." }, { status: 403 });

  if (body.action === "prepare") {
    if (!isCaptureType(body.captureType) || !ALLOWED_TYPES.has(String(body.contentType)) || !Number.isFinite(body.sizeBytes) || Number(body.sizeBytes) <= 0 || Number(body.sizeBytes) > MAX_BYTES) {
      return NextResponse.json({ error: "The capture does not meet the required image rules." }, { status: 422 });
    }
    const extension = body.contentType === "image/png" ? "png" : body.contentType === "image/webp" ? "webp" : "jpg";
    const storagePath = `${user.id}/source/${body.captureType}-${crypto.randomUUID()}.${extension}`;
    const { data, error } = await admin.storage.from(VISIONS_LIKENESS_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data) return NextResponse.json({ error: "A private upload could not be prepared." }, { status: 500 });
    return NextResponse.json({ storagePath, uploadUrl: data.signedUrl, token: data.token });
  }

  if (body.action === "finalize") {
    const captures = Array.isArray(body.captures) ? body.captures : [];
    if (captures.length !== VISIONS_CAPTURE_TYPES.length) return NextResponse.json({ error: "All four required likeness captures are required." }, { status: 422 });
    const seenTypes = new Set<string>();
    const seenHashes = new Set<string>();
    for (const capture of captures) {
      if (!isCaptureType(capture.captureType) || seenTypes.has(capture.captureType)) return NextResponse.json({ error: "Each required camera angle must be captured once." }, { status: 422 });
      if (!capture.storagePath.startsWith(`${user.id}/source/`)) return NextResponse.json({ error: "A capture path is not owned by this account." }, { status: 403 });
      if (!ALLOWED_TYPES.has(capture.contentType) || capture.sizeBytes <= 0 || capture.sizeBytes > MAX_BYTES || capture.width < 320 || capture.height < 320) return NextResponse.json({ error: "One or more captures do not meet the quality rules." }, { status: 422 });
      if (!/^[a-f0-9]{64}$/i.test(capture.sha256) || seenHashes.has(capture.sha256)) return NextResponse.json({ error: "The live captures must be distinct images." }, { status: 422 });
      seenTypes.add(capture.captureType);
      seenHashes.add(capture.sha256);
    }

    const { data: objects } = await admin.storage.from(VISIONS_LIKENESS_BUCKET).list(`${user.id}/source`, { limit: 100 });
    const objectNames = new Set((objects || []).map((item) => `${user.id}/source/${item.name}`));
    if (captures.some((capture) => !objectNames.has(capture.storagePath))) return NextResponse.json({ error: "A required private capture was not uploaded." }, { status: 409 });

    await admin.from("streams_visions_likeness_assets").update({ deleted_at: new Date().toISOString(), verification_status: "deleted" }).eq("user_id", user.id).is("deleted_at", null);
    const rows = captures.map((capture) => ({
      user_id: user.id,
      storage_path: capture.storagePath,
      capture_type: capture.captureType,
      sha256: capture.sha256.toLowerCase(),
      content_type: capture.contentType,
      size_bytes: capture.sizeBytes,
      width: capture.width,
      height: capture.height,
      verification_status: "submitted",
    }));
    const { data: saved, error: insertError } = await admin.from("streams_visions_likeness_assets").insert(rows).select("id,capture_type,storage_path");
    if (insertError || !saved) return NextResponse.json({ error: "The private likeness profile could not be saved." }, { status: 500 });

    let livenessStatus = "manual_review";
    let likenessStatus = "pending_review";
    let reviewReason = "A trained reviewer must confirm the live capture before Visions unlocks.";
    let providerReference: string | null = null;
    const providerUrl = process.env.STREAMS_VISIONS_IDENTITY_PROVIDER_URL;
    const providerSecret = process.env.STREAMS_VISIONS_IDENTITY_PROVIDER_SECRET;
    if (providerUrl && providerSecret) {
      const signed = await Promise.all(captures.map(async (capture) => {
        const { data } = await admin.storage.from(VISIONS_LIKENESS_BUCKET).createSignedUrl(capture.storagePath, 600);
        return { captureType: capture.captureType, url: data?.signedUrl || "", sha256: capture.sha256 };
      }));
      const providerResponse = await fetch(providerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerSecret}` },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ userReference: createHash("sha256").update(user.id).digest("hex"), captures: signed }),
      }).catch(() => null);
      if (providerResponse?.ok) {
        const result = await providerResponse.json().catch(() => ({})) as { verified?: boolean; reference?: string; reason?: string };
        providerReference = result.reference || null;
        if (result.verified === true) {
          livenessStatus = "verified";
          likenessStatus = "approved";
          reviewReason = null as unknown as string;
        } else if (result.reason) {
          reviewReason = result.reason.slice(0, 500);
        }
      }
    }

    const frontAsset = saved.find((asset) => asset.capture_type === "front");
    const retentionExpiresAt = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("streams_visions_identity_profiles").upsert({
      user_id: user.id,
      liveness_status: livenessStatus,
      likeness_profile_status: likenessStatus,
      review_reason: reviewReason,
      profile_asset_id: frontAsset?.id || null,
      provider_reference: providerReference,
      verified_at: livenessStatus === "verified" ? new Date().toISOString() : null,
      retention_expires_at: retentionExpiresAt,
      challenge: null,
      challenge_purpose: null,
      challenge_expires_at: null,
    }, { onConflict: "user_id" });
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "likeness_submitted", result: likenessStatus, metadata: { capture_count: captures.length, provider_configured: Boolean(providerUrl && providerSecret) } });
    return NextResponse.json({ ok: true, livenessStatus, likenessProfileStatus: likenessStatus, reviewReason });
  }

  return NextResponse.json({ error: "Unsupported capture action." }, { status: 400 });
}
