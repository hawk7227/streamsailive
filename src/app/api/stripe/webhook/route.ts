import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * src/app/api/stripe/webhook/route.ts
 *
 * Stripe webhooks are temporarily disabled.
 */

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Stripe webhooks are temporarily disabled.",
    },
    { status: 503 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Stripe webhooks are temporarily disabled.",
    },
    { status: 503 }
  );
}
