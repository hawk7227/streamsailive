import { NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope, type StreamsAIScope } from "@/lib/streams-ai/auth";
import { applyLinePatchRequest, type LinePatchOperation } from "@/lib/streams-builder/line-patch-model";
import { StreamsBuilderPreviewBuildRepository, type DurablePreviewBuildRecord } from "@/lib/streams-builder/preview-build-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GitHubFileResponse = { type?: string; path?: string; sha?: string; content?: string; encoding?: string };
type GitHubRefResponse = { object?: { sha?: string } };
type VercelDeployment = { uid?: string; id?: string; url?: string; state?: string; readyState?: string; meta?: Record<string, string>; name?: string; createdAt?: number };
type VercelDeploymentList = { deployments?: VercelDeployment[] };

type LinePatchApiRequest = {
  repository: string;
  branch?: string;
  filePath: string;
  operations: LinePatchOperation[];
  sourceTruthId?: string | null;
  checkpointId?: string | null;
  allowLargeReplacement?: boolean;
  push?: boolean;
  commitMessage?: string;
  buildPreview?: boolean;
  route?: string;
};

const previewBuilds = new StreamsBuilderPreviewBuildRepository();

function githubHeaders(token: string) { return { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" }; }
function encodeBase64(value: string) { return Buffer.from(value, "utf8").toString("base64"); }
function decodeBase64(value: string) { return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8"); }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9._/-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "preview"; }
function vercelHeaders(token: string) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
function vercelTeamQuery() { const teamId = process.env.VERCEL_TEAM_ID?.trim(); return teamId ? `&teamId=${encodeURIComponent(teamId)}` : ""; }
function deploymentState(raw?: string) { const state = String(raw || "").toUpperCase(); if (["READY", "SUCCEEDED"].includes(state)) return "succeeded" as const; if (["ERROR", "CANCELED", "FAILED"].includes(state)) return "failed" as const; if (["BUILDING", "INITIALIZING", "QUEUED"].includes(state)) return "building" as const; return "queued" as const; }

async function fetchGitHubFile(input: { repository: string; branch: string; filePath: string; token: string }) {
  const url = `https://api.github.com/repos/${input.repository}/contents/${encodeURIComponent(input.filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(input.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(input.token), cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as GitHubFileResponse | { message?: string } | null;
  if (!response.ok || !payload || Array.isArray(payload) || !("content" in payload) || !payload.content || !payload.sha) {
    const message = payload && "message" in payload ? payload.message : response.statusText;
    throw new Error(`Unable to fetch real file from GitHub: ${message}`);
  }
  return { sha: payload.sha, content: decodeBase64(payload.content) };
}

async function fetchBranchSha(input: { repository: string; branch: string; token: string }) {
  const url = `https://api.github.com/repos/${input.repository}/git/ref/heads/${encodeURIComponent(input.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(input.token), cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as GitHubRefResponse | { message?: string } | null;
  if (!response.ok || !payload || !("object" in payload) || !payload.object?.sha) {
    const message = payload && "message" in payload ? payload.message : response.statusText;
    throw new Error(`Unable to resolve source branch for temporary preview: ${message}`);
  }
  return payload.object.sha;
}

async function createPreviewBranch(input: { repository: string; sourceBranch: string; previewBranch: string; token: string }) {
  const sha = await fetchBranchSha({ repository: input.repository, branch: input.sourceBranch, token: input.token });
  const url = "https://api.github.com/repos/" + input.repository + "/git/refs";
  const response = await fetch(url, { method: "POST", headers: { ...githubHeaders(input.token), "Content-Type": "application/json" }, body: JSON.stringify({ ref: `refs/heads/${input.previewBranch}`, sha }) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : response.statusText;
    throw new Error(`Unable to create temporary preview branch: ${message}`);
  }
}

async function pushGitHubFile(input: { repository: string; branch: string; filePath: string; token: string; sha: string; nextContent: string; commitMessage: string }) {
  const url = `https://api.github.com/repos/${input.repository}/contents/${encodeURIComponent(input.filePath).replace(/%2F/g, "/")}`;
  const response = await fetch(url, { method: "PUT", headers: { ...githubHeaders(input.token), "Content-Type": "application/json" }, body: JSON.stringify({ message: input.commitMessage, content: encodeBase64(input.nextContent), sha: input.sha, branch: input.branch }) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : response.statusText;
    throw new Error(`Unable to push controlled patch to GitHub: ${message}`);
  }
  return payload;
}

async function queryVercelDeploymentForBranch(input: { previewBranch: string; route: string }) {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim() || process.env.VERCEL_PROJECT_ID_STREAMS_BUILDER?.trim();
  if (!token || !projectId) throw new Error("VERCEL_TOKEN and VERCEL_PROJECT_ID are required for real temporary preview builds.");
  const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=20${vercelTeamQuery()}`;
  const response = await fetch(url, { headers: vercelHeaders(token), cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as VercelDeploymentList | { error?: { message?: string }; message?: string } | null;
  if (!response.ok || !payload || !("deployments" in payload)) {
    const message = payload && "error" in payload ? payload.error?.message : payload && "message" in payload ? payload.message : response.statusText;
    throw new Error(`Unable to query Vercel preview deployments: ${message}`);
  }
  const deployment = (payload.deployments || []).find((item) => item.meta?.githubCommitRef === input.previewBranch || item.meta?.githubCommitRef?.endsWith(input.previewBranch));
  if (!deployment) return null;
  const rawState = deployment.readyState || deployment.state;
  const status = deploymentState(rawState);
  const deploymentUrl = deployment.url ? `https://${deployment.url}` : "";
  const routePath = input.route.startsWith("/") ? input.route : `/${input.route}`;
  return { status, deploymentId: deployment.uid || deployment.id || "", deploymentUrl, previewUrl: deploymentUrl ? `${deploymentUrl}${routePath}` : "", rawState };
}

async function persist(scope: StreamsAIScope, record: DurablePreviewBuildRecord, eventType: string, message: string) {
  await previewBuilds.save(scope, record, eventType, message);
  return record;
}

async function createTemporaryPreviewBuild(scope: StreamsAIScope, input: { repository: string; sourceBranch: string; filePath: string; nextContent: string; fileSha: string; checkpointId: string; route: string; token: string }) {
  const previewId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const previewBranch = `streams-preview/${slug(input.filePath).replace(/\//g, "-")}-${previewId}`;
  const now = new Date().toISOString();
  const record: DurablePreviewBuildRecord = { previewId, repository: input.repository, sourceBranch: input.sourceBranch, previewBranch, route: input.route || "/", filePath: input.filePath, checkpointId: input.checkpointId, status: "queued", logs: [`${now} Creating temporary Git branch ${previewBranch}.`], createdAt: now, updatedAt: now };
  await persist(scope, record, "preview.queued", `Preview build ${previewId} queued.`);
  try {
    await createPreviewBranch({ repository: input.repository, sourceBranch: input.sourceBranch, previewBranch, token: input.token });
    record.logs.push(`${new Date().toISOString()} Pushing draft-rendered file to temporary branch.`);
    await pushGitHubFile({ repository: input.repository, branch: previewBranch, filePath: input.filePath, token: input.token, sha: input.fileSha, nextContent: input.nextContent, commitMessage: `Create temporary Streams preview for ${input.filePath}` });
    record.status = "building";
    record.logs.push(`${new Date().toISOString()} Temporary branch pushed. Waiting for Vercel Git preview deployment.`);
    await persist(scope, { ...record, updatedAt: new Date().toISOString() }, "preview.building", `Preview build ${previewId} is waiting for Vercel.`);
    const deployment = await queryVercelDeploymentForBranch({ previewBranch, route: record.route }).catch((error) => { record.logs.push(`${new Date().toISOString()} Vercel deployment not visible yet: ${error instanceof Error ? error.message : "unknown"}`); return null; });
    if (deployment) {
      record.status = deployment.status;
      record.deploymentId = deployment.deploymentId;
      record.deploymentUrl = deployment.deploymentUrl;
      record.previewUrl = deployment.previewUrl;
      record.logs.push(`${new Date().toISOString()} Vercel deployment state: ${deployment.rawState || deployment.status}.`);
    }
    record.updatedAt = new Date().toISOString();
    await persist(scope, record, record.status === "succeeded" ? "preview.passed" : record.status === "failed" ? "preview.failed" : "preview.updated", `Preview build ${previewId} is ${record.status}.`);
    return record;
  } catch (error) {
    record.status = "failed";
    record.error = error instanceof Error ? error.message : "Temporary preview build failed.";
    record.logs.push(`${new Date().toISOString()} ${record.error}`);
    record.updatedAt = new Date().toISOString();
    await persist(scope, record, "preview.failed", record.error);
    return record;
  }
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const previewId = request.nextUrl.searchParams.get("previewId") || "";
    if (previewId) {
      const stored = await previewBuilds.read(scope, previewId);
      if (!stored?.record) return NextResponse.json({ ok: false, error: "Temporary preview build id was not found." }, { status: 404 });
      const existing = stored.record;
      try {
        const deployment = await queryVercelDeploymentForBranch({ previewBranch: existing.previewBranch, route: existing.route });
        if (deployment) {
          existing.status = deployment.status;
          existing.deploymentId = deployment.deploymentId;
          existing.deploymentUrl = deployment.deploymentUrl;
          existing.previewUrl = deployment.previewUrl;
          existing.logs.push(`${new Date().toISOString()} Polled Vercel deployment state: ${deployment.rawState || deployment.status}.`);
        } else {
          existing.logs.push(`${new Date().toISOString()} Preview deployment is still not visible in Vercel.`);
        }
      } catch (error) {
        existing.logs.push(`${new Date().toISOString()} Preview poll error: ${error instanceof Error ? error.message : "unknown"}`);
      }
      existing.updatedAt = new Date().toISOString();
      await persist(scope, existing, existing.status === "succeeded" ? "preview.passed" : existing.status === "failed" ? "preview.failed" : "preview.polled", `Preview build ${previewId} polled as ${existing.status}.`);
      return NextResponse.json({ ok: true, previewBuild: existing });
    }
    return NextResponse.json({ ok: true, purpose: "Apply real-file line patches and optionally create real temporary Vercel preview branches.", operations: ["add_before", "add_after", "replace_range", "delete_range", "replace_full_file"], previewBuild: { persistence: "streams_ai_jobs", requiredEnv: ["GITHUB_TOKEN", "VERCEL_TOKEN", "VERCEL_PROJECT_ID"], optionalEnv: ["VERCEL_TEAM_ID"], statusQuery: "GET ?previewId=<id>" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Preview status failed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return NextResponse.json({ ok: false, error: "GITHUB_TOKEN is not configured. Real-file patching is blocked." }, { status: 500 });
  let body: LinePatchApiRequest;
  try { body = (await request.json()) as LinePatchApiRequest; } catch { return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); }
  if (!body.repository || !body.filePath || !Array.isArray(body.operations)) return NextResponse.json({ ok: false, error: "repository, filePath, and operations are required." }, { status: 400 });
  const branch = body.branch?.trim() || "main";
  try {
    const scope = await requireStreamsAIScope(request);
    const realFile = await fetchGitHubFile({ repository: body.repository, branch, filePath: body.filePath, token });
    const preview = applyLinePatchRequest({ repository: body.repository, branch, filePath: body.filePath, originalContent: realFile.content, operations: body.operations, sourceTruthId: body.sourceTruthId, checkpointId: body.checkpointId, allowLargeReplacement: body.allowLargeReplacement });
    if (!preview.ok) return NextResponse.json({ ok: false, pushed: false, preview }, { status: 409 });
    if (!body.push) {
      const previewBuild = body.buildPreview ? await createTemporaryPreviewBuild(scope, { repository: body.repository, sourceBranch: branch, filePath: body.filePath, nextContent: preview.nextContent, fileSha: realFile.sha, checkpointId: body.checkpointId || `checkpoint-${Date.now()}`, route: body.route || "/", token }) : null;
      return NextResponse.json({ ok: true, pushed: false, mode: body.buildPreview ? "preview-only-with-temporary-build" : "preview-only", sha: realFile.sha, preview, previewBuild });
    }
    if (!preview.canPushControlledPatch) return NextResponse.json({ ok: false, pushed: false, error: "Push blocked until sourceTruthId and checkpointId are present.", preview }, { status: 409 });
    const commitMessage = body.commitMessage?.trim() || `Apply controlled line patch to ${body.filePath}`;
    const pushResult = await pushGitHubFile({ repository: body.repository, branch, filePath: body.filePath, token, sha: realFile.sha, nextContent: preview.nextContent, commitMessage });
    return NextResponse.json({ ok: true, pushed: true, mode: "controlled-push", preview, pushResult });
  } catch (error) {
    return NextResponse.json({ ok: false, pushed: false, error: error instanceof Error ? error.message : "Line patch failed." }, { status: 500 });
  }
}
