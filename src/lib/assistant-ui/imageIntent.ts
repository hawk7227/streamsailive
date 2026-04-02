export type ImageProviderMode = 'chat' | 'system';

export function isImageGenerationPrompt(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  const asksToGenerate = /(generate|create|make|show|design|render)\b/.test(normalized);
  const imageTarget = /(image|photo|picture|illustration|portrait|poster|artwork|logo)\b/.test(normalized);
  const excludes = /(video|song|music|audio|voice)\b/.test(normalized);
  return asksToGenerate && imageTarget && !excludes;
}
