import { randomUUID } from "node:crypto";
import type { BulkTask } from "./job-schema";
import { createManifest } from "./manifest-builder";
import { parseBulkPrompt } from "./prompt-parser";
import { buildCreativePlan, buildCreativePrompt } from "./creative-engine";

export function buildBulkPayload(prompt: string) {
  const parsed = parseBulkPrompt(prompt);
  const tasks: BulkTask[] = [];

  const combinations = parsed.kinds.flatMap((kind) => parsed.aspects.map((aspectRatio) => ({ kind, aspectRatio })));
  const count = Math.max(parsed.requestedCount, combinations.length);

  for (let i = 0; i < count; i += 1) {
    const combo = combinations[i % combinations.length];
    const plan = buildCreativePlan(combo.kind, combo.aspectRatio, i);
    tasks.push({
      id: randomUUID(),
      kind: combo.kind,
      provider: "fal",
      size: parsed.requestedSize,
      aspectRatio: combo.aspectRatio,
      basePrompt: parsed.basePrompt,
      finalPrompt: buildCreativePrompt(parsed.basePrompt, plan),
      plan,
    });
  }

  const manifest = createManifest(parsed.basePrompt, parsed.sourceType, tasks.length);

  return {
    prompt: parsed.basePrompt,
    sourceType: parsed.sourceType,
    tasks,
    manifest,
    options: {
      requestedCount: parsed.requestedCount,
      requestedSize: parsed.requestedSize,
      selectedKinds: parsed.kinds,
      selectedAspects: parsed.aspects,
    },
  };
}
