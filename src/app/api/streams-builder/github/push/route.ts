import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsBuilderRepositoryAccess } from "@/lib/streams-builder/repository-route-auth";
import { RepositoryActionService, repositoryActionError } from "@/lib/streams-builder/repository-action-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repositories = new RepositoryActionService();

export async function POST(request: NextRequest) {
  try {
    await requireStreamsBuilderRepositoryAccess(request);
    const body = await request.json().catch(() => ({}));
    const repo = String(body.repo || "");
    const path = String(body.path || "");
    const branch = String(body.branch || "main");
    const sha = String(body.sha || "");
    const content = String(body.content || "");
    const agent = String(body.agent || "agent");
    const message = String(body.message || `Streams Builder ${agent}: update ${path}`);
    const result = await repositories.pushFile({
      repo,
      branch,
      path,
      sha,
      content,
      message,
      allowProtectedBranch: body.allowProtectedBranch === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const failure = repositoryActionError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
