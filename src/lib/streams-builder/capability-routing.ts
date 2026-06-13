import "server-only";

import { getCapabilityReadiness } from "./env-readiness";

export type GenerationMode =
  | "text-to-image"
  | "image-to-video"
  | "text-to-video"
  | "voice"
  | "builder-repair"
  | "chat";

function isUsable(id: Parameters<typeof getCapabilityReadiness>[0]) {
  return getCapabilityReadiness(id).state !== "missing";
}

export function getReadyProvidersForMode(mode: GenerationMode): string[] {
  switch (mode) {
    case "text-to-image": {
      const providers: string[] = [];
      if (isUsable("gen-text-to-image-openai")) providers.push("openai");
      if (isUsable("gen-text-to-image-fal")) providers.push("fal");
      return providers;
    }

    case "image-to-video": {
      const providers: string[] = [];
      if (isUsable("gen-image-to-video-runway")) providers.push("runway");
      if (isUsable("gen-image-to-video-kling")) providers.push("kling");
      if (isUsable("gen-image-to-video-veo")) providers.push("veo");
      return providers;
    }

    case "text-to-video": {
      const providers: string[] = [];
      if (isUsable("gen-text-to-video-runway")) providers.push("runway");
      if (isUsable("gen-text-to-video-kling")) providers.push("kling");
      if (isUsable("gen-text-to-video-veo")) providers.push("veo");
      return providers;
    }

    case "voice": {
      const providers: string[] = [];
      if (isUsable("gen-voice-elevenlabs")) providers.push("elevenlabs");
      if (isUsable("gen-voice-openai")) providers.push("openai-voice");
      return providers;
    }

    case "builder-repair": {
      const providers: string[] = [];
      if (isUsable("builder-github")) providers.push("github");
      if (isUsable("builder-vercel")) providers.push("vercel");
      if (isUsable("builder-repair-loop")) providers.push("repair-loop");
      return providers;
    }

    case "chat": {
      const providers: string[] = [];
      if (isUsable("chat-core")) providers.push("openai");
      if (isUsable("chat-uploads")) providers.push("uploads");
      return providers;
    }
  }
}
