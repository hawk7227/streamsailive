import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { RepositoryActionService, repositoryActionError } from "@/lib/streams-builder/repository-action-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repositories = new RepositoryActionService();

export async function GET(request: NextRequest) {
  try {
    await requireStreamsAIScope(request);
    const repo = request.nextUrl.searchParams.get("repo") || "";
    const branch = request.nextUrl.searchParams.get("ref") || "main";
    const path = request.nextUrl.searchParams.get("path") || "";
    const result = path
      ? await repositories.readFile({ repo, branch, path })
      : await repositories.readTree({ repo, branch });
    return NextResponse.json({ ok: true, apiVersion: "v1", result });
  } catch (error) {
    const failure = repositoryActionError(error);
    return NextResponse.json({ apiVersion: "v1", ...failure.body }, { status: failure.status });
  }
}
