import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

function cleanPath(value: string) {
  return value.replace(/^\/+/, "").replace(/\.\./g, "").trim();
}

function inferRoute(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");

  if (/src\/app\/.+\/page\.(tsx|jsx|ts|js)$/i.test(normalized)) {
    return normalized
      .replace(/^src\/app/i, "")
      .replace(/\/page\.(tsx|jsx|ts|js)$/i, "") || "/";
  }

  if (normalized.includes("streams-builder")) return "/streams-builder";
  if (normalized.toLowerCase().includes("pricing")) return "/pricing";
  if (normalized.toLowerCase().includes("dashboard")) return "/dashboard";
  if (normalized.toLowerCase().includes("admingeneration")) return "/admingeneration";
  if (normalized.toLowerCase().includes("visual-editor")) return "/visual-editor";

  return "/";
}

export async function GET(request: NextRequest) {
  try {
    const githubToken = token();
    const repo = request.nextUrl.searchParams.get("repo") || "";
    const filePath = cleanPath(request.nextUrl.searchParams.get("path") || "");
    const ref = request.nextUrl.searchParams.get("ref") || "main";

    if (!githubToken) {
      return NextResponse.json({ ok: false, error: "Missing GITHUB_TOKEN or GH_TOKEN in .env.local" }, { status: 400 });
    }

    if (!repo || !filePath) {
      return NextResponse.json({ ok: false, error: "Missing repo or path" }, { status: 400 });
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath).replaceAll("%2F", "/")}?ref=${encodeURIComponent(ref)}`,
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
      return NextResponse.json({ ok: false, error: data?.message || "GitHub file request failed" }, { status: response.status });
    }

    if (data.type !== "file" || !data.content) {
      return NextResponse.json({ ok: false, error: "Selected path is not a file" }, { status: 400 });
    }

    const content = Buffer.from(String(data.content).replace(/\n/g, ""), "base64").toString("utf8");
    const route = inferRoute(filePath);
    const component = filePath.split("/").pop()?.replace(/\.(tsx|jsx|ts|js)$/i, "") || "Unknown";

    return NextResponse.json({
      ok: true,
      repo,
      path: filePath,
      ref,
      sha: data.sha,
      size: data.size,
      content,
      frontendRoute: route,
      sourceTruth: {
        route,
        component,
        file: filePath,
        githubPath: filePath,
        branch: ref,
        writeTarget: `${ref}/${filePath}`,
        mode: ref === "main" ? "Main File Only" : "Branch Selected",
        branchWrites: "Station isolated",
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown GitHub file error",
    }, { status: 500 });
  }
}
