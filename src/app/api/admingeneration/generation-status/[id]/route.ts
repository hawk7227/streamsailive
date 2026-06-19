import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const supabase = admin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase admin not configured" }, { status: 500 });
  }

  const generation = await supabase
    .from("generations")
    .select("id,status,output_url,provider,model,type,prompt,metadata,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (generation.error) {
    return NextResponse.json({ ok: false, error: generation.error.message }, { status: 500 });
  }
  if (!generation.data) {
    return NextResponse.json({ ok: false, error: "Generation not found" }, { status: 404 });
  }

  const jobs = await supabase
    .from("video_jobs")
    .select("id,status,phase,provider,model,provider_job_id,output_url,error,clip_index,parent_job_id,updated_at")
    .eq("generation_id", id)
    .order("clip_index", { ascending: true });

  const artifacts = await supabase
    .from("artifacts")
    .select("id,type,media_type,storage_url,thumbnail_url,mime_type,width,height,metadata,created_at")
    .eq("generation_id", id)
    .order("created_at", { ascending: false });

  const outputUrl =
    generation.data.output_url ||
    artifacts.data?.find((item) => item.storage_url)?.storage_url ||
    jobs.data?.find((item) => item.output_url)?.output_url ||
    null;

  return NextResponse.json({
    ok: true,
    generation: generation.data,
    status: generation.data.status,
    outputUrl,
    videoUrl: outputUrl,
    jobs: jobs.data || [],
    artifacts: artifacts.data || [],
    pending: !outputUrl && !["failed", "error", "cancelled"].includes(String(generation.data.status || "").toLowerCase()),
  });
}
