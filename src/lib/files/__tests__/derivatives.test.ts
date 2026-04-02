import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { generateMediaDerivative } from '@/lib/files/derivatives';

const execFileAsync = promisify(execFile);

async function createTempMedia(args: string[], fileName: string): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streams-media-test-'));
  const outputPath = path.join(tempDir, fileName);
  try {
    await execFileAsync('ffmpeg', ['-y', ...args, outputPath]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('generateMediaDerivative', () => {
  it('creates a poster image from a video buffer', async () => {
    const buffer = await createTempMedia([
      '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=2',
      '-vf', 'format=yuv420p',
    ], 'sample.mp4');

    const derivative = await generateMediaDerivative({
      buffer,
      fileName: 'sample.mp4',
      derivative: 'poster',
    });

    expect(derivative.contentType).toBe('image/jpeg');
    expect(derivative.bytes.length).toBeGreaterThan(0);
  });

  it('creates a waveform image from an audio buffer', async () => {
    const buffer = await createTempMedia([
      '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2',
    ], 'sample.wav');

    const derivative = await generateMediaDerivative({
      buffer,
      fileName: 'sample.wav',
      derivative: 'waveform',
    });

    expect(derivative.contentType).toBe('image/png');
    expect(derivative.bytes.length).toBeGreaterThan(0);
  });
});
