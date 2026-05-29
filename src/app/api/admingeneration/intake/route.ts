import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IntakeKind =
  | "auto"
  | "youtube"
  | "website"
  | "url"
  | "reference"
  | "upload"
  | "video-ingest"
  | "video-accessibility"
  | "analyze";

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function internalUrl(request: Request, pathname: string) {
  return new URL(pathname, new URL(request.url).origin).toString();
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text ? { text } : null;
}

function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

function routeFor(kind: IntakeKind, url: string) {
  if (kind === "youtube") return "/api/intake/youtube";
  if (kind === "website") return "/api/intake/website";
  if (kind === "reference") return "/api/streams/reference/analyze";
  if (kind === "upload") return "/api/streams/upload";
  if (kind === "video-ingest") return "/api/streams/video/ingest";
  if (kind === "video-accessibility") return "/api/streams/check-video-accessibility";
  if (kind === "analyze") return "/api/intake/analyze";

  if (kind === "auto") {
    if (url && isYouTubeUrl(url)) return "/api/intake/youtube";
    if (url) return "/api/intake/website";
  }

  return "/api/intake/url";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid admin generation intake request body.", 400);
  }

  const payload = body as Record<string, unknown>;
  const kind = String(payload.kind || "auto") as IntakeKind;
  const url =
    typeof payload.url === "string"
      ? payload.url
      : typeof payload.youtubeUrl === "string"
        ? payload.youtubeUrl
        : typeof payload.websiteUrl === "string"
          ? payload.websiteUrl
          : "";

  const target = routeFor(kind, url);

  const adminKey = process.env.ADMIN_GENERATION_KEY || "";
  const intakeKey = process.env.STREAMS_INTAKE_KEY || process.env.INTAKE_API_KEY || "";
  const cookie = request.headers.get("cookie") || "";

  const forwardHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(cookie ? { cookie } : {}),
    ...(adminKey ? { "x-admin-generation-key": adminKey } : {}),
    ...(intakeKey ? { "x-streams-intake-key": intakeKey, "x-intake-api-key": intakeKey } : {}),
  };

  const forwardBody = {
    ...payload,
    url,
    youtubeUrl: isYouTubeUrl(url) ? url : payload.youtubeUrl,
    websiteUrl: !isYouTubeUrl(url) ? url : payload.websiteUrl,
    source: "admingeneration",
    route: "admingeneration-intake",
  };

  try {
    const response = await fetch(internalUrl(request, target), {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(forwardBody),
      cache: "no-store",
    });

    const result = await readResponse(response);

    return NextResponse.json(
      {
        ok: response.ok,
        route: "admingeneration-intake",
        target,
        status: response.status,
        result,
      },
      { status: response.ok ? 200 : response.status },
    );
  } catch (error) {
    return jsonError("Admin generation intake forward failed.", 500, {
      target,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
