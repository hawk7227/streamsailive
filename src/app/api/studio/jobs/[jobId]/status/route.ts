import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_STUDIO_BASE_URL = "https://streamsailive-chat-streamsai.vercel.app";

function getStudioBaseUrl() {
  const configured = process.env.STREAMS_STUDIO_BASE_URL || process.env.STUDIO_GENERATION_BASE_URL || DEFAULT_STUDIO_BASE_URL;
  return configured.replace(/\/+$/, "");
}

async function readResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text ? { text } : null;
  }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ jobId?: string }> }) {
  const params = await context.params;
  const jobId = params.jobId;
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "Missing jobId" }, { status: 400 });
  }

  const upstream = await fetch(`${getStudioBaseUrl()}/api/studio/jobs/${encodeURIComponent(jobId)}/status`, {
    cache: "no-store",
  });
  const result = await readResponse(upstream);

  return NextResponse.json(
    {
      ...(result && typeof result === "object" && !Array.isArray(result) ? result : { result }),
      proxiedBy: "streams-builder-generation-lane",
    },
    { status: upstream.ok ? 200 : upstream.status },
  );
}
