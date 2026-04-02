import { describe, expect, it } from 'vitest';
import { detectFileType, validateMime, parseFile } from '@/lib/files/parser';

describe('file parser routing', () => {
  it('detects audio and video formats from mime and extension', () => {
    expect(detectFileType('clip.mov', 'video/quicktime')).toBe('video');
    expect(detectFileType('track.opus', 'audio/opus')).toBe('audio');
    expect(detectFileType('data.json', 'application/json')).toBe('json');
  });

  it('accepts supported media mime types', () => {
    expect(validateMime('video/x-matroska', 'demo.mkv').valid).toBe(true);
    expect(validateMime('audio/webm', 'voice.weba').valid).toBe(true);
  });

  it('parses json into pretty text and metadata', async () => {
    const result = await parseFile(Buffer.from('{"name":"streams","items":[1,2]}'), 'state.json', 'application/json');
    expect(result.text).toContain('"name": "streams"');
    expect(result.metadata.rootType).toBe('object');
  });
});
