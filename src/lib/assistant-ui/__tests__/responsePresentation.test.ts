import { describe, expect, it } from 'vitest';
import { presentResponse } from '../responsePresentation';

describe('responsePresentation', () => {
  it('returns light density for simple prose', () => {
    expect(presentResponse('Hello there.').density).toBe('light');
  });

  it('parses headings, bullets, and code fences into typed blocks', () => {
    const result = presentResponse('# Title\n- one\n```ts\nconst x = 1\n```');
    expect(result.blocks.some((block) => block.type === 'heading')).toBe(true);
    expect(result.blocks.some((block) => block.type === 'bullet_list')).toBe(true);
    expect(result.blocks.some((block) => block.type === 'code_block')).toBe(true);
  });
});
