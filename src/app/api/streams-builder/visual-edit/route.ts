import { type NextRequest } from "next/server";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { planVisualEdit, type SourceFileSnapshot, type VisualSelection } from "@/lib/streams-builder/selection-to-patch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  repoFullName?: string;
  branch?: string;
  files?: SourceFileSnapshot[];
  selection?: VisualSelection;
  command?: string;
  approve?: boolean;
};

async function github(path: string, init: RequestInit = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  if (!token) throw new Error("GITHUB_TOKEN is not configured for commit/push.");
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `GitHub request failed: ${response.status}`);
  return data;
}

async function commitPatches(repoFullName: string, branch: string, patches: Array<{ file: string; after: string }>) {
  const results = [];
  for (const patch of patches) {
    const filePath = encodeURIComponent(patch.file).replace(/%2F/g, "/");
    const current = await github(`/repos/${repoFullName}/contents/${filePath}?ref=${encodeURIComponent(branch)}`);
    const content = Buffer.from(patch.after, "utf8").toString("base64");
    const updated = await github(`/repos/${repoFullName}/contents/${filePath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Apply visual edit to ${patch.file}`,
        content,
        sha: current.sha,
        branch,
      }),
    });
    results.push({ file: patch.file, commitSha: updated?.commit?.sha || "", htmlUrl: updated?.commit?.html_url || "" });
  }
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Body;
    const files = Array.isArray(body.files) ? body.files : [];
    const selection = body.selection || {};
    const command = body.command || "remove this";
    if (!files.length) return streamsAIJson({ ok: false, error: "files are required" }, 400);
    const result = planVisualEdit(files, selection, command);
    const approved = Boolean(body.approve);
    let commits: Array<Record<string, unknown>> = [];
    if (approved) {
      if (!body.repoFullName || !body.branch) return streamsAIJson({ ok: false, error: "repoFullName and branch are required to commit", result }, 400);
      if (result.error || !result.patches.length) return streamsAIJson({ ok: false, error: result.error || "No patch generated", result }, 400);
      commits = await commitPatches(body.repoFullName, body.branch, result.patches.map((patch) => ({ file: patch.file, after: patch.after })));
    }
    return streamsAIJson({ ok: true, result, commits, approved });
  } catch (error) {
    return streamsAIError(error);
  }
}
