import { promises as fs } from "node:fs";

export async function getKnowledgeSources(activeSlice: string) {
  const docs = ["docs/streams-current-status.md", "docs/merge-policies/README.md"];
  if (/lint/i.test(activeSlice)) docs.push("docs/streams-knowledge/lint-baseline-remediation.md");
  const available: string[] = [];
  for (const path of docs) {
    try { await fs.access(path); available.push(path); } catch {}
  }
  return available;
}
