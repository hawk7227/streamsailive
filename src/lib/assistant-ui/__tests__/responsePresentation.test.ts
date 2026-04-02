import { describe, expect, it } from 'vitest';
import { createPresentationPlan, splitRenderBlocks } from '../responsePresentation';

describe('responsePresentation', () => {
  it('keeps simple prose in light density', () => {
    expect(createPresentationPlan('Hello there.').density).toBe('light');
  });

  it('parses headings, bullets, and code fences', () => {
    const blocks = splitRenderBlocks('# Title\n- one\n```ts\nconst x = 1\n```', 'build');
    expect(blocks.some((block) => block.kind === 'heading')).toBe(true);
    expect(blocks.some((block) => block.kind === 'bullet')).toBe(true);
    expect(blocks.some((block) => block.kind === 'code')).toBe(true);
  });
});
