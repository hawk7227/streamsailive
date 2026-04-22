/**
 * POST /api/streams/settings/test-key
 *
 * Validates an API key by making a minimal live request to the provider.
 * Returns { valid: boolean, latencyMs: number, error?: string }.
 *
 * Provider tests:
 *   fal     — GET https://fal.run/info (lightweight endpoint check)
 *   elevenlabs — GET /v1/voices (lists voices, fails if key invalid)
 *   openai  — GET /v1/models (lists models, fails if key invalid)
 *
 * The full key is sent in the request body — never stored server-side.
 * This route only validates and discards. The caller stores the hint
 * (last 4 chars) via /api/streams/settings POST.
 *
 * Auth required — workspace users only.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

type Provider = "fal" | "elevenlabs" | "openai";

type RequestBody = {
  provider: Provider;
  key:      string;
};

async function testFal(key: string): Promise<{ valid: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("https://fal.run/fal-ai/flux/dev", {
      method: "POST",
      headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", num_images: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    // 400/422 = key valid but bad input. 401 = invalid key.
    const valid = res.status !== 401 && res.status !== 403;
    return { valid, latencyMs: Date.now() - start };
  } catch (e) {
    return { valid: false, latencyMs: Date.now() - start, error: String(e) };
  }
}

async function testElevenLabs(key: string): Promise<{ valid: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    return { valid: res.ok, latencyMs: Date.now() - start };
  } catch (e) {
    return { valid: false, latencyMs: Date.now() - start, error: String(e) };
  }
}

async function testOpenAI(key: string): Promise<{ valid: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { "Authorization": `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return { valid: res.ok, latencyMs: Date.now() - start };
  } catch (e) {
    return { valid: false, latencyMs: Date.now() - start, error: String(e) };
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as RequestBody;

  if (!["fal","elevenlabs","openai"].includes(body.provider)) {
    return NextResponse.json({ error: "provider must be fal, elevenlabs, or openai" }, { status: 400 });
  }
  if (typeof body.key !== "string" || body.key.trim().length < 8) {
    return NextResponse.json({ error: "key is required (min 8 chars)" }, { status: 400 });
  }

  // Auth — workspace user only
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = body.key.trim();
  let result: { valid: boolean; latencyMs: number; error?: string };

  switch (body.provider) {
    case "fal":        result = await testFal(key);         break;
    case "elevenlabs": result = await testElevenLabs(key);  break;
    case "openai":     result = await testOpenAI(key);      break;
  }

  return NextResponse.json({
    provider:   body.provider,
    valid:      result.valid,
    latencyMs:  result.latencyMs,
    ...(result.error ? { error: result.error } : {}),
  });
}
