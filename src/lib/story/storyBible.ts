import { prepareStory } from "./storyPrep";

export interface StoryBibleInput {
  title?: string;
  storyText: string;
  aiFill?: boolean;
  sourceKind?: "self" | "family_or_friend" | "synthetic" | "mixed";
  uploadedReferences?: string[];
}

export interface StoryBible {
  title: string;
  summary: string;
  timeline: string[];
  castCards: Array<{ id: string; label: string; description: string }>;
  locationCard: string;
  eraCard: string;
  realismConstitution: string[];
  mustShow: string[];
  mustAvoid: string[];
  uncertaintyFlags: string[];
  sourceKind: StoryBibleInput["sourceKind"];
  reviewSummary: string;
  openQuestions: string[];
  fillNotes: string[];
  visualBible: {
    era: string;
    setting: string;
    wardrobe: string[];
    realismRules: string[];
  };
  identityPack: {
    continuityRequired: boolean;
    anchors: string[];
    notes: string[];
  };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildStoryBible(input: StoryBibleInput): StoryBible {
  const raw = input.storyText.replace(/\s+/g, " ").trim();
  const sentences = splitSentences(raw);
  const summary = sentences.slice(0, 3).join(" ") || raw;
  const timeline = sentences.slice(0, 6).map((sentence, index) => `Beat ${index + 1}: ${sentence}`);
  const lower = raw.toLowerCase();
  const prep = prepareStory({
    storyText: raw,
    aiFill: input.aiFill,
    uploadedReferences: input.uploadedReferences,
  });

  const eraCard = /90s|199\d|2000|child|kid|younger|school/.test(lower)
    ? "Past-life / younger-self memory recreation"
    : "Contemporary real-world recreation";
  const locationCard = /yard|backyard|park|school|house|home|living room|street/.test(lower)
    ? "Real everyday environment inferred from story text"
    : "Ordinary believable real-world setting";

  const castCards = [
    {
      id: "c1",
      label: "Primary subject",
      description: input.sourceKind === "synthetic"
        ? "Synthetic but believable person anchored to the story."
        : "Reference-backed person anchored to the story.",
    },
    {
      id: "c2",
      label: "Secondary subject",
      description: /brother|friend|mom|dad|sister/.test(lower)
        ? "Important second character with continuity lock."
        : "Optional supporting character if needed by the story.",
    },
  ];

  return {
    title: input.title?.trim() || "Story Bible",
    summary,
    timeline,
    castCards,
    locationCard,
    eraCard,
    realismConstitution: [
      "Keep all scenes ordinary, believable, and physically plausible.",
      "Protect face integrity, body completeness, and era continuity.",
      "Prefer still-image review before expensive video runs.",
      "No fake text or polished ad styling inside generated media.",
      "Do not approve image-to-video when anatomy or motion stability is weak.",
    ],
    mustShow: input.aiFill
      ? ["core event sequence", "location cues", "relationship cues", "emotion tone", "AI-filled connective details clearly marked in review"]
      : ["core event sequence", "location cues", "relationship cues", "emotion tone"],
    mustAvoid: ["blob faces", "missing limbs", "cinematic glamor", "fake logos or baked-in UI"],
    uncertaintyFlags: [
      ...(input.aiFill ? ["AI fill enabled — user review required before generation"] : []),
      ...prep.openQuestions,
    ],
    sourceKind: input.sourceKind ?? "mixed",
    reviewSummary: prep.reviewSummary,
    openQuestions: prep.openQuestions,
    fillNotes: prep.fillNotes,
    visualBible: prep.visualBible,
    identityPack: {
      continuityRequired: /brother|friend|family|younger|kid|scene|later|then/.test(lower),
      anchors: [
        "face shape",
        "eye spacing",
        "jawline",
        "hair silhouette",
        "body proportions",
        "wardrobe palette",
      ],
      notes: [
        "Reuse the same identity pack across all related scenes.",
        "Lock age cues and body proportions before image-to-video.",
      ],
    },
  };
}
