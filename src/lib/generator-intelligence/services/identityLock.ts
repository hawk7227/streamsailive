export interface IdentityLockPlan {
  sourceType: "self" | "family_or_friend" | "synthetic" | "mixed" | "unknown";
  needsCharacterPack: boolean;
  fields: string[];
  rules: string[];
}

export function buildIdentityLockPlan(input: { sourceKind?: "self" | "family_or_friend" | "synthetic" | "mixed"; rawPrompt: string; storyBible?: string | null; }): IdentityLockPlan {
  const sourceType = input.sourceKind ?? "unknown";
  const text = `${input.rawPrompt} ${input.storyBible ?? ""}`.toLowerCase();
  const youngerOrRecurring = /(younger|kid|child|brother|sister|family|scene|timeline|same person|myself)/.test(text);

  return {
    sourceType,
    needsCharacterPack: youngerOrRecurring || sourceType === "self" || sourceType === "family_or_friend",
    fields: [
      "face_shape",
      "eye_spacing",
      "nose_length",
      "jawline",
      "hair_silhouette",
      "body_proportions",
      "wardrobe_palette",
      "age_markers",
    ],
    rules: [
      "Never allow the generator to reinterpret core facial proportions between scenes.",
      "Carry age cues, hairstyle, and body ratio anchors into every compiled prompt.",
      youngerOrRecurring ? "Use the same character pack ID for all related renders." : "Use a lightweight identity lock for current output only.",
    ],
  };
}
