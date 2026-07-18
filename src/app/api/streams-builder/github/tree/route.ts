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
    const result = await repositories.readTree({ repo, branch });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const failure = repositoryActionError(error);
    return NextResponse.json({ ...failure.body, files: [], directories: [] }, { status: failure.status });
  }
}
