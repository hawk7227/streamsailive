import { describe, expect, it } from 'vitest';
import { buildFilePreviewManifest } from '@/lib/files/preview';
import type { FileClassification } from '@/lib/files/fileClassifier';

function classification(kind: FileClassification['kind']): FileClassification {
  return {
    kind,
    ingestType: kind === 'image' || kind === 'video' || kind === 'audio' ? 'asset' : 'knowledge',
    duplicateStrategy: 'copy-record',
    parserKey: kind,
  };
}

describe('buildFilePreviewManifest', () => {
  it('returns image preview metadata', () => {
    const preview = buildFilePreviewManifest({
      fileName: 'example.png',
      mimeType: 'image/png',
      sourceUrl: 'https://example.com/example.png',
      parsed: { text: 'Image: 1200x800 png', metadata: { width: 1200, height: 800 } },
      classification: classification('image'),
    });

    expect(preview.kind).toBe('image');
    expect(preview.media?.kind).toBe('image');
    expect(preview.media?.url).toContain('example.png');
    expect(preview.html).toContain('Structured media preview');
    expect(preview.representations?.some((item) => item.kind === 'download')).toBe(true);
  });

  it('returns video preview with poster derivative links when file id is present', () => {
    const preview = buildFilePreviewManifest({
      fileName: 'demo.mp4',
      mimeType: 'video/mp4',
      sourceUrl: 'https://example.com/demo.mp4',
      parsed: { text: 'MP4 video • duration 0:12 • 1920x1080 • 24fps • 12.4MB', metadata: { width: 1920, height: 1080, frameRate: 24, durationLabel: '0:12' } },
      classification: classification('video'),
      fileId: 'file-123',
    });

    expect(preview.kind).toBe('video');
    expect(preview.media?.kind).toBe('video');
    expect(preview.media?.posterUrl).toBe('/api/files/file-123/asset/poster');
    expect(preview.inlineText).toContain('1920x1080');
    expect(preview.html).toContain('frameRate');
    expect(preview.representations?.some((item) => item.kind === 'poster')).toBe(true);
  });

  it('returns audio preview with waveform derivative links when file id is present', () => {
    const preview = buildFilePreviewManifest({
      fileName: 'voice.wav',
      mimeType: 'audio/wav',
      sourceUrl: 'https://example.com/voice.wav',
      parsed: { text: 'WAV audio • duration 0:08 • 48000Hz • 2ch • 1.2MB', metadata: { sampleRate: 48000, channels: 2, durationLabel: '0:08' } },
      classification: classification('audio'),
      fileId: 'file-456',
    });

    expect(preview.kind).toBe('audio');
    expect(preview.media?.kind).toBe('audio');
    expect(preview.media?.waveformUrl).toBe('/api/files/file-456/asset/waveform');
    expect(preview.html).toContain('sampleRate');
    expect(preview.representations?.some((item) => item.kind === 'waveform')).toBe(true);
  });

  it('returns pdf preview with source document url', () => {
    const preview = buildFilePreviewManifest({
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      sourceUrl: 'https://example.com/report.pdf',
      parsed: { text: 'Quarterly report', metadata: { pages: 4 } },
      classification: classification('pdf'),
      fileId: 'file-pdf',
    });

    expect(preview.kind).toBe('pdf');
    expect(preview.media?.kind).toBe('document');
    expect(preview.html).toContain('Quarterly report');
    expect(preview.representations?.some((item) => item.kind === 'native')).toBe(true);
  });

  it('returns archive preview table data', () => {
    const preview = buildFilePreviewManifest({
      fileName: 'repo.zip',
      mimeType: 'application/zip',
      sourceUrl: 'https://example.com/repo.zip',
      parsed: { text: '## src/index.ts\nconsole.log(1)', metadata: { files: [{ name: 'src/index.ts', size: 10, isDir: false }] } },
      classification: classification('archive'),
    });

    expect(preview.kind).toBe('archive');
    expect(preview.html).toContain('src/index.ts');
  });
});
