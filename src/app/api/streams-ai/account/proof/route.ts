import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    checks: {
      billingPortalRoute: "/api/stripe/portal",
      checkoutRoute: "/api/stripe/checkout",
      creditsRoute: "/api/streams-ai/credits",
    },
    note: "Use the account UI buttons for authenticated browser proof. This route only confirms route names.",
  });
}
