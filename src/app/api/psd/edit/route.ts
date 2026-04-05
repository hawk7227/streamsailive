import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertPsdEditingAvailable } from "@/lib/bulk/psd-engine";
import { getAdobeEnvStatus } from "@/lib/bulk/adobe-router";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    assertPsdEditingAvailable();
    return NextResponse.json({ error: "Unexpected PSD editing state" }, { status: 500 });
  } catch (error) {
    const adobe = getAdobeEnvStatus();
    return NextResponse.json({
      error: error instanceof Error ? error.message : "PSD editing unavailable",
      adobe,
    }, { status: 501 });
  }
}
