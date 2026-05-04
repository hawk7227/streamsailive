import { getKnowledgeSources } from "./knowledge-access";
import type { BuildTask, ContextPacket } from "./types";

export async function buildContextPacket(task: BuildTask): Promise<ContextPacket> {
  const docs = await getKnowledgeSources(task.activeSlice);
  return {
    activeSlice: task.activeSlice,
    mergePolicyPath: task.mergePolicy ?? "docs/merge-policies/streams-self-build-runtime-foundation-slice.md",
    allowedFiles: task.allowedFiles,
    forbiddenFiles: task.forbiddenFiles,
    affectedFiles: task.changedFiles,
    proofRequirements: ["source proof", "runtime proof", "command/check proof"],
    blockedCapabilities: ["durable persistence", "github write path", "browser proof runner"],
    guardrailRequirements: ["scope_guard", "generated_file_guard", "pr_ready"],
    sources: docs.map((path) => ({ path, kind: path.includes("merge-policies") ? "policy" as const : "doc" as const, availability: "real" as const })),
  };
}
