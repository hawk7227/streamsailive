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

function inferKind(url: string): IntakeKind {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/^https?:\/\//i.test(url)) return "website";
  return "url";
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text ? { text } : null;
}

async function forwardJson(request: Request, pathname: string, payload: unknown) {
  const response = await fetch(internalUrl(request, pathname), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = await readResponse(response);

  return NextResponse.json(
    {
      ok: response.ok,
      route: "admingeneration-intake",
      target: pathname,
      status: response.status,
      result,
    },
    { status: response.ok ? 200 : response.status },
  );
}

async function forwardMultipart(request: Request, pathname: string, formData: FormData) {
  const response = await fetch(internalUrl(request, pathname), {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const result = await readResponse(response);

  return NextResponse.json(
    {
      ok: response.ok,
      route: "admingeneration-intake",
      target: pathname,
      status: response.status,
      result,
    },
    { status: response.ok ? 200 : response.status },
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const kind = String(formData.get("kind") || "upload") as IntakeKind;

      if (kind === "video-ingest") {
        return forwardMultipart(request, "/api/streams/video/ingest", formData);
      }

      return forwardMultipart(request, "/api/streams/upload", formData);
    }

    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return jsonError("Invalid intake request body.", 400);
    }

    const body = payload as Record<string, unknown>;
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const requestedKind = String(body.kind || "auto") as IntakeKind;
    const kind = requestedKind === "auto" && url ? inferKind(url) : requestedKind;

    if ((kind === "youtube" || kind === "website" || kind === "url") && !url) {
      return jsonError("A URL is required for URL, website, or YouTube intake.", 400);
    }

    if (kind === "youtube") {
      return forwardJson(request, "/api/intake/youtube", { ...body, url });
    }

    if (kind === "website") {
      return forwardJson(request, "/api/intake/website", { ...body, url });
    }

    if (kind === "url") {
      return forwardJson(request, "/api/intake/url", { ...body, url });
    }

    if (kind === "reference") {
      return forwardJson(request, "/api/streams/reference/analyze", body);
    }

    if (kind === "video-ingest") {
      return forwardJson(request, "/api/streams/video/ingest", body);
    }

    if (kind === "video-accessibility") {
      return forwardJson(request, "/api/streams/check-video-accessibility", body);
    }

    if (kind === "analyze") {
      return forwardJson(request, "/api/intake/analyze", body);
    }

    return jsonError(`Unsupported admingeneration intake kind: ${kind}`, 400);
  } catch (error) {
    return jsonError("Admin generation intake failed.", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
