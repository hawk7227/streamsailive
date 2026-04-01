import type { GeneratorMedium, RealismPolicy } from "../types";

export function buildRealismPolicy(medium: GeneratorMedium): RealismPolicy {
  if (medium === "image") {
    return {
      headline: "ordinary real-life photography — exact subject, no substitution",
      mustInclude: [
        "the exact subject specified in the prompt — no substitution",
        "natural or motivated household lighting",
        "lived-in environment details",
        "believable skin texture and facial asymmetry",
        "non-staged framing",
      ],
      mustAvoid: [
        "subject substitution — never swap gender, age, or person type",
        "cinematic glamour",
        "editorial polish",
        "beauty or lifestyle magazine aesthetic",
        "soft studio lighting",
        "polished stock-photo look",
        "perfect showroom backgrounds",
        "baked-in typography or logos",
      ],
      qaChecklist: ["subject match", "gender match", "device match", "face integrity", "hand realism", "natural light", "background plausibility", "no typography"],
    };
  }

  if (medium === "video") {
    return {
      headline: "physically plausible motion with identity stability",
      mustInclude: [
        "stable anatomy",
        "small grounded motion",
        "consistent lighting direction",
        "natural camera movement",
      ],
      mustAvoid: [
        "blob faces",
        "rubber limbs",
        "background wobble",
        "large reveals from weak references",
      ],
      qaChecklist: ["face drift", "limb continuity", "hand count", "background stability", "mouth stability"],
    };
  }

  if (medium === "script") {
    return {
      headline: "shot-ready, emotionally grounded script structure",
      mustInclude: [
        "clear scene beats with action and dialogue",
        "specific visual cues for each shot",
        "grounded character voice",
        "narrative arc visible within the script",
      ],
      mustAvoid: [
        "generic narration without visual anchors",
        "overlong exposition",
        "stage-direction bloat",
        "floating dialogue without scene context",
      ],
      qaChecklist: ["beat clarity", "shot cue specificity", "character voice consistency", "narrative arc", "visual grounding"],
    };
  }

  if (medium === "voice") {
    return {
      headline: "natural, performance-directed voice output",
      mustInclude: [
        "clear speaking tone and register",
        "specific pace and energy cues",
        "emotional intention per segment",
        "rights and identity metadata flags",
      ],
      mustAvoid: [
        "monotone direction",
        "conflicting speaking and singing cues",
        "unverified identity cloning without consent flag",
        "overloaded style descriptors",
      ],
      qaChecklist: ["tone match", "pace appropriateness", "identity consent flag", "provider compatibility", "audio artifact risk"],
    };
  }

  return {
    headline: "believable song writing and voice direction",
    mustInclude: [
      "clear emotional story",
      "singable lines",
      "specific vocal tone cues",
      "concise genre framing",
    ],
    mustAvoid: [
      "generic filler lyrics",
      "muddy production language",
      "conflicting vocal style requests",
      "overspecified jargon blocks",
    ],
    qaChecklist: ["hook strength", "verse clarity", "voice fit", "genre coherence"],
  };
}
