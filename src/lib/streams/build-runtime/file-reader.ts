import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertPathInsideRepo, getRepoRoot } from "./workspace-manager";

export async function readFile(relativePath: string) {
  const full = assertPathInsideRepo(relativePath);
  const content = await fs.readFile(full, "utf8");
  return { path: relativePath, content, lines: content.split("\n").length, sha256: createHash("sha256").update(content).digest("hex") };
}
export async function listFiles(prefix = "src") {
  const base = assertPathInsideRepo(prefix);
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full); else out.push(path.relative(getRepoRoot(), full));
    }
  }
  await walk(base); return out;
}
export async function searchFiles(query: string, prefix = "src") {
  const files = await listFiles(prefix);
  const lower = query.toLowerCase();
  return files.filter((f) => f.toLowerCase().includes(lower));
}
