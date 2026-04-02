import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type MediaDerivativeKind = 'poster' | 'waveform';

export interface GeneratedDerivative {
  bytes: Buffer;
  contentType: string;
  extension: string;
  cacheKey: string;
}

function sanitizeExt(fileName: string, fallback: string): string {
  const ext = path.extname(fileName).replace(/^\./, '').toLowerCase();
  return ext || fallback;
}

async function withTempFile<T>(buffer: Buffer, fileName: string, run: (inputPath: string, tempDir: string) => Promise<T>): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streams-derivative-'));
  const inputPath = path.join(tempDir, `input.${sanitizeExt(fileName, 'bin')}`);
  await fs.writeFile(inputPath, buffer);
  try {
    return await run(inputPath, tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function generatePoster(buffer: Buffer, fileName: string): Promise<GeneratedDerivative> {
  return withTempFile(buffer, fileName, async (inputPath, tempDir) => {
    const outputPath = path.join(tempDir, 'poster.jpg');
    const primaryArgs = ['-y', '-ss', '00:00:01.000', '-i', inputPath, '-frames:v', '1', '-vf', 'scale=min(1280,iw):-2', outputPath];
    const fallbackArgs = ['-y', '-i', inputPath, '-frames:v', '1', '-vf', 'scale=min(1280,iw):-2', outputPath];

    try {
      await execFileAsync('ffmpeg', primaryArgs);
    } catch {
      await execFileAsync('ffmpeg', fallbackArgs);
    }

    const bytes = await fs.readFile(outputPath);
    return {
      bytes,
      contentType: 'image/jpeg',
      extension: 'jpg',
      cacheKey: 'poster-v1',
    };
  });
}

async function generateWaveform(buffer: Buffer, fileName: string): Promise<GeneratedDerivative> {
  return withTempFile(buffer, fileName, async (inputPath, tempDir) => {
    const outputPath = path.join(tempDir, 'waveform.png');
    const args = [
      '-y',
      '-i',
      inputPath,
      '-filter_complex',
      'aformat=channel_layouts=mono,showwavespic=s=1600x360:colors=0x67e8f9',
      '-frames:v',
      '1',
      outputPath,
    ];

    await execFileAsync('ffmpeg', args);
    const bytes = await fs.readFile(outputPath);
    return {
      bytes,
      contentType: 'image/png',
      extension: 'png',
      cacheKey: 'waveform-v1',
    };
  });
}

export async function generateMediaDerivative(args: {
  buffer: Buffer;
  fileName: string;
  derivative: MediaDerivativeKind;
}): Promise<GeneratedDerivative> {
  if (args.derivative === 'poster') {
    return generatePoster(args.buffer, args.fileName);
  }
  return generateWaveform(args.buffer, args.fileName);
}
