import { randomUUID } from "node:crypto";
import type { PsdHeaderMetadata } from "./job-schema";

export interface ParsedPsdFile {
  id: string;
  filename: string;
  metadata: PsdHeaderMetadata;
  editable: false;
  reason: string;
}

function readUInt16BE(buffer: Buffer, offset: number): number {
  return buffer.readUInt16BE(offset);
}

function readUInt32BE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset);
}

export function parsePsdHeader(buffer: Buffer): PsdHeaderMetadata {
  if (buffer.length < 26) throw new Error("PSD file is too small to contain a valid header");
  const signature = buffer.subarray(0, 4).toString("ascii");
  if (signature !== "8BPS") throw new Error("Invalid PSD signature");
  const version = readUInt16BE(buffer, 4);
  if (version !== 1) throw new Error(`Unsupported PSD version: ${version}`);
  return {
    signature,
    version,
    channels: readUInt16BE(buffer, 12),
    height: readUInt32BE(buffer, 14),
    width: readUInt32BE(buffer, 18),
    depth: readUInt16BE(buffer, 22),
    colorMode: readUInt16BE(buffer, 24),
  };
}

export function inspectPsd(buffer: Buffer, filename: string): ParsedPsdFile {
  const metadata = parsePsdHeader(buffer);
  return {
    id: randomUUID(),
    filename,
    metadata,
    editable: false,
    reason: "PSD layer editing is fail-closed because this repo does not include a layer parser/editor runtime. Header inspection is real; layer editing requires a true PSD engine or Adobe runtime.",
  };
}

export function assertPsdEditingAvailable(): never {
  throw new Error("PSD editing is not enabled in this environment. A real PSD layer parser/editor runtime or Adobe Photoshop API credentials are required.");
}
