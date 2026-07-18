import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { RepositoryActionService, repositoryActionError } from "@/lib/streams-builder/repository-action-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repositories = new RepositoryActionService();

export async function POST(request: NextRequest) {
  try {
    await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "read") {
      const result = await repositories.readFile({
        repo: String(body.repo || ""),
        branch: String(body.branch || "main"),
        path: String(body.path || ""),
      });
      return NextResponse.json({ ok: true, apiVersion: "v1", action, result });
    }
    if (action === "push") {
      const result = await repositories.pushFile({
        repo: String(body.repo || ""),
        branch: String(body.branch || "main"),
        path: String(body.path || ""),
        sha: String(body.sha || ""),
        content: String(body.content || ""),
        message: String(body.message || `Streams Builder: update ${String(body.path || "file")}`),
        allowProtectedBranch: body.allowProtectedBranch === true,
      });
      return NextResponse.json({ ok: true, apiVersion: "v1", action, result });
    }
    return NextResponse.json({ ok: false, apiVersion: "v1", error: "Unsupported repository action.", code: "REPOSITORY_ACTION_UNSUPPORTED" }, { status: 400 });
  } catch (error) {
    const failure = repositoryActionError(error);
    return NextResponse.json({ apiVersion: "v1", ...failure.body }, { status: failure.status });
  }
}
