import { type NextRequest, NextResponse } from "next/server";
import { createStreamsV1OpenApiDocument } from "@/lib/streams-api/openapi-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json(createStreamsV1OpenApiDocument(request.nextUrl.origin));
}
