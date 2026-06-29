export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const previewId = url.searchParams.get("previewId") || "";
  if (!previewId) return Response.json({ ok: true, purpose: "Temporary preview build status API", required: ["previewId"] });
  const target = `${url.origin}/api/streams-builder/line-patches?previewId=${encodeURIComponent(previewId)}`;
  const response = await fetch(target, { cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  return Response.json(json, { status: response.status });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${url.origin}/api/streams-builder/line-patches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...body, push: false, buildPreview: true }),
  });
  const json = await response.json().catch(() => ({}));
  return Response.json(json, { status: response.status });
}
