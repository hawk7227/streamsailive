import type { LongVideoStoryBible } from "./long-video-story-bible";

export type PlannedLongVideoShot = {
  id: string;
  sceneId: string;
  shotIndex: number;
  title: string;
  durationSec: number;
  startSec: number;
  endSec: number;
  prompt: string;
  negativePrompt: string;
  characterIds: string[];
  locationId: string;
  referenceFrameAssetIds: string[];
  previousShotId: string | null;
  nextShotId: string | null;
  continuityRequirements: string[];
  providerIntent: "runway" | "kling" | "veo" | "fal" | "provider_router";
};

export type PlannedLongVideoScene = {
  id: string;
  sceneIndex: number;
  title: string;
  durationSec: number;
  shots: PlannedLongVideoShot[];
};

export type LongVideoProductionPlan = {
  id: string;
  projectId: string;
  storyBible: LongVideoStoryBible;
  targetDurationSec: number;
  maxShotDurationSec: number;
  scenes: PlannedLongVideoScene[];
  shots: PlannedLongVideoShot[];
};

function chooseProvider(index: number): PlannedLongVideoShot["providerIntent"] {
  const providers: PlannedLongVideoShot["providerIntent"][] = ["runway", "kling", "veo", "fal"];
  return providers[index % providers.length];
}

export function buildProfessionalShotPlan(input: {
  projectId: string;
  storyBible: LongVideoStoryBible;
  targetDurationSec?: number;
  maxShotDurationSec?: number;
  instruction?: string;
}): LongVideoProductionPlan {
  const targetDurationSec = Math.max(16, Number(input.targetDurationSec || 90));
  const maxShotDurationSec = Math.max(4, Math.min(12, Number(input.maxShotDurationSec || 8)));
  const shotCount = Math.ceil(targetDurationSec / maxShotDurationSec);
  const sceneSize = 3;

  const shots: PlannedLongVideoShot[] = Array.from({ length: shotCount }, (_, index) => {
    const sceneIndex = Math.floor(index / sceneSize) + 1;
    const startSec = index * maxShotDurationSec;
    const endSec = Math.min(targetDurationSec, startSec + maxShotDurationSec);
    const primaryCharacter = input.storyBible.characters[0];
    const location = input.storyBible.locations[(sceneIndex - 1) % input.storyBible.locations.length];

    return {
      id: `shot-${index + 1}`,
      sceneId: `scene-${sceneIndex}`,
      shotIndex: index + 1,
      title: `Shot ${index + 1}`,
      durationSec: Math.max(1, endSec - startSec),
      startSec,
      endSec,
      prompt: [
        input.instruction || input.storyBible.logline,
        `Shot ${index + 1}.`,
        `Location: ${location.name}.`,
        `Character: ${primaryCharacter.name}.`,
        `Preserve: ${primaryCharacter.appearance}.`,
        `Wardrobe: ${primaryCharacter.wardrobe}.`,
        `Lighting: ${location.lighting}.`,
        `Camera: ${location.cameraStyle}.`,
        "Maintain continuity with previous and next shots.",
      ].join(" "),
      negativePrompt: [
        "identity drift",
        "face change",
        "wardrobe change",
        "extra fingers",
        "broken hands",
        "mouth mismatch",
        "flicker",
        "camera jump",
        "lighting mismatch",
        "new unwanted objects",
      ].join(", "),
      characterIds: [primaryCharacter.id],
      locationId: location.id,
      referenceFrameAssetIds: [
        ...primaryCharacter.anchorFrameAssetIds,
        ...location.environmentAnchors,
      ],
      previousShotId: index > 0 ? `shot-${index}` : null,
      nextShotId: index < shotCount - 1 ? `shot-${index + 2}` : null,
      continuityRequirements: [
        "Match character identity with anchor frames.",
        "Match wardrobe and body proportions.",
        "Match location layout and lighting.",
        "Match camera movement continuity.",
        "Preserve audio/dialogue timing if present.",
      ],
      providerIntent: chooseProvider(index),
    };
  });

  const scenes: PlannedLongVideoScene[] = [];
  for (const shot of shots) {
    let scene = scenes.find((item) => item.id === shot.sceneId);
    if (!scene) {
      scene = {
        id: shot.sceneId,
        sceneIndex: scenes.length + 1,
        title: `Scene ${scenes.length + 1}`,
        durationSec: 0,
        shots: [],
      };
      scenes.push(scene);
    }
    scene.shots.push(shot);
    scene.durationSec += shot.durationSec;
  }

  return {
    id: `long-production-plan-${input.projectId}`,
    projectId: input.projectId,
    storyBible: input.storyBible,
    targetDurationSec,
    maxShotDurationSec,
    scenes,
    shots,
  };
}
