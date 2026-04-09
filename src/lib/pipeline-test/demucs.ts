import { falRun } from "./falQueue";
import { AudioSeparationResult } from "./types";

type DemucsResponse = {
  vocals?: { url: string };
  drums?: { url: string };
  bass?: { url: string };
  other?: { url: string };
};

export async function separateAudioWithDemucs(audioUrl: string): Promise<AudioSeparationResult> {
  const result = await falRun<DemucsResponse>("fal-ai/demucs", {
    audio_url: audioUrl,
    stems: ["vocals", "drums", "bass", "other"],
  });

  return {
    vocalsUrl: result.vocals?.url,
    drumsUrl: result.drums?.url,
    bassUrl: result.bass?.url,
    otherUrl: result.other?.url,
  };
}
