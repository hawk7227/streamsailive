/**
 * POST /api/admin/notify
 *
 * Sends SMS to the admin phone via Twilio.
 * Called by server-side events: generation complete, error, manual review needed, etc.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — from twilio.com/console
 *   TWILIO_AUTH_TOKEN    — from twilio.com/console
 *   TWILIO_FROM_NUMBER   — your Twilio phone number e.g. +15551234567
 *   ADMIN_PHONE_NUMBER   — your phone number e.g. +15559876543
 *
 * Body: { event, message, detail? }
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

const EVENTS = {
  generation_complete:  "✅ Generation complete",
  generation_failed:    "❌ Generation failed",
  manual_review:        "👁 Manual review needed",
  system_error:         "🚨 System error",
  connector_connected:  "🔗 Connector connected",
  connector_failed:     "💔 Connector failed",
  rate_limit:           "⚠️ Rate limit hit",
  cost_alert:           "💸 Cost alert",
  user_action_needed:   "🔔 Action needed",
  build_complete:       "🏗 Build complete",
  build_failed:         "🏗 Build failed",
  continue_requested:   "▶️ Continue requested",
} as const;

type EventKey = keyof typeof EVENTS;

async function sendSMS(to: string, from: string, body: string, accountSid: string, authToken: string): Promise<{ ok: boolean; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as { message?: string };
    return { ok: false, error: err.message ?? `Twilio HTTP ${res.status}` };
  }
  return { ok: true };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const accountSid  = process.env.TWILIO_ACCOUNT_SID;
  const authToken   = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber  = process.env.TWILIO_FROM_NUMBER;
  const adminPhone  = process.env.ADMIN_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber || !adminPhone) {
    const missing = [
      !accountSid  && "TWILIO_ACCOUNT_SID",
      !authToken   && "TWILIO_AUTH_TOKEN",
      !fromNumber  && "TWILIO_FROM_NUMBER",
      !adminPhone  && "ADMIN_PHONE_NUMBER",
    ].filter(Boolean).join(", ");
    return NextResponse.json({ error: `Missing env vars: ${missing}` }, { status: 503 });
  }

  let body: { event?: string; message?: string; detail?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { event, message, detail } = body;
  if (!event) return NextResponse.json({ error: "event is required" }, { status: 400 });

  const emoji = EVENTS[event as EventKey] ?? `📣 ${event}`;
  const lines = [
    `Streams AI — ${emoji}`,
    message ?? event,
    detail ? `Detail: ${detail.slice(0, 100)}` : null,
    `Time: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
  ].filter(Boolean).join("\n");

  const result = await sendSMS(adminPhone, fromNumber, lines, accountSid, authToken);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ sent: true, to: adminPhone.slice(-4).padStart(adminPhone.length, "*") });
}

// ── Convenience helper — call from any server route ───────────────────────
export async function notifyAdmin(event: EventKey, message: string, detail?: string): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co","vercel.app") ?? "";
    if (!baseUrl) return;
    await fetch(`${baseUrl}/api/admin/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, message, detail }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* non-fatal — notifications never block the main flow */ }
}
