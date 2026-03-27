import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; value?: number; rating?: string };
    if (!body.name || body.value === undefined) return NextResponse.json({ ok: false });

    const admin = createAdminClient();
    await admin.from("ledger_logs").insert({
      action:    "pipeline_started", // reuse closest action type
      entity_type: "web_vital",
      entity_id:  body.name,
      payload:   { name: body.name, value: body.value, rating: body.rating },
      severity:  body.rating === "poor" ? "warn" : "debug",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
