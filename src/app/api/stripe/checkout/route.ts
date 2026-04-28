import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * src/app/api/stripe/checkout/route.ts
 *
 * Stripe checkout is temporarily disabled.
 */

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Stripe checkout is temporarily disabled.",
    },
    { status: 503 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Stripe checkout is temporarily disabled.",
    },
    { status: 503 }
  );
}
