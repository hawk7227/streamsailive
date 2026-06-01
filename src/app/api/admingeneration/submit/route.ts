import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text ? { text } : null;
}

function internalUrl(request: Request, pathname: string) {
  return new URL(pathname, new URL(request.url).origin).toString();
}

export async function POST(request: Request) {
  const adminKey = process.env.ADMIN_GENERATION_KEY?.trim();

  if (!adminKey) {
    return jsonError(
      "ADMIN_GENERATION_KEY is not configured. Refusing to submit provider generation from frontend.",
      500,
    );
  }

  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return jsonError("Invalid admin generation submit request body.", 400);
  }

  try {
    const response = await fetch(internalUrl(request, "/api/admingeneration/jobs"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-generation-key": adminKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await readResponse(response);

    return NextResponse.json(
      {
        ok: response.ok,
        route: "admingeneration-submit",
        target: "/api/admingeneration/jobs",
        status: response.status,
        result,
      },
      { status: response.ok ? 200 : response.status },
    );
  } catch (error) {
    return jsonError("Admin generation submit failed.", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
