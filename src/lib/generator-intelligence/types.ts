export type GeneratorTarget =
  | "openai-image"
  | "openai-video"
  | "runway-video"
  | "kling-video"
  | "suno-song"
  | "udio-song"
  | "openai-script"
  | "openai-voice"
  | "elevenlabs-voice";

export type GeneratorMedium = "image" | "video" | "song" | "script" | "voice";

export interface GeneratorProfile {
  id: GeneratorTarget;
  label: string;
  medium: GeneratorMedium;
  promptStyle: "descriptive" | "structured" | "hybrid";
  strengths: string[];
  weaknesses: string[];
  realismBias: number;
  requiresMotionPlan: boolean;
  requiresReferencePack: boolean;
  commonFailureModes: string[];
}

export interface ReferenceAnalysis {
  hasReferences: boolean;
  referenceStrength: "none" | "low" | "medium" | "high";
  likelyMultiAngle: boolean;
  likelySingleStill: boolean;
  identitySensitive: boolean;
  anatomyRisk: "low" | "medium" | "high";
  warnings: string[];
  guidance: string[];
}

export interface MotionPlan {
  complexity: "minimal" | "low" | "medium";
  cameraStyle: string;
  allowedMoves: string[];
  blockedMoves: string[];
  notes: string[];
}

export interface RealismPolicy {
  headline: string;
  mustInclude: string[];
  mustAvoid: string[];
  qaChecklist: string[];
}

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

export interface RepairPlan {
  shouldRetry: boolean;
  maxAttempts: number;
  strategy: "region_repair" | "anchor_frame_prebuild" | "motion_reduction" | "regenerate_still" | "none";
  instructions: string[];
}

export interface ContinuityPlan {
  continuityRequired: boolean;
  sceneMode: "single_scene" | "multi_scene";
  identityLockStrength: "light" | "medium" | "high";
  environmentLock: string[];
  continuityNotes: string[];
}

export interface IdentityLockPlan {
  sourceType: "self" | "family_or_friend" | "synthetic" | "mixed" | "unknown";
  needsCharacterPack: boolean;
  fields: string[];
  rules: string[];
}

export interface QaPass {
  label: string;
  passed: boolean;
  note: string;
}

export interface QaOrchestrationResult {
  shouldAutoReview: boolean;
  shouldRetry: boolean;
  reasons: string[];
  passes: QaPass[];
}

export interface CompiledGenerationRequest {
  provider: string;
  target: GeneratorTarget;
  medium: GeneratorMedium;
  prompt: string;
  notes: string[];
  realismRules: string[];
  qaChecklist: string[];
  storyBibleRequired: boolean;
  sourceKind?: "self" | "family_or_friend" | "synthetic" | "mixed";
  warnings: string[];
  providerGuidance: string[];
  referenceAnalysis: ReferenceAnalysis;
  motionPlan?: MotionPlan;
  realismPolicy: RealismPolicy;
  structuralScore?: StructuralScore;
  repairPlan?: RepairPlan;
  continuityPlan?: ContinuityPlan;
  identityLockPlan?: IdentityLockPlan;
  qaOrchestration?: QaOrchestrationResult;
}

export interface CompilerInput {
  medium: GeneratorMedium;
  prompt: string;
  provider?: string | null;
  mode?: string | null;
  storyBible?: string | null;
  sourceKind?: "self" | "family_or_friend" | "synthetic" | "mixed";
  referenceSummary?: string | null;
  bypassCompiler?: boolean;
  bypassReason?: "admin_debug" | "replay_compiled" | "provider_test";
}
