import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * src/app/api/stripe/portal/route.ts
 *
 * Stripe billing portal is temporarily disabled.
 */

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Stripe billing portal is temporarily disabled.",
    },
    { status: 503 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Stripe billing portal is temporarily disabled.",
    },
    { status: 503 }
  );
}
