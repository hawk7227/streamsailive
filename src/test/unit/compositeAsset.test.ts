/**
 * compositeAsset.test.ts
 *
 * compositeAsset.ts is currently a server-only stub returning {}.
 * spellCheckTextStrings and CompositeAssetParams do not exist yet.
 *
 * Tests for the full implementation are BLOCKED until the typography
 * module is built. Kept as a placeholder so CI remains runnable.
 */
import { describe, expect, it } from 'vitest';
import { compositeAsset } from '@/lib/pipeline/typography/compositeAsset';

describe('compositeAsset (stub)', () => {
  it('returns an object', async () => {
    const result = await compositeAsset();
    expect(typeof result).toBe('object');
  });
});
