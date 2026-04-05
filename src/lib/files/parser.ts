/**
 * parser.ts — File Parser Engine
 * Supports: text, code, JSON, CSV, PDF, DOCX, XLSX, PPTX, ZIP, image metadata,
 * video metadata, audio metadata.
 * All parsers return { text, metadata, pages? }.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface ParseResult {
  text: string;
  metadata: Record<string, unknown>;
  pages?: number;
  wordCount?: number;
  error?: string;
}

const execFileAsync = promisify(execFile);

const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go',
  'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'htm', 'xml', 'yaml', 'yml', 'toml',
  'sh', 'bash', 'sql', 'mjs', 'cjs', 'ini', 'env', 'log', 'r', 'swift', 'kt', 'php'
]);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'tiff', 'tif', 'svg']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'mpeg', 'mpg']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'weba']);

export function detectFileType(filename: string, mimeType?: string): string {
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (ext === 'xlsx' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (ext === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (ext === 'csv' || mimeType === 'text/csv') return 'csv';
  if (ext === 'zip' || mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return 'zip';
  if (ext === 'psd' || mimeType === 'image/vnd.adobe.photoshop' || mimeType === 'application/photoshop' || mimeType === 'application/x-photoshop') return 'psd';
  if (IMAGE_EXTS.has(ext) || mimeType?.startsWith('image/')) return 'image';
  if (VIDEO_EXTS.has(ext) || mimeType?.startsWith('video/')) return 'video';
  if (AUDIO_EXTS.has(ext) || mimeType?.startsWith('audio/')) return 'audio';
  if (ext === 'json' || mimeType === 'application/json') return 'json';
  if (TEXT_EXTS.has(ext) || mimeType?.startsWith('text/')) return 'text';
  return 'binary';
}

const ALLOWED_MIMES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml', 'text/javascript', 'text/x-typescript',
  'application/json', 'application/pdf', 'application/zip', 'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml', 'image/bmp', 'image/tiff', 'image/vnd.adobe.photoshop', 'application/photoshop', 'application/x-photoshop',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/mpeg',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4', 'audio/webm', 'audio/opus'
]);

export function validateMime(mimeType: string, filename: string): { valid: boolean; reason?: string } {
  if (!mimeType) return { valid: false, reason: 'No MIME type provided' };
  if (ALLOWED_MIMES.has(mimeType)) return { valid: true };
  if (mimeType.startsWith('text/')) return { valid: true };
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (TEXT_EXTS.has(ext) || IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext)) {
    return { valid: true };
  }
  return { valid: false, reason: `Unsupported file type: ${mimeType}` };
}

function parseText(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf-8');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { text, metadata: { encoding: 'utf-8', wordCount }, wordCount };
}

function parseJson(buffer: Buffer): ParseResult {
  try {
    const raw = buffer.toString('utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const pretty = JSON.stringify(parsed, null, 2);
    const rootType = Array.isArray(parsed) ? 'array' : typeof parsed;
    const topLevelKeys = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.keys(parsed as Record<string, unknown>).slice(0, 50)
      : [];
    return {
      text: pretty,
      metadata: {
        rootType,
        topLevelKeys,
        length: Array.isArray(parsed) ? parsed.length : undefined,
      },
      wordCount: pretty.split(/\s+/).filter(Boolean).length,
    };
  } catch (error) {
    return {
      text: buffer.toString('utf-8'),
      metadata: {},
      error: `JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function parseCsv(buffer: Buffer): ParseResult {
  const raw = buffer.toString('utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = lines[0]?.split(',').map((header) => header.trim().replace(/^"|"$/g, '')) ?? [];
  const rowCount = Math.max(0, lines.length - 1);
  const preview = lines.slice(0, 50).join('\n');
  return { text: preview, metadata: { headers, rowCount, colCount: headers.length } };
}

async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  try {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as unknown as { default?: (b: Buffer) => Promise<{ text: string; numpages: number; info: unknown }> }).default
      ?? (pdfParseModule as unknown as (b: Buffer) => Promise<{ text: string; numpages: number; info: unknown }>);
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      metadata: { pages: data.numpages, info: data.info },
      pages: data.numpages,
      wordCount: data.text.split(/\s+/).filter(Boolean).length,
    };
  } catch (error) {
    return { text: '', metadata: {}, error: `PDF parse failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    return {
      text,
      metadata: { messages: result.messages.length },
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  } catch (error) {
    return { text: '', metadata: {}, error: `DOCX parse failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function parseXlsx(buffer: Buffer): Promise<ParseResult> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let fullText = '';
    for (const sheetName of workbook.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      fullText += `\n## Sheet: ${sheetName}\n${csv}`;
    }
    return {
      text: fullText.slice(0, 100000),
      metadata: { sheetNames: workbook.SheetNames, sheetCount: workbook.SheetNames.length },
    };
  } catch (error) {
    return { text: '', metadata: {}, error: `XLSX parse failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function parsePptx(buffer: Buffer): Promise<ParseResult> {
  try {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(buffer);
    const slideEntries = zip.getEntries().filter((entry) => entry.entryName.match(/^ppt\/slides\/slide\d+\.xml$/));
    const texts: string[] = [];
    for (const entry of slideEntries) {
      const xml = entry.getData().toString('utf-8');
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) ?? [];
      const slideText = matches.map((match) => match.replace(/<[^>]+>/g, '')).join(' ');
      if (slideText.trim()) texts.push(slideText.trim());
    }
    return { text: texts.join('\n\n'), metadata: { slideCount: slideEntries.length }, pages: slideEntries.length };
  } catch (error) {
    return { text: '', metadata: {}, error: `PPTX parse failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function parseZip(buffer: Buffer): Promise<ParseResult> {
  try {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const fileList = entries.map((entry) => ({ name: entry.entryName, size: entry.header.size, isDir: entry.isDirectory }));
    const textFiles = entries.filter((entry) => !entry.isDirectory && TEXT_EXTS.has(path.extname(entry.entryName).slice(1).toLowerCase()));
    const extractedTexts: string[] = [];
    for (const entry of textFiles.slice(0, 20)) {
      try {
        extractedTexts.push(`\n## ${entry.entryName}\n${entry.getData().toString('utf-8').slice(0, 5000)}`);
      } catch {
        extractedTexts.push(`\n## ${entry.entryName}\n[Unreadable file bytes omitted]`);
      }
    }
    return { text: extractedTexts.join('\n'), metadata: { fileCount: entries.length, files: fileList.slice(0, 200) } };
  } catch (error) {
    return { text: '', metadata: {}, error: `ZIP extract failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function parseImageMeta(buffer: Buffer): Promise<ParseResult> {
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();
    const text = `Image: ${meta.width ?? 'unknown'}x${meta.height ?? 'unknown'} ${meta.format ?? 'unknown'} ${meta.space ?? ''} ${meta.hasAlpha ? 'with alpha' : ''}`.trim();
    return {
      text,
      metadata: {
        width: meta.width,
        height: meta.height,
        format: meta.format,
        space: meta.space,
        channels: meta.channels,
        hasAlpha: meta.hasAlpha,
        density: meta.density,
        size: buffer.length,
      },
    };
  } catch (error) {
    return { text: '', metadata: { size: buffer.length }, error: `Image metadata failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  codec_long_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  bit_rate?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  avg_frame_rate?: string;
}

interface FfprobeFormat {
  filename?: string;
  format_name?: string;
  format_long_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

interface FfprobeResult {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

function parseFrameRate(value?: string): number | null {
  if (!value || value === '0/0') return null;
  const [numeratorRaw, denominatorRaw] = value.split('/');
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return Number((numerator / denominator).toFixed(3));
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

async function parseMediaMeta(buffer: Buffer, filename: string, kind: 'video' | 'audio'): Promise<ParseResult> {
  const ext = path.extname(filename).slice(1).toUpperCase() || kind.toUpperCase();
  const sizeMb = Number((buffer.length / 1024 / 1024).toFixed(2));
  const tempFile = path.join(os.tmpdir(), `streams-media-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(filename) || ''}`);

  try {
    await fs.writeFile(tempFile, buffer);
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      tempFile,
    ]);
    const probe = JSON.parse(stdout) as FfprobeResult;
    const streams = probe.streams ?? [];
    const videoStream = streams.find((stream) => stream.codec_type === 'video');
    const audioStream = streams.find((stream) => stream.codec_type === 'audio');
    const durationSeconds = probe.format?.duration ? Number(probe.format.duration) : null;
    const frameRate = parseFrameRate(videoStream?.avg_frame_rate);

    const metadata: Record<string, unknown> = {
      kind,
      formatName: probe.format?.format_name,
      formatLongName: probe.format?.format_long_name,
      durationSeconds,
      durationLabel: formatDuration(durationSeconds),
      sizeBytes: probe.format?.size ? Number(probe.format.size) : buffer.length,
      sizeMb,
      bitRate: probe.format?.bit_rate ? Number(probe.format.bit_rate) : null,
      tags: probe.format?.tags ?? {},
    };

    if (videoStream) {
      metadata.videoCodec = videoStream.codec_name;
      metadata.videoCodecLongName = videoStream.codec_long_name;
      metadata.width = videoStream.width ?? null;
      metadata.height = videoStream.height ?? null;
      metadata.frameRate = frameRate;
    }

    if (audioStream) {
      metadata.audioCodec = audioStream.codec_name;
      metadata.audioCodecLongName = audioStream.codec_long_name;
      metadata.sampleRate = audioStream.sample_rate ? Number(audioStream.sample_rate) : null;
      metadata.channels = audioStream.channels ?? null;
      metadata.channelLayout = audioStream.channel_layout ?? null;
    }

    const textParts = [
      `${ext} ${kind}`,
      metadata.durationLabel ? `duration ${metadata.durationLabel}` : '',
      kind === 'video' && metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : '',
      kind === 'video' && frameRate ? `${frameRate}fps` : '',
      kind === 'audio' && metadata.sampleRate ? `${metadata.sampleRate}Hz` : '',
      kind === 'audio' && metadata.channels ? `${metadata.channels}ch` : '',
      `${sizeMb}MB`,
    ].filter(Boolean);

    return { text: textParts.join(' • '), metadata };
  } catch (error) {
    return {
      text: `${ext} ${kind} • ${sizeMb}MB`,
      metadata: { kind, format: ext, sizeBytes: buffer.length, sizeMb },
      error: `ffprobe metadata failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    await fs.rm(tempFile, { force: true }).catch(() => undefined);
  }
}

export async function parseFile(buffer: Buffer, filename: string, mimeType?: string): Promise<ParseResult> {
  const fileType = detectFileType(filename, mimeType);

  switch (fileType) {
    case 'pdf': return parsePdf(buffer);
    case 'docx': return parseDocx(buffer);
    case 'xlsx': return parseXlsx(buffer);
    case 'pptx': return parsePptx(buffer);
    case 'csv': return parseCsv(buffer);
    case 'zip': return parseZip(buffer);
    case 'image': return parseImageMeta(buffer);
    case 'psd': {
      const { inspectPsd } = await import('@/lib/bulk/psd-engine');
      const parsed = inspectPsd(buffer, filename);
      return { text: `PSD ${parsed.metadata.width}x${parsed.metadata.height} • ${parsed.metadata.channels}ch • ${parsed.metadata.depth}bit`, metadata: { ...parsed.metadata }, error: parsed.reason };
    }
    case 'video': return parseMediaMeta(buffer, filename, 'video');
    case 'audio': return parseMediaMeta(buffer, filename, 'audio');
    case 'json': return parseJson(buffer);
    case 'text': return parseText(buffer);
    default: return { text: '', metadata: { type: fileType, size: buffer.length } };
  }
}
