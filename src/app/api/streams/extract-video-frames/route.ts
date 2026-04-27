/**
 * POST /api/streams/extract-video-frames
 * 
 * Extract key frames from video for thumbnail selection
 * Uses FFmpeg to process actual video files
 * Used in Phase 3 for thumbnail picker
 */

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

interface ExtractRequest {
  videoUrl: string;
  frameCount?: number; // Default 5, max 20
}

interface ExtractResponse {
  frames: Array<{
    timestamp: number;
    dataUrl: string;
  }>;
  duration: number;
  fps: number;
  error?: string;
}

// Get video duration and fps using ffprobe
async function getVideoMetadata(videoPath: string) {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:noescapestr=1 "${videoPath}"`
    );
    const duration = parseFloat(stdout.trim());
    
    const { stdout: fpsOut } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    const [fpsNum, fpsDen] = fpsOut.trim().split("/").map(Number);
    const fps = fpsNum / (fpsDen || 1);

    return { duration, fps };
  } catch {
    return { duration: 30, fps: 24 }; // Fallback
  }
}

// Extract frames from video at specific timestamps
async function extractFrames(videoPath: string, timestamps: number[]): Promise<string[]> {
  const frames: string[] = [];
  const tmpDir = os.tmpdir();

  try {
    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const outputPath = path.join(tmpDir, `frame_${i}_${Date.now()}.jpg`);

      // Use FFmpeg to extract frame at specific timestamp
      await execAsync(
        `ffmpeg -ss ${timestamp} -i "${videoPath}" -vf "scale=320:-1" -vframes 1 -q:v 2 "${outputPath}" 2>/dev/null`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      // Read frame and convert to data URL
      if (fs.existsSync(outputPath)) {
        const imageBuffer = fs.readFileSync(outputPath);
        const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
        frames.push(dataUrl);

        // Clean up temp file
        fs.unlinkSync(outputPath);
      }
    }

    return frames;
  } catch (error) {
    console.error("Frame extraction error:", error);
    return [];
  }
}

// Download video from URL to temp file
async function downloadVideo(videoUrl: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `video_${Date.now()}.mp4`);

  try {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(tmpPath, Buffer.from(buffer));

    return tmpPath;
  } catch (error) {
    console.error("Download error:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const tmpPath: string | null = null;
  
  try {
    const body = (await request.json()) as ExtractRequest;
    const { videoUrl, frameCount = 5 } = body;

    if (!videoUrl?.trim()) {
      return NextResponse.json(
        { error: "No video URL provided" },
        { status: 400 }
      );
    }

    // Validate frame count
    const count = Math.min(Math.max(1, frameCount), 20);

    // Download video to temp file
    let videoPath: string;
    try {
      videoPath = await downloadVideo(videoUrl);
    } catch {
      return NextResponse.json(
        { error: "Failed to download video. Ensure URL is accessible and is a valid video file." },
        { status: 400 }
      );
    }

    // Get video metadata
    const { duration, fps } = await getVideoMetadata(videoPath);

    // Calculate frame timestamps (distribute evenly through video)
    const timestamps = Array.from({ length: count }, (_, i) => {
      return (i + 1) * (duration / (count + 1));
    });

    // Extract frames at calculated timestamps
    const frames = await extractFrames(videoPath, timestamps);

    // Clean up temp video file
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }

    const response: ExtractResponse = {
      frames: frames.map((dataUrl, i) => ({
        timestamp: timestamps[i],
        dataUrl,
      })),
      duration,
      fps: Math.round(fps),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Frame extraction error:", error);
    
    // Clean up if temp file exists
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }

    return NextResponse.json(
      { error: "Frame extraction failed. Ensure FFmpeg is installed on the server." },
      { status: 500 }
    );
  }
}
