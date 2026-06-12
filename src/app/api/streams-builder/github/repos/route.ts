import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
};

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

export async function GET() {
  try {
    const githubToken = token();

    if (!githubToken) {
      return NextResponse.json({
        ok: false,
        error: "Missing GITHUB_TOKEN or GH_TOKEN in .env.local",
        repos: [],
      }, { status: 400 });
    }

    const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: data?.message || "GitHub repositories request failed",
        repos: [],
      }, { status: response.status });
    }

    return NextResponse.json({
      ok: true,
      repos: (data as Repo[]).map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
        updatedAt: repo.updated_at,
      })),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown GitHub repos error",
      repos: [],
    }, { status: 500 });
  }
}
