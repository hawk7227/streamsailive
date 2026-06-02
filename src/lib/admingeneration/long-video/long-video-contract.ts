export type LongVideoProvider = "runway" | "kling" | "veo" | "fal" | "ffmpeg" | "provider_router";

export type LongVideoShot = {
  id: string;
  sceneId: string;
  shotIndex: number;
  prompt: string;
  durationSec: number;
  provider: LongVideoProvider;
  referenceFrameAssetId: string | null;
  identityProfileIds: string[];
  motionProfileId: string | null;
  audioSegmentId: string | null;
  transcriptSegmentId: string | null;
  startSec: number;
  endSec: number;
  status: "planned" | "queued" | "running" | "complete" | "failed" | "blocked";
};

export type LongVideoScene = {
  id: string;
  sceneIndex: number;
  title: string;
  prompt: string;
  durationSec: number;
  shots: LongVideoShot[];
};

export type LongVideoPlan = {
  id: string;
  projectId: string;
  targetDurationSec: number;
  maxShotDurationSec: number;
  fps: number;
  aspectRatio: string;
  styleLock: string | null;
  identityLock: boolean;
  preserveOriginal: true;
  scenes: LongVideoScene[];
  stitchRequired: true;
  qaRequired: true;
};

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function chooseProvider(index: number): LongVideoProvider {
  const providers: LongVideoProvider[] = ["runway", "kling", "veo", "fal"];
  return providers[index % providers.length];
}

export function buildLongVideoPlan(input: {
  projectId: string;
  instruction?: string;
  targetDurationSec?: number;
  maxShotDurationSec?: number;
  fps?: number;
  aspectRatio?: string;
  timeline?: any;
  intelligence?: any;
}): LongVideoPlan {
  const targetDurationSec = Math.max(8, asNumber(input.targetDurationSec, 60));
  const maxShotDurationSec = Math.max(4, Math.min(12, asNumber(input.maxShotDurationSec, 8)));
  const fps = asNumber(input.fps || input.timeline?.fps || input.intelligence?.fps, 24);
  const rawSegments =
    asArray(input.timeline?.timeline?.segments) ||
    asArray(input.timeline?.segments) ||
    asArray(input.intelligence?.segments) ||
    [];

  const shotCount = Math.max(1, Math.ceil(targetDurationSec / maxShotDurationSec));
  const shots: LongVideoShot[] = Array.from({ length: shotCount }, (_, index) => {
    const segment = rawSegments[index] || {};
    const startSec = index * maxShotDurationSec;
    const endSec = Math.min(targetDurationSec, startSec + maxShotDurationSec);

    return {
      id: `long-shot-${index + 1}`,
      sceneId: `long-scene-${Math.floor(index / 3) + 1}`,
      shotIndex: index + 1,
      prompt: asString(
        segment.prompt || segment.label,
        `${input.instruction || "Continue the professional video"} — shot ${index + 1}. Preserve identity, wardrobe, lighting, camera continuity, and motion style.`,
      ),
      durationSec: Math.max(1, endSec - startSec),
      provider: chooseProvider(index),
      referenceFrameAssetId: segment.referenceFrameAssetId || segment.frameId || null,
      identityProfileIds: asArray(segment.identityProfileIds || segment.subjectIds).map(String),
      motionProfileId: segment.motionProfileId || null,
      audioSegmentId: segment.audioSegmentId || null,
      transcriptSegmentId: segment.transcriptSegmentId || segment.transcriptId || null,
      startSec,
      endSec,
      status: "planned",
    };
  });

  const scenes: LongVideoScene[] = [];
  for (const shot of shots) {
    let scene = scenes.find((item) => item.id === shot.sceneId);
    if (!scene) {
      scene = {
        id: shot.sceneId,
        sceneIndex: scenes.length + 1,
        title: `Scene ${scenes.length + 1}`,
        prompt: input.instruction || "Professional long-form AI video scene",
        durationSec: 0,
        shots: [],
      };
      scenes.push(scene);
    }

    scene.shots.push(shot);
    scene.durationSec += shot.durationSec;
  }

  return {
    id: `long-plan-${input.projectId}`,
    projectId: input.projectId,
    targetDurationSec,
    maxShotDurationSec,
    fps,
    aspectRatio: input.aspectRatio || "16:9",
    styleLock: input.instruction || null,
    identityLock: true,
    preserveOriginal: true,
    scenes,
    stitchRequired: true,
    qaRequired: true,
  };
}
