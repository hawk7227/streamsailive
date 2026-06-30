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

async function github(path: string, init: RequestInit = {}, authRequired = false) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  if (authRequired && !token) throw new Error("GITHUB_TOKEN is not configured for commit/push.");
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `GitHub request failed: ${response.status}`);
  return data;
}

function decodeContent(data: any) {
  return Buffer.from(String(data?.content || ""), "base64").toString("utf8");
}

async function fetchRepoFile(repoFullName: string, branch: string, path: string): Promise<SourceFileSnapshot | null> {
  try {
    const encoded = encodeURIComponent(path).replace(/%2F/g, "/");
    const data = await github(`/repos/${repoFullName}/contents/${encoded}?ref=${encodeURIComponent(branch)}`);
    if (!data?.content) return null;
    return { path, content: decodeContent(data), repo: repoFullName, branch, sha: data.sha };
  } catch {
    return null;
  }
}

function normalizeImportPath(fromFile: string, spec: string) {
  if (!spec || spec.startsWith("http") || !/^[.@/A-Za-z0-9_-]/.test(spec)) return "";
  let base = "";
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    const parts = fromFile.split("/");
    parts.pop();
    for (const part of spec.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") parts.pop();
      else parts.push(part);
    }
    base = parts.join("/");
  } else return "";
  if (/\.(tsx|ts|jsx|js)$/.test(base)) return base;
  return `${base}.tsx`;
}

function importSpecs(content = "") {
  return [...content.matchAll(/import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter(Boolean);
}

async function expandFilesFromImports(repoFullName: string | undefined, branch: string | undefined, files: SourceFileSnapshot[]) {
  if (!repoFullName || !branch) return files;
  const byPath = new Map(files.map((file) => [file.path, file]));
  const queue = [...files];
  while (queue.length && byPath.size < 24) {
    const file = queue.shift();
    if (!file) continue;
    for (const spec of importSpecs(file.content || "")) {
      const path = normalizeImportPath(file.path, spec);
      if (!path || byPath.has(path)) continue;
      const fetched = await fetchRepoFile(repoFullName, branch, path);
      if (fetched) {
        byPath.set(path, fetched);
        queue.push(fetched);
      }
    }
  }
  return Array.from(byPath.values());
}

function assetPath(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try { return new URL(raw).pathname; } catch { return raw.replace(/^https?:\/\/[^/]+/i, ""); }
}

function quotedValue(block: string, key: string) {
  const match = block.match(new RegExp(`${key}\\s*:\\s*([\"'\`])([\\s\\S]*?)\\1`));
  return match?.[2] || "";
}

function inferSelection(files: SourceFileSnapshot[], selection: VisualSelection): VisualSelection {
  const image = assetPath(selection.imageSrc || selection.itemKey || "");
  if (!image) return selection;
  for (const file of files) {
    const content = file.content || "";
    const imageIndex = content.indexOf(image);
    if (imageIndex < 0) continue;
    const before = content.slice(0, imageIndex);
    const objectStart = before.lastIndexOf("{");
    const arrayMatch = before.match(/(?:const|let|var)\s+([A-Za-z0-9_]*CARDS[A-Za-z0-9_]*|[A-Z][A-Z0-9_]*)\s*[:\w\s<>\[\],]*=\s*\[[\s\S]*$/);
    const objectEnd = content.indexOf("}", imageIndex);
    const block = objectStart >= 0 && objectEnd > objectStart ? content.slice(objectStart, objectEnd + 1) : "";
    const href = quotedValue(block, "href");
    return {
      ...selection,
      imageSrc: image,
      itemKey: href || image,
      href: selection.href || href,
      sourceFile: selection.sourceFile || file.path,
      symbol: selection.symbol || arrayMatch?.[1] || "",
      operationTarget: selection.operationTarget || "array-item",
    };
  }
  return { ...selection, imageSrc: image };
}

async function commitPatches(repoFullName: string, branch: string, patches: Array<{ file: string; after: string }>) {
  const results = [];
  for (const patch of patches) {
    const filePath = encodeURIComponent(patch.file).replace(/%2F/g, "/");
    const current = await github(`/repos/${repoFullName}/contents/${filePath}?ref=${encodeURIComponent(branch)}`, {}, true);
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
    }, true);
    results.push({ file: patch.file, commitSha: updated?.commit?.sha || "", htmlUrl: updated?.commit?.html_url || "" });
  }
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Body;
    const suppliedFiles = Array.isArray(body.files) ? body.files : [];
    const command = body.command || "remove this";
    if (!suppliedFiles.length) return streamsAIJson({ ok: false, error: "files are required" }, 400);
    const files = await expandFilesFromImports(body.repoFullName, body.branch, suppliedFiles);
    const selection = inferSelection(files, body.selection || {});
    const result = planVisualEdit(files, selection, command);
    const approved = Boolean(body.approve);
    let commits: Array<Record<string, unknown>> = [];
    if (approved) {
      if (!body.repoFullName || !body.branch) return streamsAIJson({ ok: false, error: "repoFullName and branch are required to commit", result }, 400);
      if (result.error || !result.patches.length) return streamsAIJson({ ok: false, error: result.error || "No patch generated", result }, 400);
      commits = await commitPatches(body.repoFullName, body.branch, result.patches.map((patch) => ({ file: patch.file, after: patch.after })));
    }
    return streamsAIJson({ ok: true, result, commits, approved, selection, indexedFiles: files.map((file) => file.path) });
  } catch (error) {
    return streamsAIError(error);
  }
}
