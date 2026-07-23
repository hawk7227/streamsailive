import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsBuilderRepositoryAccess } from "@/lib/streams-builder/repository-route-auth";
import { RepositoryActionService, repositoryActionError } from "@/lib/streams-builder/repository-action-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repositories = new RepositoryActionService();

export async function GET(request: NextRequest) {
  try {
    await requireStreamsBuilderRepositoryAccess(request);
    const repos = await repositories.listRepositories();
    return NextResponse.json({ ok: true, repos });
  } catch (error) {
    const failure = repositoryActionError(error);
    return NextResponse.json({ ...failure.body, repos: [] }, { status: failure.status });
  }
}
