export type LongVideoCharacter = {
  id: string;
  name: string;
  appearance: string;
  wardrobe: string;
  voiceProfile: string | null;
  faceReferenceAssetId: string | null;
  bodyReferenceAssetId: string | null;
  anchorFrameAssetIds: string[];
  consistencyRules: string[];
};

export type LongVideoLocation = {
  id: string;
  name: string;
  visualDescription: string;
  lighting: string;
  cameraStyle: string;
  environmentAnchors: string[];
};

export type LongVideoStoryBible = {
  id: string;
  title: string;
  logline: string;
  visualStyle: string;
  aspectRatio: string;
  fps: number;
  characters: LongVideoCharacter[];
  locations: LongVideoLocation[];
  globalContinuityRules: string[];
};

function clean(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export function buildLongVideoStoryBible(input: {
  projectId: string;
  title?: string;
  prompt?: string;
  style?: string;
  aspectRatio?: string;
  fps?: number;
  intelligence?: any;
}): LongVideoStoryBible {
  const root = input.intelligence?.intelligence || input.intelligence || {};
  const rawSubjects = array(root.subject_profiles || root.subjectProfiles || root.subjects);
  const rawLocations = array(root.locations || root.location_profiles || root.scenes);

  const characters: LongVideoCharacter[] = rawSubjects.length
    ? rawSubjects.map((subject, index) => ({
        id: String(subject.id || subject.subjectId || `character-${index + 1}`),
        name: clean(subject.name || subject.label, `Character ${index + 1}`),
        appearance: clean(subject.appearanceDescription || subject.appearance_description, "Use stored face/body reference. Preserve age, hair, skin tone, body type, and facial structure."),
        wardrobe: clean(subject.wardrobe || subject.clothingDescription || subject.clothing_description, "Preserve wardrobe unless the shot explicitly changes it."),
        voiceProfile: subject.voiceId || subject.voice_id || null,
        faceReferenceAssetId: subject.faceReferenceAssetId || subject.face_reference_asset_id || subject.face_reference || null,
        bodyReferenceAssetId: subject.bodyReferenceAssetId || subject.body_reference_asset_id || null,
        anchorFrameAssetIds: array(subject.anchorFrameAssetIds || subject.anchor_frame_asset_ids || subject.referenceFrames).map(String),
        consistencyRules: [
          "Keep the same person identity across every shot.",
          "Do not change face shape, age, hair, skin tone, or wardrobe unless explicitly requested.",
          "Use reference anchors for every shot where this character appears.",
        ],
      }))
    : [
        {
          id: "character-1",
          name: "Primary character",
          appearance: "Preserve the same face, age, body type, hair, skin tone, and wardrobe across all shots.",
          wardrobe: "Preserve the initial wardrobe unless explicitly changed.",
          voiceProfile: null,
          faceReferenceAssetId: null,
          bodyReferenceAssetId: null,
          anchorFrameAssetIds: [],
          consistencyRules: [
            "Use first approved frame as identity anchor.",
            "Keep identity stable across lighting, angle, and motion changes.",
          ],
        },
      ];

  const locations: LongVideoLocation[] = rawLocations.length
    ? rawLocations.slice(0, 8).map((location, index) => ({
        id: String(location.id || location.sceneId || `location-${index + 1}`),
        name: clean(location.name || location.label || location.title, `Location ${index + 1}`),
        visualDescription: clean(location.visualDescription || location.description, "Preserve location layout and background continuity."),
        lighting: clean(location.lighting, "Match lighting direction, color temperature, and contrast across adjacent shots."),
        cameraStyle: clean(location.cameraStyle || location.camera_motion, "Preserve camera language and lens feel."),
        environmentAnchors: array(location.environmentAnchors || location.referenceFrames).map(String),
      }))
    : [
        {
          id: "location-1",
          name: "Primary location",
          visualDescription: "Preserve environment layout, depth, lighting, props, and background continuity.",
          lighting: "Maintain consistent light direction, color temperature, and exposure.",
          cameraStyle: "Use coherent professional camera movement and framing.",
          environmentAnchors: [],
        },
      ];

  return {
    id: `story-bible-${input.projectId}`,
    title: clean(input.title, "Long-form AI video"),
    logline: clean(input.prompt, "Generate a professional long-form video with stable identity, style, motion, and continuity."),
    visualStyle: clean(input.style, "cinematic professional realism"),
    aspectRatio: clean(input.aspectRatio, "16:9"),
    fps: Number.isFinite(Number(input.fps)) ? Number(input.fps) : 24,
    characters,
    locations,
    globalContinuityRules: [
      "Generate short clips, not one long clip.",
      "Every shot must reference the story bible, identity anchors, and previous/next shot context.",
      "Every adjacent shot must pass continuity QA before stitch/export.",
      "Original source and all approved clips must remain non-destructive versions.",
    ],
  };
}
