#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createWriteStream, readFileSync, existsSync, mkdirSync } from "node:fs";
import { mkdtemp, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, extname } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    if (!process.env[k]) process.env[k] = rest.join("=").replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(".env.local");

const BASE_URL = process.env.STREAMS_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "https://streamsailive.vercel.app";
const ADMIN_KEY = process.env.ADMIN_GENERATION_KEY || process.env.STREAMS_INTAKE_KEY || process.env.INTAKE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.STREAMS_REFERENCE_BUCKET || "reference-assets";

const analysisId = process.argv[2];
if (!analysisId) {
  console.error("Usage: node scripts/video-analyzer-worker.mjs <analysisId>");
  process.exit(1);
}
if (!ADMIN_KEY) throw new Error("ADMIN_GENERATION_KEY/STREAMS_INTAKE_KEY/INTAKE_API_KEY is required.");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ADMIN_KEY}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} failed ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function event(eventType, status, message, extra = {}) {
  await api(`/api/admingeneration/reference/analyze/${analysisId}/worker-event`, {
    method: "POST",
    body: JSON.stringify({ eventType, status, message, ...extra }),
  });
}

async function uploadFile(localPath, remotePath, mimeType) {
  const bytes = readFileSync(localPath);
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${remotePath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`Supabase upload failed ${res.status}: ${await res.text()}`);
  }
  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${remotePath}`;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Source download failed ${res.status}`);
  await new Promise((resolve, reject) => {
    const out = createWriteStream(dest);
    res.body.pipeTo(new WritableStream({
      write(chunk) { out.write(Buffer.from(chunk)); },
      close() { out.end(resolve); },
      abort(err) { out.destroy(err); reject(err); },
    })).catch(reject);
  });
}

async function main() {
  run("ffmpeg", ["-version"]);
  run("ffprobe", ["-version"]);

  await event("worker_started", "running", "Analyzer worker started", { analysisStatus: "analyzing" });

  const analysisRes = await fetch(`${BASE_URL}/api/admingeneration/reference/analyze/${analysisId}`, { cache: "no-store" });
  const analysisJson = await analysisRes.json();
  if (!analysisRes.ok || !analysisJson?.analysis) throw new Error("Could not load analysis.");

  const sourceUrl = analysisJson.analysis.sourceUrl;
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    await event("source_blocked", "blocked", "No direct downloadable source URL is available for ffmpeg worker.", { analysisStatus: "needs_worker" });
    return;
  }

  if (/youtube\.com|youtu\.be/i.test(sourceUrl)) {
    await event("source_blocked", "blocked", "YouTube URL requires a downloader integration before ffmpeg can process source bytes.", { analysisStatus: "needs_worker" });
    return;
  }

  const workDir = await mkdtemp(join(tmpdir(), "streams-video-analyzer-"));
  mkdirSync(join(workDir, "frames"), { recursive: true });
  const sourcePath = join(workDir, `source${extname(new URL(sourceUrl).pathname) || ".mp4"}`);
  const audioPath = join(workDir, "audio.wav");

  await event("download_started", "running", "Downloading source video.");
  await download(sourceUrl, sourcePath);

  await event("ffprobe_started", "running", "Reading video metadata.");
  const metadataRaw = run("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", sourcePath]);
  const metadata = JSON.parse(metadataRaw);

  await event("frame_extract_started", "running", "Extracting key frames.");
  run("ffmpeg", ["-y", "-i", sourcePath, "-vf", "fps=1,scale=1280:-1", "-frames:v", "12", join(workDir, "frames", "frame-%03d.jpg")]);

  await event("audio_extract_started", "running", "Extracting audio track.");
  run("ffmpeg", ["-y", "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", audioPath]);

  const prefix = `admingeneration/analyzer/${analysisId}/${Date.now()}`;
  const assetRows = [];

  const frameFiles = (await readdir(join(workDir, "frames"))).filter((name) => name.endsWith(".jpg")).sort();
  const frameAssetIds = [];
  for (const name of frameFiles) {
    const local = join(workDir, "frames", name);
    const publicUrl = await uploadFile(local, `${prefix}/frames/${name}`, "image/jpeg");
    frameAssetIds.push(publicUrl);
    assetRows.push({
      assetKind: "frame",
      assetUrl: publicUrl,
      storageBucket: BUCKET,
      storagePath: `${prefix}/frames/${name}`,
      mimeType: "image/jpeg",
      metadata: { fileName: name, source: "ffmpeg" },
    });
  }

  const audioUrl = await uploadFile(audioPath, `${prefix}/audio/audio.wav`, "audio/wav");
  assetRows.push({
    assetKind: "audio",
    assetUrl: audioUrl,
    storageBucket: BUCKET,
    storagePath: `${prefix}/audio/audio.wav`,
    mimeType: "audio/wav",
    metadata: { source: "ffmpeg", role: "extracted_audio" },
  });

  const duration = Number(metadata?.format?.duration || 0);
  const segmentCount = Math.max(1, Math.min(6, Math.ceil(duration / 5)));
  const segments = Array.from({ length: segmentCount }).map((_, i) => ({
    segmentType: "shot",
    segmentIndex: i + 1,
    startSec: i * 5,
    endSec: Math.min(duration || (i + 1) * 5, (i + 1) * 5),
    label: `Detected timeline segment ${i + 1}`,
    frameAssetIds,
    metadata: {
      detectionMode: "deterministic_time_slices",
      workerNote: "Shot boundary model not yet attached; this is a deterministic timeline segment created by the real ffmpeg worker.",
    },
  }));

  await event("intelligence_write_started", "running", "Writing intelligence graph.");
  await api(`/api/admingeneration/reference/analyze/${analysisId}/intelligence`, {
    method: "POST",
    body: JSON.stringify({
      status: "analyzing",
      summary: "FFmpeg worker extracted metadata, frames, and audio. Model-based vision/audio analysis is the next provider slice.",
      assets: assetRows,
      segments,
      subjects: [],
      speakers: [],
      motionProfiles: [
        {
          targetType: "project",
          motionProfile: { status: "pending_model_analysis" },
          cameraMotionProfile: { status: "pending_optical_flow_or_model_analysis" },
          gestureProfile: { status: "pending_model_analysis" },
          expressionProfile: { status: "pending_model_analysis" },
          metadata: { source: "ffmpeg_worker" },
        },
      ],
      qualityReports: [
        {
          status: "pending_model_qa",
          report: { ffmpegProbe: metadata, extractedFrames: frameFiles.length, extractedAudio: true },
          issues: [],
        },
      ],
      mediaGraphs: [
        {
          graph: {
            source: { url: sourceUrl },
            assets: assetRows,
            segments,
            metadata,
          },
          metadata: { source: "ffmpeg_worker" },
        },
      ],
    }),
  });

  await event("worker_completed", "completed", "FFmpeg worker completed metadata/frame/audio extraction.", { analysisStatus: "analyzing" });
}

main().catch(async (err) => {
  try {
    await event("worker_failed", "failed", err instanceof Error ? err.message : String(err), { analysisStatus: "failed" });
  } catch {}
  console.error(err);
  process.exit(1);
});
