import { promises as fs } from "node:fs";
import { assertPathInsideRepo } from "./workspace-manager";
import type { BuildTask, PatchRecord } from "./types";

const forbiddenAlways = ["public/build-report.json", "scripts/validate-rule-confirmation.js"];
const blockedPrefixes = ["src/app/api/streams/video/", "src/app/api/streams/image/", "supabase/migrations/"];

function blockedReason(task: BuildTask, target: string) {
  if (forbiddenAlways.includes(target)) return `Blocked target: ${target}`;
  if (task.forbiddenFiles.includes(target)) return `Forbidden by task policy: ${target}`;
  if (blockedPrefixes.some((p) => target.startsWith(p))) return `Blocked prefix by policy: ${target}`;
  if (task.allowedFiles.length && !task.allowedFiles.some((a) => target.startsWith(a.replace("/**", "")))) return `Outside allowed slice: ${target}`;
  return null;
}

export function validatePatch(task: BuildTask, patch: PatchRecord) {
  for (const t of patch.targets) {
    try { assertPathInsideRepo(t); } catch (e: any) { return { ok: false, reason: e.message }; }
    const reason = blockedReason(task, t); if (reason) return { ok: false, reason };
  }
  return { ok: true };
}

export async function applyPatch(task: BuildTask, patch: PatchRecord & { payload?: any }) {
  const v = validatePatch(task, patch); if (!v.ok) return { applied: false, blockedReason: v.reason };
  const t = patch.targets[0]; const full = assertPathInsideRepo(t);
  const before = await fs.readFile(full, "utf8");
  if (patch.type === "replace_file") await fs.writeFile(full, String(patch.payload?.content ?? ""));
  if (patch.type === "exact_replace") await fs.writeFile(full, before.replace(String(patch.payload?.find ?? ""), String(patch.payload?.replace ?? "")));
  if (patch.type === "replace_range") {
    const lines = before.split("\n");
    lines.splice((patch.payload?.start ?? 1) - 1, (patch.payload?.end ?? 1) - (patch.payload?.start ?? 1) + 1, ...(String(patch.payload?.content ?? "").split("\n")));
    await fs.writeFile(full, lines.join("\n"));
  }
  return { applied: true };
}
