export type SongDirectorInput = {
  theme: string;
  emotion: string;
  genre: string;
  voiceType: string;
  length: string;
  lyricsMode: string;
  energy: string;
};

export type SongDirectorPlan = {
  title: string;
  summary: string;
  sections: { id: string; label: string; direction: string }[];
};

export function buildSongDirectorPlan(input: SongDirectorInput): SongDirectorPlan {
  return {
    title: input.theme || "Untitled Song",
    summary: `${input.genre} song with ${input.emotion} emotion and ${input.energy} energy`,
    sections: [
      { id: "intro", label: "Intro", direction: `Set ${input.emotion} mood` },
      { id: "hook", label: "Hook", direction: `Deliver memorable ${input.theme} hook` },
      { id: "verse", label: "Verse", direction: `Expand theme using ${input.lyricsMode}` },
    ],
  };
}
