import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { GitHubPullRequestService, pullRequestError } from "@/lib/streams-builder/github-pull-request-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pullRequests = new GitHubPullRequestService();

export async function GET(request: NextRequest) {
  try {
    await requireStreamsAIScope(request);
    const repo = request.nextUrl.searchParams.get("repo") || "";
    const number = Number(request.nextUrl.searchParams.get("number") || 0);
    const pullRequest = await pullRequests.read(repo, number);
    return NextResponse.json({ ok: true, apiVersion: "v1", pullRequest });
  } catch (error) {
    const failure = pullRequestError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({}));
    const result = await pullRequests.create({
      repo: String(body.repo || ""),
      baseBranch: String(body.baseBranch || "main"),
      headBranch: String(body.headBranch || ""),
      title: String(body.title || "Streams Builder reviewed change").slice(0, 240),
      previewUrl: String(body.previewUrl || ""),
      checkpointId: String(body.checkpointId || ""),
      filePath: String(body.filePath || ""),
      proofStatus: String(body.proofStatus || "pending"),
      verificationStatus: String(body.verificationStatus || "pending"),
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", ...result });
  } catch (error) {
    const failure = pullRequestError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
