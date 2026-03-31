import type { ReferenceAnalysis } from "../types";

export interface StructuralScoreBreakdownItem {
  label: string;
  score: number;
  note: string;
}

export interface StructuralScore {
  realismScore: number;
  faceIntegrity: number;
  bodyIntegrity: number;
  poseStability: number;
  lightingConsistency: number;
  textureRealism: number;
  backgroundIntegrity: number;
  isSafeForVideo: boolean;
  blockedReasons: string[];
  recommendedFixes: string[];
  breakdown: StructuralScoreBreakdownItem[];
}

interface StructuralInput {
  referenceSummary?: string | null;
  storyBible?: string | null;
  referenceAnalysis: ReferenceAnalysis;
  medium: "image" | "video" | "song" | "script" | "voice";
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function scoreStructuralIntegrity(input: StructuralInput): StructuralScore {
  const text = `${input.referenceSummary ?? ""} ${input.storyBible ?? ""}`.toLowerCase();
  const risks = {
    face: /(blur face|soft face|blob|melt|warped eye|asym|distort)/.test(text),
    hands: /(hand|fingers|full body|holding|arms raised|gesture)/.test(text),
    fullBody: /(full body|standing|walking|running|jump|dance)/.test(text),
    unstablePose: /(jump|spin|flip|fight|running|crowd)/.test(text),
    mixedLighting: /(night club|strobe|neon|mixed light|spotlight|stage)/.test(text),
    backgroundComplexity: /(city street|crowd|party|forest|beach|market|classroom)/.test(text),
  };

  let faceIntegrity = 92;
  let bodyIntegrity = 90;
  let poseStability = 90;
  let lightingConsistency = 91;
  let textureRealism = 90;
  let backgroundIntegrity = 89;

  const blockedReasons: string[] = [];
  const recommendedFixes: string[] = [];

  if (input.referenceAnalysis.anatomyRisk === "high") {
    faceIntegrity -= 18;
    bodyIntegrity -= 22;
    poseStability -= 14;
    blockedReasons.push("Reference anatomy risk is high.");
    recommendedFixes.push("Repair or replace source still before video generation.");
  } else if (input.referenceAnalysis.anatomyRisk === "medium") {
    bodyIntegrity -= 10;
    poseStability -= 8;
    recommendedFixes.push("Keep motion simple and repair visible hands before video.");
  }

  if (input.referenceAnalysis.likelySingleStill) {
    poseStability -= 10;
    backgroundIntegrity -= 4;
    recommendedFixes.push("Use low-motion i2v or synthesize anchor frames before full video.");
  }

  if (!input.referenceAnalysis.hasReferences && input.medium === "video") {
    faceIntegrity -= 8;
    bodyIntegrity -= 8;
    recommendedFixes.push("Generate reviewed stills first before expensive video generation.");
  }

  if (risks.face) {
    faceIntegrity -= 20;
    textureRealism -= 12;
    blockedReasons.push("Face integrity cues suggest a blob or warp risk.");
  }

  if (risks.hands) {
    bodyIntegrity -= 12;
    recommendedFixes.push("Run hand and wrist validation before video.");
  }

  if (risks.fullBody) {
    bodyIntegrity -= 8;
    poseStability -= 8;
    recommendedFixes.push("Prefer full-body reference coverage or reduce camera framing.");
  }

  if (risks.unstablePose) {
    poseStability -= 16;
    recommendedFixes.push("Reduce motion complexity or collect multi-angle references.");
  }

  if (risks.mixedLighting) {
    lightingConsistency -= 14;
    recommendedFixes.push("Normalize lighting direction before generation.");
  }

  if (risks.backgroundComplexity) {
    backgroundIntegrity -= 10;
    recommendedFixes.push("Stabilize environment details or simplify background before motion.");
  }

  if (text.includes("younger") || text.includes("kid") || text.includes("child")) {
    textureRealism -= 4;
    recommendedFixes.push("Use age-consistent facial and body cues in the identity pack.");
  }

  faceIntegrity = clamp(faceIntegrity);
  bodyIntegrity = clamp(bodyIntegrity);
  poseStability = clamp(poseStability);
  lightingConsistency = clamp(lightingConsistency);
  textureRealism = clamp(textureRealism);
  backgroundIntegrity = clamp(backgroundIntegrity);

  const realismScore = clamp(Math.round(
    faceIntegrity * 0.22 +
    bodyIntegrity * 0.20 +
    poseStability * 0.18 +
    lightingConsistency * 0.14 +
    textureRealism * 0.14 +
    backgroundIntegrity * 0.12,
  ));

  const isSafeForVideo = realismScore >= 85 && blockedReasons.length === 0;
  if (!isSafeForVideo && input.medium === "video") {
    recommendedFixes.unshift("Do not send this directly to video. Repair or prebuild anchor stills first.");
  }

  const breakdown: StructuralScoreBreakdownItem[] = [
    { label: "Face integrity", score: faceIntegrity, note: faceIntegrity < 85 ? "Potential drift or blob-face risk." : "Stable enough for realism-first use." },
    { label: "Body integrity", score: bodyIntegrity, note: bodyIntegrity < 85 ? "Limb completeness needs protection." : "Body continuity looks usable." },
    { label: "Pose stability", score: poseStability, note: poseStability < 85 ? "Reduce motion or add anchor frames." : "Pose can support controlled motion." },
    { label: "Lighting", score: lightingConsistency, note: lightingConsistency < 85 ? "Light direction may drift in video." : "Lighting is consistent enough." },
    { label: "Texture realism", score: textureRealism, note: textureRealism < 85 ? "Too smooth or synthetic looking." : "Texture reads natural enough." },
    { label: "Background", score: backgroundIntegrity, note: backgroundIntegrity < 85 ? "Environment may warp under motion." : "Background can hold up under light motion." },
  ];

  return {
    realismScore,
    faceIntegrity,
    bodyIntegrity,
    poseStability,
    lightingConsistency,
    textureRealism,
    backgroundIntegrity,
    isSafeForVideo,
    blockedReasons,
    recommendedFixes: [...new Set(recommendedFixes)],
    breakdown,
  };
}
