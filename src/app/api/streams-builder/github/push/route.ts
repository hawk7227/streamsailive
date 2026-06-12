import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

function cleanPath(value: string) {
  return value.replace(/^\/+/, "").replace(/\.\./g, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const githubToken = token();

    if (!githubToken) {
      return NextResponse.json({ ok: false, error: "Missing GITHUB_TOKEN or GH_TOKEN in .env.local" }, { status: 400 });
    }

    const body = await request.json();
    const repo = String(body.repo || "");
    const path = cleanPath(String(body.path || ""));
    const branch = String(body.branch || "main");
    const sha = String(body.sha || "");
    const content = String(body.content || "");
    const agent = String(body.agent || "agent");
    const message = String(body.message || `Streams Builder ${agent}: update ${path}`);

    if (!repo || !path || !sha) {
      return NextResponse.json({ ok: false, error: "Missing repo, path, or sha" }, { status: 400 });
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(content, "utf8").toString("base64"),
          sha,
          branch,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: data?.message || "GitHub push failed" }, { status: response.status });
    }

    return NextResponse.json({
      ok: true,
      commitSha: data.commit?.sha || null,
      path,
      repo,
      branch,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown GitHub push error",
    }, { status: 500 });
  }
}
