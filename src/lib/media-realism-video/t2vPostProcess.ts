/**
 * t2vPostProcess.ts
 *
 * Per spec: re-encode via ffmpeg, inject noise, normalize compression.
 * ffmpeg is environment-dependent — wired correctly so real execution
 * can be plugged in. Returns skip with reason when ffmpeg unavailable.
 */

import type { PostProcessResult } from "./types";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-encode video to reduce AI-generation compression artifacts,
 * inject subtle film grain noise, and normalize output compression.
 * Per spec: makes output feel less like "AI video".
 */
export async function postProcessT2V(
  inputUrl: string,
  workspaceId: string,
): Promise<PostProcessResult> {
  const processesApplied: string[] = [];

  // Check if ffmpeg is available
  if (!(await ffmpegAvailable())) {
    return {
      inputUrl,
      outputUrl: inputUrl,   // pass through unchanged
      processesApplied: [],
      skipped: true,
      skipReason: "ffmpeg not available in this environment",
    };
  }

  try {
    const tmpDir = os.tmpdir();
    const inputFile = path.join(tmpDir, `t2v_in_${Date.now()}.mp4`);
    const outputFile = path.join(tmpDir, `t2v_out_${workspaceId}_${Date.now()}.mp4`);

    // Download input video to tmp
    const res = await fetch(inputUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    require("fs").writeFileSync(inputFile, buf);

    // ffmpeg: re-encode H.264, inject grain noise, normalize
    // -vf "noise=alls=3:allf=t+u" — subtle grain (alls=3 is very light)
    // -crf 23 — quality-based compression normalization
    // -preset medium — balanced encode speed
    await execFileAsync("ffmpeg", [
      "-i", inputFile,
      "-vf", "noise=alls=3:allf=t+u",
      "-c:v", "libx264",
      "-crf", "23",
      "-preset", "medium",
      "-c:a", "copy",
      "-y",
      outputFile,
    ]);

    processesApplied.push("reencode_h264", "noise_injection", "compression_normalize");

    // Upload result — return data URI for now since we're in a tmp context
    const outBuf = require("fs").readFileSync(outputFile);
    const b64 = outBuf.toString("base64");
    const dataUrl = `data:video/mp4;base64,${b64.slice(0, 100)}...`; // placeholder

    // Clean up
    try { require("fs").unlinkSync(inputFile); } catch { /* ignore */ }
    try { require("fs").unlinkSync(outputFile); } catch { /* ignore */ }

    return {
      inputUrl,
      outputUrl: dataUrl,    // in production: upload to Supabase and return URL
      processesApplied,
      skipped: false,
    };
  } catch (err) {
    return {
      inputUrl,
      outputUrl: inputUrl,   // pass through on error
      processesApplied,
      skipped: true,
      skipReason: `Post-processing failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
