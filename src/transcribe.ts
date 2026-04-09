import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { ensureTempDir, downloadFile, publicFileName } from "./serverFiles";

function spawnChecked(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe" });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

export async function assertFfmpegAvailable() {
  await spawnChecked("ffmpeg", ["-version"]);
}

export async function stitchVideosToPublic(videoUrls: string[]) {
  if (!videoUrls.length) throw new Error("No videos supplied for stitching");
  await assertFfmpegAvailable();

  const tempDir = await ensureTempDir("pipeline-stitch");
  const listPath = path.join(tempDir, "inputs.txt");

  const localFiles: string[] = [];
  for (let i = 0; i < videoUrls.length; i += 1) {
    const localPath = path.join(tempDir, `part-${i}.mp4`);
    await downloadFile(videoUrls[i], localPath);
    localFiles.push(localPath);
  }

  const listFileContents = localFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.writeFile(listPath, listFileContents);

  const publicDir = path.join(process.cwd(), "public", "pipeline-test");
  await fs.mkdir(publicDir, { recursive: true });
  const outputFileName = publicFileName("stitched", "mp4");
  const outputPath = path.join(publicDir, outputFileName);

  await spawnChecked("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);

  return `/pipeline-test/${outputFileName}`;
}

export async function extractAudioAndSilentVideoToPublic(videoUrl: string) {
  await assertFfmpegAvailable();

  const tempDir = await ensureTempDir("pipeline-audio");
  const sourcePath = path.join(tempDir, "source.mp4");
  await downloadFile(videoUrl, sourcePath);

  const publicDir = path.join(process.cwd(), "public", "pipeline-test");
  await fs.mkdir(publicDir, { recursive: true });

  const audioName = publicFileName("audio-master", "wav");
  const silentVideoName = publicFileName("silent-master", "mp4");
  const audioPath = path.join(publicDir, audioName);
  const silentVideoPath = path.join(publicDir, silentVideoName);

  await spawnChecked("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "44100",
    "-ac",
    "2",
    audioPath,
  ]);

  await spawnChecked("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-an",
    "-c:v",
    "copy",
    silentVideoPath,
  ]);

  return {
    audioUrl: `/pipeline-test/${audioName}`,
    silentVideoUrl: `/pipeline-test/${silentVideoName}`,
  };
}
