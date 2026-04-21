import type { NormalizedVoiceRequest } from "./types";
import { VoiceRuntimeError } from "./types";

const MAX_TEXT_CHARS = 5000;

export function validateVoiceRequest(req: NormalizedVoiceRequest): void {
  if (!req.text.trim()) {
    throw new VoiceRuntimeError("MISSING_TEXT", "text is required for voice generation.");
  }
  if (req.text.length > MAX_TEXT_CHARS) {
    throw new VoiceRuntimeError("TEXT_TOO_LONG", `text must be ${MAX_TEXT_CHARS} characters or fewer.`);
  }
}
