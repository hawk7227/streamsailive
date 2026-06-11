import { NextResponse } from "next/server";
import { applyLinePatchRequest, type LinePatchOperation } from "@/lib/streams-builder/line-patch-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GitHubFileResponse = {
  type?: string;
  path?: string;
  sha?: string;
  content?: string;
  encoding?: string;
};

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
};

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeBase64(value: string) {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

async function fetchGitHubFile(input: { repository: string; branch: string; filePath: string; token: string }) {
  const url = `https://api.github.com/repos/${input.repository}/contents/${encodeURIComponent(input.filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(input.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(input.token), cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as GitHubFileResponse | { message?: string } | null;

  if (!response.ok || !payload || Array.isArray(payload) || !("content" in payload) || !payload.content || !payload.sha) {
    const message = payload && "message" in payload ? payload.message : response.statusText;
    throw new Error(`Unable to fetch real file from GitHub: ${message}`);
  }

  return {
    sha: payload.sha,
    content: decodeBase64(payload.content),
  };
}

async function pushGitHubFile(input: { repository: string; branch: string; filePath: string; token: string; sha: string; nextContent: string; commitMessage: string }) {
  const url = `https://api.github.com/repos/${input.repository}/contents/${encodeURIComponent(input.filePath).replace(/%2F/g, "/")}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(input.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: input.commitMessage,
      content: encodeBase64(input.nextContent),
      sha: input.sha,
      branch: input.branch,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : response.statusText;
    throw new Error(`Unable to push controlled patch to GitHub: ${message}`);
  }

  return payload;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    purpose: "Apply small or large real-file line patches without asking the user to copy/paste snippets manually.",
    operations: ["add_before", "add_after", "replace_range", "delete_range", "replace_full_file"],
    rules: [
      "The system fetches the real file from GitHub before patching.",
      "The patch may replace a small range, a large range, or the full file when explicitly requested.",
      "The user and AI must see file path, line range, before/after, rebuilt full file, and audit trail.",
      "Push is blocked unless sourceTruthId and checkpointId are present.",
      "No manual user copy/paste is required for normal patches.",
    ],
  });
}

export async function POST(request: Request) {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "GITHUB_TOKEN is not configured. Real-file patching is blocked." }, { status: 500 });
  }

  let body: LinePatchApiRequest;
  try {
    body = (await request.json()) as LinePatchApiRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.repository || !body.filePath || !Array.isArray(body.operations)) {
    return NextResponse.json({ ok: false, error: "repository, filePath, and operations are required." }, { status: 400 });
  }

  const branch = body.branch?.trim() || "main";

  try {
    const realFile = await fetchGitHubFile({ repository: body.repository, branch, filePath: body.filePath, token });
    const preview = applyLinePatchRequest({
      repository: body.repository,
      branch,
      filePath: body.filePath,
      originalContent: realFile.content,
      operations: body.operations,
      sourceTruthId: body.sourceTruthId,
      checkpointId: body.checkpointId,
      allowLargeReplacement: body.allowLargeReplacement,
    });

    if (!preview.ok) {
      return NextResponse.json({ ok: false, pushed: false, preview }, { status: 409 });
    }

    if (!body.push) {
      return NextResponse.json({
        ok: true,
        pushed: false,
        mode: "preview-only",
        sha: realFile.sha,
        preview,
      });
    }

    if (!preview.canPushControlledPatch) {
      return NextResponse.json({
        ok: false,
        pushed: false,
        error: "Push blocked until sourceTruthId and checkpointId are present.",
        preview,
      }, { status: 409 });
    }

    const commitMessage = body.commitMessage?.trim() || `Apply controlled line patch to ${body.filePath}`;
    const pushResult = await pushGitHubFile({
      repository: body.repository,
      branch,
      filePath: body.filePath,
      token,
      sha: realFile.sha,
      nextContent: preview.nextContent,
      commitMessage,
    });

    return NextResponse.json({
      ok: true,
      pushed: true,
      mode: "controlled-push",
      preview,
      pushResult,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      pushed: false,
      error: error instanceof Error ? error.message : "Line patch failed.",
    }, { status: 500 });
  }
}
