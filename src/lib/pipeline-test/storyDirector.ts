export type StoryDirectorInput = {
  idea: string;
  subject: string;
  tone: string;
  structure: string;
  length: string;
  voiceStyle: string;
  visualStrategy: string;
};

export type StoryDirectorPlan = {
  title: string;
  summary: string;
  scenes: { id: string; title: string; beat: string }[];
};

export function buildStoryDirectorPlan(input: StoryDirectorInput): StoryDirectorPlan {
  return {
    title: input.idea || "Untitled Story",
    summary: `${input.tone} ${input.structure} story about ${input.subject}`,
    scenes: [
      { id: "scene-1", title: "Hook", beat: `Open with ${input.idea}` },
      { id: "scene-2", title: "Middle", beat: `Develop ${input.subject} with ${input.tone} tone` },
      { id: "scene-3", title: "Resolution", beat: `Resolve using ${input.visualStrategy}` },
    ],
  };
}
