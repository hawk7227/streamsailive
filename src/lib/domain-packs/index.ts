import type { DomainPack } from "./types";
import { defaultPack } from "./default";

export type { DomainPackOutput } from "./types";

// Domain packs are loaded by niche key. Only the telehealth domain pack is
// currently active. Additional packs (ecommerce, saas) follow the same contract.
function loadPack(niche?: string): DomainPack {
  // Telehealth governance is handled directly in pipeline-execution via
  // createStrategyFromIntake — domain pack layer normalizes for Step 4 input.
  if (niche === "telehealth" || niche === "telehealth-master" || !niche) {
    return defaultPack;
  }
  return defaultPack;
}

export function normalizeWithDomainPack(input: unknown): ReturnType<DomainPack["normalize"]> {
  const i = input as Record<string, unknown>;
  const strategy = (i.strategy ?? {}) as Record<string, unknown>;
  const niche = (strategy.niche as string) ?? undefined;
  const pack = loadPack(niche);
  return pack.normalize(input);
}
