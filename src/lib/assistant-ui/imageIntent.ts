export type ImageProviderMode = 'chat' | 'system';

const GENERATE_TERMS =
  /\b(generate|create|make|show|design|render|draw|produce|turn this into|visualize|mock up|mockup)\b/i;

const IMAGE_TERMS =
  /\b(image|photo|photograph|picture|illustration|portrait|poster|artwork|logo|visual|graphic|scene|shot|lifestyle photograph|realistic photo|product photo|ad creative|thumbnail|banner)\b/i;

const STYLE_IMAGE_TERMS =
  /\b(realistic|photorealistic|cinematic|editorial|studio|dslr|portrait|street photography|product photography|lifestyle|high quality|premium realistic)\b/i;

const NON_IMAGE_TERMS =
  /\b(video|song|music|audio|voice|soundtrack|podcast|talk verbally|speak|tts)\b/i;

export function isImageGenerationPrompt(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;

  const asksToGenerate = GENERATE_TERMS.test(normalized);
  const hasImageTarget = IMAGE_TERMS.test(normalized);
  const hasImageStyle = STYLE_IMAGE_TERMS.test(normalized);
  const isNonImage = NON_IMAGE_TERMS.test(normalized);

  if (isNonImage && !hasImageTarget) return false;

  return asksToGenerate && (hasImageTarget || hasImageStyle);
}
