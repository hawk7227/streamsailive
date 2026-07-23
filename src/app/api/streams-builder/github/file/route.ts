import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsBuilderRepositoryAccess } from "@/lib/streams-builder/repository-route-auth";
import { RepositoryActionService, repositoryActionError } from "@/lib/streams-builder/repository-action-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repositories = new RepositoryActionService();

export async function GET(request: NextRequest) {
  try {
    await requireStreamsBuilderRepositoryAccess(request);
    const repo = request.nextUrl.searchParams.get("repo") || "";
    const path = request.nextUrl.searchParams.get("path") || "";
    const branch = request.nextUrl.searchParams.get("ref") || "main";
    const result = await repositories.readFile({ repo, branch, path });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const failure = repositoryActionError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
