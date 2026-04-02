import { describe, expect, it } from 'vitest';
import { buildStoredImageAttachment, extractLatestPreviewFromAttachments, isDirectImageRequest, toStoredPreviewAttachment } from '@/lib/assistant-media/chatImage';

describe('chatImage helpers', () => {
  it('detects direct image requests', () => {
    expect(isDirectImageRequest('Generate an image of a red car')).toBe(true);
    expect(isDirectImageRequest('Generate a video of a red car')).toBe(false);
  });

  it('builds preview blocks from stored attachments', () => {
    const blocks = toStoredPreviewAttachment({ kind: 'generated_image', url: 'https://example.com/image.png' });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('image_url');
  });

  it('extracts latest preview from attachments', () => {
    const preview = extractLatestPreviewFromAttachments([
      buildStoredImageAttachment({ artifactId: 'a1', url: 'https://example.com/image.png', prompt: 'sunset', createdAt: '2026-04-02T00:00:00.000Z' }),
    ]);
    expect(preview?.url).toBe('https://example.com/image.png');
    expect(preview?.persisted).toBe(true);
  });
});
