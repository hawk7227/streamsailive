import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TreeItem = {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
};

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

function usefulFile(path: string) {
  return /\.(tsx|jsx|ts|js|css|scss|json|md|mdx|html|liquid)$/i.test(path);
}

export async function GET(request: NextRequest) {
  try {
    const githubToken = token();
    const repo = request.nextUrl.searchParams.get("repo") || "";
    const ref = request.nextUrl.searchParams.get("ref") || "main";

    if (!githubToken) {
      return NextResponse.json({
        ok: false,
        error: "Missing GITHUB_TOKEN or GH_TOKEN in .env.local",
        files: [],
        directories: [],
      }, { status: 400 });
    }

    if (!repo) {
      return NextResponse.json({
        ok: false,
        error: "Missing repo",
        files: [],
        directories: [],
      }, { status: 400 });
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: data?.message || "GitHub tree request failed",
        files: [],
        directories: [],
      }, { status: response.status });
    }

    const files = ((data.tree || []) as TreeItem[])
      .filter((item) => item.type === "blob")
      .filter((item) => usefulFile(item.path))
      .map((item) => ({
        path: item.path,
        sha: item.sha,
        size: item.size || 0,
        name: item.path.split("/").pop() || item.path,
        directory: item.path.includes("/") ? item.path.split("/").slice(0, -1).join("/") : "",
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    const directories = Array.from(new Set(files.map((file) => file.directory).filter(Boolean))).sort();

    return NextResponse.json({
      ok: true,
      repo,
      ref,
      files,
      directories,
      truncated: Boolean(data.truncated),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown GitHub tree error",
      files: [],
      directories: [],
    }, { status: 500 });
  }
}
