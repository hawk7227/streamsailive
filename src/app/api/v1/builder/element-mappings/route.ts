import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { RepositoryActionService, repositoryActionError } from "@/lib/streams-builder/repository-action-service";
import { resolveMappedComponentNode } from "@/lib/streams-builder/ast-element-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repositories = new RepositoryActionService();

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const repo = String(body.repo || "");
    const branch = String(body.branch || "main");
    const sourceFile = String(body.sourceFile || body.filePath || "");
    const source = await repositories.readFile({ repo, branch, path: sourceFile });
    const mapping = resolveMappedComponentNode({
      projectId: String(body.projectId || scope.defaultProjectId || ""),
      route: String(body.route || source.frontendRoute || "/"),
      sourceFile,
      sourceContent: source.content,
      selector: String(body.selector || ""),
      kind: String(body.kind || ""),
      original: String(body.original || ""),
      text: String(body.text || ""),
      src: String(body.src || ""),
      parentLayerId: String(body.parentLayerId || ""),
      childLayerIds: Array.isArray(body.childLayerIds) ? body.childLayerIds.map(String) : [],
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", mapping });
  } catch (error) {
    const result = repositoryActionError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
