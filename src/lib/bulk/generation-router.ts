import { randomUUID } from "node:crypto";
import type { BulkProvider, BulkTask } from "./job-schema";
import { createManifest } from "./manifest-builder";
import { parseBulkPrompt } from "./prompt-parser";
import { buildCreativePlan, buildCreativePrompt } from "./creative-engine";

function resolveBulkProvider(): BulkProvider {
  if (process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_IMAGES) return "openai";
  if (process.env.FAL_API_KEY) return "fal";
  return "openai";
}

export function buildBulkPayload(prompt: string) {
  const parsed = parseBulkPrompt(prompt);
  const tasks: BulkTask[] = [];
  const provider = resolveBulkProvider();

  const combinations = parsed.kinds.flatMap((kind) => parsed.aspects.map((aspectRatio) => ({ kind, aspectRatio })));
  const count = Math.max(parsed.requestedCount, combinations.length);

  for (let i = 0; i < count; i += 1) {
    const combo = combinations[i % combinations.length];
    const plan = buildCreativePlan(combo.kind, combo.aspectRatio, i);
    tasks.push({
      id: randomUUID(),
      kind: combo.kind,
      provider,
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
