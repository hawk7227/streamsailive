import { createHash, verify as verifySignature } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

function validChallenge(profile: Record<string, unknown> | null, purpose: string, challenge: string) {
  return Boolean(
    profile
    && profile.challenge_purpose === purpose
    && profile.challenge === challenge
    && typeof profile.challenge_expires_at === "string"
    && new Date(profile.challenge_expires_at).getTime() > Date.now(),
  );
}

function parseClientData(encoded: string) {
  return JSON.parse(decode(encoded).toString("utf8")) as { type?: string; challenge?: string; origin?: string };
}

function requestOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return configured || new URL(request.url).origin;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    action?: string;
    credentialId?: string;
    publicKeySpki?: string;
    clientDataJSON?: string;
    authenticatorData?: string;
    signature?: string;
  };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("streams_visions_identity_profiles").select("*").eq("user_id", user.id).maybeSingle();

  if (body.action === "register") {
    if (!body.credentialId || !body.publicKeySpki || !body.clientDataJSON) return NextResponse.json({ error: "The device credential is incomplete." }, { status: 400 });
    let clientData: { type?: string; challenge?: string; origin?: string };
    try { clientData = parseClientData(body.clientDataJSON); } catch { return NextResponse.json({ error: "The device credential could not be read." }, { status: 400 }); }
    if (clientData.type !== "webauthn.create" || !clientData.challenge || !validChallenge(profile, "webauthn_register", clientData.challenge)) return NextResponse.json({ error: "The device registration challenge is invalid or expired." }, { status: 409 });
    if (clientData.origin !== requestOrigin(request)) return NextResponse.json({ error: "The device registration origin does not match Streams." }, { status: 403 });
    const publicKey = decode(body.publicKeySpki);
    if (publicKey.length < 64 || publicKey.length > 1024) return NextResponse.json({ error: "The device public key is invalid." }, { status: 422 });

    const { error } = await admin.from("streams_visions_identity_profiles").upsert({
      user_id: user.id,
      biometric_lock_enabled: true,
      biometric_credential_id: body.credentialId,
      biometric_public_key: body.publicKeySpki,
      biometric_registered_at: new Date().toISOString(),
      biometric_sign_count: 0,
      challenge: null,
      challenge_purpose: null,
      challenge_expires_at: null,
    }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "The device lock could not be enabled." }, { status: 500 });
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "biometric_registered", result: "success" });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "authenticate") {
    if (!body.credentialId || !body.clientDataJSON || !body.authenticatorData || !body.signature) return NextResponse.json({ error: "The device authentication response is incomplete." }, { status: 400 });
    if (!profile?.biometric_lock_enabled || profile.biometric_credential_id !== body.credentialId || typeof profile.biometric_public_key !== "string") return NextResponse.json({ error: "This device is not registered for the account." }, { status: 403 });
    let clientData: { type?: string; challenge?: string; origin?: string };
    try { clientData = parseClientData(body.clientDataJSON); } catch { return NextResponse.json({ error: "The device response could not be read." }, { status: 400 }); }
    if (clientData.type !== "webauthn.get" || !clientData.challenge || !validChallenge(profile, "webauthn_authenticate", clientData.challenge)) return NextResponse.json({ error: "The device authentication challenge is invalid or expired." }, { status: 409 });
    if (clientData.origin !== requestOrigin(request)) return NextResponse.json({ error: "The device authentication origin does not match Streams." }, { status: 403 });

    const authenticatorData = decode(body.authenticatorData);
    if (authenticatorData.length < 37) return NextResponse.json({ error: "The authenticator response is invalid." }, { status: 422 });
    const rpId = new URL(requestOrigin(request)).hostname;
    const expectedRpIdHash = createHash("sha256").update(rpId).digest();
    if (!authenticatorData.subarray(0, 32).equals(expectedRpIdHash)) return NextResponse.json({ error: "The device credential is registered to a different site." }, { status: 403 });
    const flags = authenticatorData[32];
    if ((flags & 0x01) === 0) return NextResponse.json({ error: "User presence was not confirmed by the device." }, { status: 403 });

    const clientDataHash = createHash("sha256").update(decode(body.clientDataJSON)).digest();
    const signedData = Buffer.concat([authenticatorData, clientDataHash]);
    const verified = verifySignature("sha256", signedData, { key: decode(profile.biometric_public_key), format: "der", type: "spki" }, decode(body.signature));
    if (!verified) {
      await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "biometric_authentication", result: "failed_signature" });
      return NextResponse.json({ error: "The device could not verify access to private visions." }, { status: 403 });
    }

    const signCount = authenticatorData.readUInt32BE(33);
    const previousCount = Number(profile.biometric_sign_count || 0);
    if (previousCount > 0 && signCount > 0 && signCount <= previousCount) return NextResponse.json({ error: "The device credential counter did not advance." }, { status: 409 });
    await admin.from("streams_visions_identity_profiles").update({
      biometric_sign_count: signCount,
      last_biometric_verified_at: new Date().toISOString(),
      challenge: null,
      challenge_purpose: null,
      challenge_expires_at: null,
    }).eq("user_id", user.id);
    await admin.from("streams_visions_identity_events").insert({ user_id: user.id, event_type: "biometric_authentication", result: "success" });
    return NextResponse.json({ ok: true, verifiedAt: new Date().toISOString() });
  }

  return NextResponse.json({ error: "Unsupported biometric action." }, { status: 400 });
}
