import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

async function forwardJson(request: Request, pathname: string, payload: unknown) {
  const response = await fetch(internalUrl(request, pathname), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = await readResponse(response);

  return {
    ok: response.ok,
    target: pathname,
    status: response.status,
    result,
  };
}

function summarizeResearchResult(data: any) {
  if (!data) return "No research result returned.";

  const candidates = [
    data.summary,
    data.text,
    data.message,
    data.error,
    data.result?.summary,
    data.result?.text,
    data.result?.message,
    data.result?.error,
    data.result?.analysis?.summary,
    data.results?.[0]?.summary,
    data.results?.[0]?.text,
    data.results?.[0]?.title,
  ].filter(Boolean);

  if (candidates.length > 0) return String(candidates[0]).slice(0, 1200);

  try {
    return JSON.stringify(data).slice(0, 1200);
  } catch {
    return "Research returned but could not be displayed.";
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid research request body.", 400);
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!query && !url) {
    return jsonError("A query or URL is required for admingeneration research.", 400);
  }

  const attempts: any[] = [];

  if (url) {
    const intake = await forwardJson(request, "/api/admingeneration/intake", {
      kind: "auto",
      url,
      source: "admingeneration-research",
    });

    attempts.push(intake);

    if (intake.ok) {
      return NextResponse.json({
        ok: true,
        route: "admingeneration-research",
        mode: "url",
        summary: summarizeResearchResult(intake),
        attempts,
      });
    }
  }

  if (query) {
    const searchPayload = {
      query,
      q: query,
      source: "admingeneration-research",
      mode: "web-research",
    };

    const streamsSearch = await forwardJson(request, "/api/streams-ai/search", searchPayload);
    attempts.push(streamsSearch);

    if (streamsSearch.ok) {
      return NextResponse.json({
        ok: true,
        route: "admingeneration-research",
        mode: "search",
        summary: summarizeResearchResult(streamsSearch),
        attempts,
      });
    }

    const streamsSearchStatus = await forwardJson(request, "/api/streams/search", searchPayload);
    attempts.push(streamsSearchStatus);

    if (streamsSearchStatus.ok) {
      return NextResponse.json({
        ok: true,
        route: "admingeneration-research",
        mode: "search",
        summary: summarizeResearchResult(streamsSearchStatus),
        attempts,
      });
    }
  }

  return NextResponse.json(
    {
      ok: false,
      route: "admingeneration-research",
      error: "All research routes returned blocked/error states.",
      summary: attempts.map((attempt) => `${attempt.target}: ${attempt.status}`).join(" | "),
      attempts,
    },
    { status: 502 },
  );
}
