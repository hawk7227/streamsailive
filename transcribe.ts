import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export async function ensureTempDir(prefix = "pipeline-test") {
  const dir = path.join(os.tmpdir(), `${prefix}-${crypto.randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function downloadFile(url: string, filePath: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status} ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
}

export function publicFileName(prefix: string, ext: string) {
  return `${prefix}-${crypto.randomUUID()}.${ext}`;
}
