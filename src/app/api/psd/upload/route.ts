import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inspectPsd } from "@/lib/bulk/psd-engine";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "PSD file is required" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const parsed = inspectPsd(buffer, file.name);
    return NextResponse.json({ data: parsed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PSD inspection failed" }, { status: 400 });
  }
}
