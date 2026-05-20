export const STREAMS_PROVIDER_CAPABILITIES = Object.freeze({
  auto: ["text_to_image", "image_to_image", "text_to_video", "image_to_video", "quality_anchor_video", "voice", "music", "audio_transcription"],
  openai: ["text_to_image", "image_to_image", "image_analysis", "audio_transcription"],
  fal: ["text_to_image", "image_to_video"],
  runway: ["text_to_video", "image_to_video"],
  kling: ["text_to_video", "image_to_video"],
  veo: ["text_to_video", "image_to_video"],
  elevenlabs: ["voice", "music"],
});

export function providerSupportsMode(provider, mode) {
  return Boolean(STREAMS_PROVIDER_CAPABILITIES[provider]?.includes(mode));
}

export function getProvidersForMode(mode) {
  return Object.entries(STREAMS_PROVIDER_CAPABILITIES)
    .filter(([, modes]) => modes.includes(mode))
    .map(([provider]) => provider);
}
