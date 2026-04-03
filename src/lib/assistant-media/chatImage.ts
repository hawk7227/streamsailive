import type { MsgContent } from '@/components/ai-chat/AssistantMessage';
import type { MediaPreviewItem } from '@/components/pipeline/MediaPreviewPanel';

export type StoredAttachmentPayload = {
  kind?: string;
  url?: string;
  label?: string;
  artifactId?: string;
  prompt?: string;
  provider?: string;
  createdAt?: string;
  mimeType?: string;
};

export function isDirectImageRequest(message: string): boolean {
  const lower = message.trim().toLowerCase();
  if (!lower) return false;
  const hasImageVerb = /\b(generate|create|make|draw|design|render)\b/.test(lower);
  const hasImageNoun = /\b(image|photo|picture|art|poster|portrait|scene|illustration)\b/.test(lower);
  const excludes = /\b(video|song|music|audio|voice)\b/.test(lower);
  return hasImageVerb && hasImageNoun && !excludes;
}

export function toStoredPreviewAttachment(attachment: StoredAttachmentPayload): MsgContent[] {
  const blocks: MsgContent[] = [];
  if (attachment.url) {
    blocks.push({ type: 'image_url', image_url: { url: attachment.url } });
    blocks.push({ type: 'document_url', document_url: { url: attachment.url, title: 'Download image' }, text: 'Download image' });
  }
  return blocks;
}

export function extractLatestPreviewFromAttachments(messageAttachments: unknown): MediaPreviewItem | null {
  if (!Array.isArray(messageAttachments)) return null;
  const items = messageAttachments as StoredAttachmentPayload[];
  const image = [...items].reverse().find((entry) => entry.kind === 'generated_image' && typeof entry.url === 'string');
  if (!image?.url) return null;
  return {
    id: image.artifactId ?? image.url,
    type: 'image',
    url: image.url,
    label: image.prompt ?? image.label ?? 'Generated image',
    aspectRatio: '1:1',
    persisted: true,
  };
}

export function buildStoredImageAttachment(input: {
  artifactId: string;
  url: string;
  prompt: string;
  createdAt: string;
}): StoredAttachmentPayload {
  return {
    kind: 'generated_image',
    artifactId: input.artifactId,
    provider: 'chat',
    url: input.url,
    mimeType: 'image/png',
    prompt: input.prompt,
    createdAt: input.createdAt,
    label: 'Generated image',
  };
}
