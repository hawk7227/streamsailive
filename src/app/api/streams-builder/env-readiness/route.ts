import { NextResponse } from "next/server";
import { getEnvReadinessReport } from "@/lib/streams-builder/env-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = getEnvReadinessReport();

    return NextResponse.json(
      {
        ok: true,
        report,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown env readiness error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
