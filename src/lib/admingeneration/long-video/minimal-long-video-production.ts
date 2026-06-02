export type LongVideoProviderIntent =
  | "runway"
  | "kling"
  | "veo"
  | "fal"
  | "provider_router";

export type LongVideoIdentityAnchor = {
  id: string;
  label: string;
  referenceAssetIds: string[];
  rules: string[];
};

export type LongVideoShotPlan = {
  id: string;
  sceneId: string;
  shotIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  providerIntent: LongVideoProviderIntent;
  prompt: string;
  negativePrompt: string;
  identityAnchorIds: string[];
  referenceAssetIds: string[];
  status: "planned";
};

export type LongVideoScenePlan = {
  id: string;
  sceneIndex: number;
  title: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  shotIds: string[];
};

export type MinimalLongVideoProductionPlan = {
  ok: true;
  mode: "long_video";
  projectId: string;
  targetDurationSec: number;
  maxShotDurationSec: number;
  fps: number;
  aspectRatio: string;
  identityLock: true;
  preserveOriginal: true;
  stitchRequired: true;
  qaRequired: true;
  prompt: string;
  identityAnchors: LongVideoIdentityAnchor[];
  scenes: LongVideoScenePlan[];
  shots: LongVideoShotPlan[];
  continuityQa: {
    requiredChecks: string[];
    status: "planned";
  };
  stitchPlan: {
    clipOrder: string[];
    seamRepairRequired: true;
    audioCrossfadeRequired: true;
    exportContainer: "mp4";
    exportCodec: "h264";
    status: "planned";
  };
};

function cleanText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function chooseProvider(index: number): LongVideoProviderIntent {
  const providers: LongVideoProviderIntent[] = ["runway", "kling", "veo", "fal"];
  return providers[index % providers.length];
}

function buildIdentityAnchors(input: {
  referenceAssetIds?: string[];
  identityDescription?: string;
}): LongVideoIdentityAnchor[] {
  return [
    {
      id: "primary-identity",
      label: "Primary identity / style anchor",
      referenceAssetIds: Array.isArray(input.referenceAssetIds) ? input.referenceAssetIds : [],
      rules: [
        cleanText(
          input.identityDescription,
          "Preserve the same character identity, face, body, wardrobe, lighting style, camera language, and visual style across every shot.",
        ),
        "Every shot must use available reference frames or the closest approved identity/style anchor.",
        "Do not change face, wardrobe, body proportions, age, or style unless explicitly requested.",
      ],
    },
  ];
}

export function buildMinimalLongVideoProductionPlan(input: {
  projectId?: string;
  prompt?: string;
  targetDurationSec?: number;
  maxShotDurationSec?: number;
  fps?: number;
  aspectRatio?: string;
  referenceAssetIds?: string[];
  identityDescription?: string;
}): MinimalLongVideoProductionPlan {
  const projectId = cleanText(input.projectId, `long-video-${Date.now()}`);
  const prompt = cleanText(input.prompt, "Generate a professional long-form AI video.");
  const targetDurationSec = Math.max(16, cleanNumber(input.targetDurationSec, 60));
  const maxShotDurationSec = Math.max(4, Math.min(12, cleanNumber(input.maxShotDurationSec, 8)));
  const fps = cleanNumber(input.fps, 24);
  const aspectRatio = cleanText(input.aspectRatio, "16:9");
  const identityAnchors = buildIdentityAnchors({
    referenceAssetIds: input.referenceAssetIds,
    identityDescription: input.identityDescription,
  });

  const shotCount = Math.ceil(targetDurationSec / maxShotDurationSec);

  const shots: LongVideoShotPlan[] = Array.from({ length: shotCount }, (_, index) => {
    const startSec = index * maxShotDurationSec;
    const endSec = Math.min(targetDurationSec, startSec + maxShotDurationSec);
    const sceneIndex = Math.floor(index / 3) + 1;
    const shotIndex = index + 1;

    return {
      id: `shot-${shotIndex}`,
      sceneId: `scene-${sceneIndex}`,
      shotIndex,
      startSec,
      endSec,
      durationSec: Math.max(1, endSec - startSec),
      providerIntent: chooseProvider(index),
      prompt: [
        prompt,
        `Shot ${shotIndex} of a longer production.`,
        "Preserve the same identity, style, lighting, camera continuity, wardrobe, and environment anchors.",
        "Use this shot as part of a stitched long-form sequence, not as a standalone random clip.",
      ].join(" "),
      negativePrompt: [
        "identity drift",
        "face change",
        "wardrobe change",
        "broken hands",
        "mouth mismatch",
        "lighting mismatch",
        "camera jump",
        "flicker",
        "new unwanted objects",
      ].join(", "),
      identityAnchorIds: identityAnchors.map((anchor) => anchor.id),
      referenceAssetIds: identityAnchors.flatMap((anchor) => anchor.referenceAssetIds),
      status: "planned",
    };
  });

  const scenes: LongVideoScenePlan[] = [];
  for (const shot of shots) {
    let scene = scenes.find((item) => item.id === shot.sceneId);
    if (!scene) {
      scene = {
        id: shot.sceneId,
        sceneIndex: scenes.length + 1,
        title: `Scene ${scenes.length + 1}`,
        startSec: shot.startSec,
        endSec: shot.endSec,
        durationSec: 0,
        shotIds: [],
      };
      scenes.push(scene);
    }

    scene.endSec = Math.max(scene.endSec, shot.endSec);
    scene.durationSec = scene.endSec - scene.startSec;
    scene.shotIds.push(shot.id);
  }

  return {
    ok: true,
    mode: "long_video",
    projectId,
    targetDurationSec,
    maxShotDurationSec,
    fps,
    aspectRatio,
    identityLock: true,
    preserveOriginal: true,
    stitchRequired: true,
    qaRequired: true,
    prompt,
    identityAnchors,
    scenes,
    shots,
    continuityQa: {
      requiredChecks: [
        "identity consistency",
        "wardrobe consistency",
        "lighting continuity",
        "camera continuity",
        "motion continuity",
        "audio continuity",
        "mouth sync if dialogue exists",
        "no flicker or visible seam",
      ],
      status: "planned",
    },
    stitchPlan: {
      clipOrder: shots.map((shot) => shot.id),
      seamRepairRequired: true,
      audioCrossfadeRequired: true,
      exportContainer: "mp4",
      exportCodec: "h264",
      status: "planned",
    },
  };
}
