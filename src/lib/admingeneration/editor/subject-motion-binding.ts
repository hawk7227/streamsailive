export type SubjectMotionBinding = {
  id: string;
  subjectId: string;
  label: string;
  faceReferenceAssetId: string | null;
  appearanceDescription: string | null;
  voiceId: string | null;
  motionProfileId: string | null;
  cameraMotionProfileId: string | null;
  speakingSegmentIds: string[];
  sceneIds: string[];
  qaStatus: "needs_check" | "pass" | "fail";
};

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function buildSubjectMotionBindings(input: {
  intelligence?: any;
  timeline?: any;
}) {
  const root = input.intelligence?.intelligence || input.intelligence || {};
  const subjects = asArray(root.subject_profiles || root.subjectProfiles || root.subjects);
  const speakingSegments = asArray(root.speakingSegments || root.speaking_segments);
  const scenes = asArray(input.timeline?.timeline?.segments || input.timeline?.segments || root.scene_segments || root.scenes);

  const bindings: SubjectMotionBinding[] = subjects.map((subject, index) => {
    const subjectId = String(subject.id || subject.subjectId || `subject-${index + 1}`);

    return {
      id: `binding-${subjectId}`,
      subjectId,
      label: asString(subject.label || subject.name, `Subject ${index + 1}`),
      faceReferenceAssetId: subject.faceReferenceAssetId || subject.face_reference_asset_id || subject.face_reference || null,
      appearanceDescription: subject.appearanceDescription || subject.appearance_description || null,
      voiceId: subject.voiceId || subject.voice_id || null,
      motionProfileId: subject.motionProfileId || subject.motion_profile_id || null,
      cameraMotionProfileId: subject.cameraMotionProfileId || subject.camera_motion_profile_id || null,
      speakingSegmentIds: speakingSegments
        .filter((segment) => String(segment.subjectId || segment.subject_id || segment.speakerId || "") === subjectId)
        .map((segment) => String(segment.id || segment.segmentId)),
      sceneIds: scenes
        .filter((scene) => String(scene.subjectId || scene.subject_id || "") === subjectId)
        .map((scene) => String(scene.id || scene.sceneId || scene.segmentId)),
      qaStatus: "needs_check",
    };
  });

  return {
    ok: true,
    status: bindings.length ? "loaded" : "missing_subject_profiles",
    bindings,
  };
}
