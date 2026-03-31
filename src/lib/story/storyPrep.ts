export interface StoryPrepInput {
  storyText: string;
  aiFill?: boolean;
  uploadedReferences?: string[];
}

export interface StoryPrepResult {
  normalizedStory: string;
  eventBeats: string[];
  openQuestions: string[];
  fillNotes: string[];
  visualBible: {
    era: string;
    setting: string;
    wardrobe: string[];
    realismRules: string[];
  };
  reviewSummary: string;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function prepareStory(input: StoryPrepInput): StoryPrepResult {
  const cleaned = input.storyText.replace(/\s+/g, " ").trim();
  const sentences = splitSentences(cleaned);
  const lower = cleaned.toLowerCase();
  const eventBeats = sentences.slice(0, 8);
  const openQuestions: string[] = [];

  if (!/backyard|park|house|home|school|street|room|store/.test(lower)) {
    openQuestions.push("Exact environment is not fully defined — keep setting ordinary and believable.");
  }
  if (!/90s|2000|2010|child|kid|younger|adult|teen/.test(lower)) {
    openQuestions.push("Age or era is not fully locked — use neutral era cues until clarified.");
  }
  if (!/brother|sister|friend|mom|dad|we|i /.test(lower)) {
    openQuestions.push("Character relationships are lightly defined — keep cast compact.");
  }

  const era = /90s|199\d/.test(lower)
    ? "1990s"
    : /2000|200\d/.test(lower)
      ? "2000s"
      : /child|kid|younger|school/.test(lower)
        ? "Past memory / younger-self"
        : "Contemporary";

  const setting = /backyard|yard/.test(lower)
    ? "Backyard / outdoor home space"
    : /school/.test(lower)
      ? "Everyday school environment"
      : /house|home|living room|room/.test(lower)
        ? "Ordinary lived-in home environment"
        : "Believable real-world setting";

  const fillNotes = input.aiFill
    ? [
        "AI fill can add connective scene details, but every generated detail should remain reviewable.",
        "AI fill should never invent polished, cinematic, or over-dramatic details.",
      ]
    : [];

  return {
    normalizedStory: sentences.join(" "),
    eventBeats,
    openQuestions,
    fillNotes,
    visualBible: {
      era,
      setting,
      wardrobe: ["ordinary clothing", "era-consistent colors", "non-styled everyday wear"],
      realismRules: [
        "No cinematic glamor.",
        "Keep people ordinary and believable.",
        "Use lived-in environments and practical lighting.",
      ],
    },
    reviewSummary: `Locked ${eventBeats.length} story beats for ${setting} with ${era} cues. ${input.aiFill ? "AI fill is enabled and must stay reviewable." : "AI fill is disabled."}`,
  };
}
