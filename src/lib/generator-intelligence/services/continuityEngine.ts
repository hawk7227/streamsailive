export interface ContinuityPlan {
  continuityRequired: boolean;
  sceneMode: "single_scene" | "multi_scene";
  identityLockStrength: "light" | "medium" | "high";
  environmentLock: string[];
  continuityNotes: string[];
}

export function buildContinuityPlan(input: { storyBible?: string | null; rawPrompt: string; referenceSummary?: string | null; }): ContinuityPlan {
  const text = `${input.storyBible ?? ""} ${input.rawPrompt} ${input.referenceSummary ?? ""}`.toLowerCase();
  const multiScene = /(then|after|before|later|memory|scene|sequence|timeline|beat 2|beat 3|story)/.test(text);
  const younger = /(younger|kid|child|school|brother|family)/.test(text);
  const identityLockStrength: ContinuityPlan["identityLockStrength"] = younger || multiScene ? "high" : /self|me|my face/.test(text) ? "medium" : "light";

  return {
    continuityRequired: multiScene || younger,
    sceneMode: multiScene ? "multi_scene" : "single_scene",
    identityLockStrength,
    environmentLock: multiScene ? ["wardrobe continuity", "era continuity", "location continuity"] : ["lighting continuity"],
    continuityNotes: [
      multiScene ? "Reuse the same cast sheet and environment card across every scene." : "Single-scene continuity is enough.",
      younger ? "Lock age cues, facial ratios, and hair silhouette across all outputs." : "Keep facial proportions stable across reruns.",
    ],
  };
}
