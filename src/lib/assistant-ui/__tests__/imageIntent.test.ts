import { describe, expect, it } from 'vitest';
import { isImageGenerationPrompt } from '../imageIntent';

describe('imageIntent', () => {
  it('detects direct image generation intent', () => {
    expect(isImageGenerationPrompt('generate an image of a mountain lake at dawn')).toBe(true);
  });

  it('does not classify video requests as image generation', () => {
    expect(isImageGenerationPrompt('generate a video of a mountain lake at dawn')).toBe(false);
  });
});
