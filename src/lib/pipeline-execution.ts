
import crypto from "crypto";
import { generateContent } from '@/lib/ai';
import { GenerationType } from '@/lib/ai/types';

type PipelineNiche = "telehealth" | "ecommerce";
type AutomationMode =
  | "manual_mode"
  | "hybrid_mode"
  | "full_ai_ideas"
  | "full_ai_ideas_with_rules"
  | "full_auto_production";

type OutputMode =
  | "static_image"
  | "video"
  | "image_to_video"
  | "image_and_video"
  | "full_campaign_pack";

type RiskLevel = "low" | "medium" | "high";

type MotionPlanV2 = {
  shouldUseImageToVideo: boolean;
  reason: string;
  perception: {
    sceneType: string;
    subjects: Array<{
      type: string;
      category?: string;
      face?: boolean;
      pose?: string;
      emotion?: string;
    }>;
    composition: {
      focalPoint: string;
      depth: string;
      negativeSpace: string;
    };
    lighting: {
      type: string;
      direction: string;
      contrast: string;
    };
    regions: {
      productPresent: boolean;
      textPresent: boolean;
      ctaZonePresent: boolean;
      logoPresent: boolean;
      devicePresent: boolean;
      facePresent: boolean;
      handsPresent: boolean;
    };
    riskProfile: {
      faceDistortionRisk: RiskLevel;
      artifactRisk: RiskLevel;
      objectIntegrityRisk: RiskLevel;
      motionRisk: RiskLevel;
    };
  };
  intent: {
    goal: string;
    format: string;
    platform: string;
    audience: string;
  };
  strategy: {
    hookType: string;
    pacing: string;
    motionStyle: string;
    visualHierarchy: string[];
    attentionCurve: Array<{ t: number; intensity: number }>;
  };
  constraints: {
    face: {
      mustPreserveIdentity: boolean;
      maxWarp: number;
      noMorphing: boolean;
    };
    product: {
      mustMaintainShape: boolean;
      noScalingDistortion: boolean;
    };
    text: {
      noGeneration: boolean;
      preserveOriginal: boolean;
    };
    motion: {
      maxSpeed: number;
      maxCameraShift: number;
      avoidJitter: boolean;
    };
  };
  cameraSystem: {
    shotType: string;
    movement: string;
    lens: string;
    stabilization: string;
    depthEffect: string;
  };
  timeline: {
    camera: Array<{ t: number; action: string }>;
    subject: Array<{ t: number; action: string }>;
    overlays: Array<{ t: number; action: string }>;
  };
  validation: {
    passes: string[];
    warnings: string[];
    autoFixes: string[];
  };
  feedback: {
    performanceScore: number | null;
    userApproval: boolean | null;
    issues: string[];
    improvements: string[];
  };
  modeBehavior: {
    activeMode: AutomationMode;
    behavior: string;
  };
  governanceApplied: {
    niche: PipelineNiche;
    outputMode: OutputMode;
    governanceExcerpt: string;
  };
};

const replaceVariables = (text: string, context: any) => {
  if (!text) return "";
  if (typeof text !== "string") return text;
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
    const parts = path.split(".");
    let current = context;
    for (const part of parts) {
      if (current === undefined || current === null) return match;
      current = current[part];
    }
    return current !== undefined ? String(current) : match;
  });
};

function normalizeString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getGovernance(data: Record<string, any>) {
  const governance = data?.governance || {};
  return {
    pipelineType: (governance.pipelineType || data.pipelineType || "telehealth") as PipelineNiche,
    imageToVideo: normalizeString(governance.imageToVideo),
    strategyPrompt: normalizeString(governance.strategyPrompt),
    copyPrompt: normalizeString(governance.copyPrompt),
    validatorPrompt: normalizeString(governance.validatorPrompt),
    imagePrompt: normalizeString(governance.imagePrompt),
    templatePrompt: normalizeString(governance.templatePrompt),
    qaInstruction: normalizeString(governance.qaInstruction),
    approvedFacts: normalizeString(governance.approvedFacts),
    brandTone: normalizeString(governance.brandTone),
    styleGuide: normalizeString(governance.styleGuide),
    bannedPhrases: normalizeString(governance.bannedPhrases),
  };
}

function detectSceneType(input: string): string {
  const s = input.toLowerCase();
  if (/comparison|versus|vs\./.test(s)) return "comparison";
  if (/ui|dashboard|screen|interface/.test(s)) return "ui";
  if (/product|bottle|package|box|jar|supplement/.test(s)) return "product";
  if (/portrait|face|woman|man|person|doctor|patient/.test(s)) return "portrait";
  if (/bedroom|kitchen|living room|routine|lifestyle|home/.test(s)) return "lifestyle";
  return "unknown";
}

function buildPerception(input: string, niche: PipelineNiche): MotionPlanV2["perception"] {
  const s = input.toLowerCase();
  const facePresent = /face|woman|man|person|doctor|patient/.test(s);
  const productPresent = /product|bottle|package|box|jar|supplement/.test(s);
  const devicePresent = /phone|smartphone|laptop|screen|tablet/.test(s);
  const textPresent = /headline|cta|text|copy|button|shop now|start your visit/.test(s);
  const handsPresent = /hand|holding|grip/.test(s);

  return {
    sceneType: detectSceneType(input),
    subjects: [
      ...(facePresent
        ? [{
            type: "human",
            category: niche === "telehealth" ? "patient_or_provider" : "model",
            face: true,
            pose: "frontal",
            emotion: "neutral",
          }]
        : []),
      ...(productPresent ? [{ type: "object", category: "product" }] : []),
      ...(devicePresent ? [{ type: "device", category: "phone_or_screen" }] : []),
    ],
    composition: {
      focalPoint: /left/.test(s) ? "left" : /right/.test(s) ? "right" : "center",
      depth: /deep|depth|background blur|50mm|85mm/.test(s) ? "deep" : /flat/.test(s) ? "flat" : "shallow",
      negativeSpace: /left space/.test(s)
        ? "left"
        : /right space/.test(s)
        ? "right"
        : textPresent
        ? "left"
        : "none",
    },
    lighting: {
      type: /studio/.test(s) ? "studio" : /natural/.test(s) ? "natural" : "mixed",
      direction: /side light|side-lit/.test(s) ? "side" : /backlit/.test(s) ? "back" : "front",
      contrast: /soft/.test(s) ? "low" : /high contrast/.test(s) ? "high" : "medium",
    },
    regions: {
      productPresent,
      textPresent,
      ctaZonePresent: /cta|button|shop now|start your visit/.test(s),
      logoPresent: /logo/.test(s),
      devicePresent,
      facePresent,
      handsPresent,
    },
    riskProfile: {
      faceDistortionRisk: facePresent ? "medium" : "low",
      artifactRisk: /crowded|cluttered|busy/.test(s) ? "high" : "medium",
      objectIntegrityRisk: productPresent || devicePresent ? "medium" : "low",
      motionRisk: /cluttered|busy|multiple people/.test(s) ? "high" : facePresent ? "medium" : "low",
    },
  };
}

function buildIntent(niche: PipelineNiche, outputMode: OutputMode): MotionPlanV2["intent"] {
  return {
    goal: "conversion",
    format: outputMode === "full_campaign_pack" ? "explainer" : "ad",
    platform: outputMode === "video" || outputMode === "image_to_video" ? "meta" : "general",
    audience: niche === "telehealth" ? "warm" : "cold",
  };
}

function buildStrategy(
  niche: PipelineNiche,
  perception: MotionPlanV2["perception"],
  intent: MotionPlanV2["intent"]
): MotionPlanV2["strategy"] {
  const trustFirst = niche === "telehealth";
  return {
    hookType: trustFirst ? "trust" : perception.regions.productPresent ? "benefit" : "clarity",
    pacing: trustFirst ? "slow" : intent.audience === "cold" ? "moderate" : "fast",
    motionStyle: trustFirst ? "minimal" : perception.regions.productPresent ? "cinematic" : "minimal",
    visualHierarchy: trustFirst
      ? ["primary_subject", "supporting_context", "cta"]
      : perception.regions.productPresent
      ? ["product", "supporting_context", "cta"]
      : ["primary_subject", "cta"],
    attentionCurve: trustFirst
      ? [
          { t: 0, intensity: 0.6 },
          { t: 1, intensity: 0.75 },
          { t: 2, intensity: 0.8 },
        ]
      : [
          { t: 0, intensity: 0.85 },
          { t: 1, intensity: 0.8 },
          { t: 2, intensity: 0.9 },
        ],
  };
}

function buildConstraints(niche: PipelineNiche): MotionPlanV2["constraints"] {
  return {
    face: {
      mustPreserveIdentity: true,
      maxWarp: niche === "telehealth" ? 0.01 : 0.02,
      noMorphing: true,
    },
    product: {
      mustMaintainShape: true,
      noScalingDistortion: true,
    },
    text: {
      noGeneration: true,
      preserveOriginal: true,
    },
    motion: {
      maxSpeed: niche === "telehealth" ? 0.45 : 0.7,
      maxCameraShift: niche === "telehealth" ? 10 : 18,
      avoidJitter: true,
    },
  };
}

function buildCameraSystem(
  niche: PipelineNiche,
  perception: MotionPlanV2["perception"]
): MotionPlanV2["cameraSystem"] {
  if (niche === "telehealth") {
    return {
      shotType: "medium",
      movement: "dolly_in",
      lens: "50mm",
      stabilization: "locked",
      depthEffect: perception.composition.depth === "deep" ? "parallax" : "none",
    };
  }

  if (perception.regions.productPresent) {
    return {
      shotType: "close_up",
      movement: "dolly_in",
      lens: "85mm",
      stabilization: "stabilized",
      depthEffect: "layered",
    };
  }

  return {
    shotType: "medium",
    movement: "parallax",
    lens: "50mm",
    stabilization: "stabilized",
    depthEffect: "parallax",
  };
}

function buildTimeline(
  niche: PipelineNiche,
  perception: MotionPlanV2["perception"]
): MotionPlanV2["timeline"] {
  if (niche === "telehealth") {
    return {
      camera: [
        { t: 0, action: "dolly_in_start" },
        { t: 2.8, action: "dolly_in_end" },
      ],
      subject: [
        { t: 0.8, action: "micro_expression" },
        { t: 1.4, action: perception.regions.devicePresent ? "phone_adjustment" : "gaze_shift" },
      ],
      overlays: [
        { t: 1.8, action: "headline_focus" },
        { t: 2.2, action: "cta_focus" },
      ],
    };
  }

  return {
    camera: [
      { t: 0, action: perception.regions.productPresent ? "macro_reveal_start" : "dolly_in_start" },
      { t: 2.6, action: perception.regions.productPresent ? "macro_reveal_end" : "dolly_in_end" },
    ],
    subject: [
      { t: 0.8, action: perception.regions.productPresent ? "product_focus" : "subject_emphasis" },
    ],
    overlays: [
      { t: 1.6, action: "headline_focus" },
      { t: 2.6, action: "cta_focus" },
    ],
  };
}

function buildValidation(
  perception: MotionPlanV2["perception"],
  constraints: MotionPlanV2["constraints"]
): MotionPlanV2["validation"] {
  const passes: string[] = ["composition_preserved", "text_generation_blocked"];
  const warnings: string[] = [];
  const autoFixes: string[] = [];

  if (perception.riskProfile.faceDistortionRisk === "high") {
    warnings.push("high_face_distortion_risk");
    autoFixes.push("switch_to_static_camera");
    autoFixes.push("reduce_motion_intensity");
  }

  if (perception.riskProfile.motionRisk === "high") {
    warnings.push("high_motion_risk");
    autoFixes.push("reduce_camera_shift");
  }

  if (constraints.motion.avoidJitter) passes.push("jitter_avoidance_enabled");
  if (perception.regions.facePresent) passes.push("face_integrity_checks_enabled");
  if (perception.regions.productPresent || perception.regions.devicePresent) {
    passes.push("object_integrity_checks_enabled");
  }

  return { passes, warnings, autoFixes };
}

function modeBehavior(mode: AutomationMode): string {
  switch (mode) {
    case "manual_mode":
      return "User approves every motion and camera decision.";
    case "hybrid_mode":
      return "AI proposes motion plan, pauses at key checkpoints.";
    case "full_ai_ideas":
      return "AI explores broader motion ideas with lighter constraints.";
    case "full_ai_ideas_with_rules":
      return "AI uses governed motion logic with hard safeguards.";
    case "full_auto_production":
      return "AI executes the full motion pipeline automatically with fallbacks.";
    default:
      return "Governed execution.";
  }
}

function shouldApplyImageToVideo(
  perception: MotionPlanV2["perception"],
  niche: PipelineNiche
): { ok: boolean; reason: string } {
  if (perception.riskProfile.motionRisk === "high") {
    return { ok: false, reason: "Scene is too cluttered or unstable for safe motion." };
  }
  if (
    niche === "telehealth" &&
    perception.regions.facePresent &&
    perception.riskProfile.faceDistortionRisk === "high"
  ) {
    return { ok: false, reason: "Face risk too high for trust-preserving telehealth motion." };
  }
  if (perception.composition.negativeSpace === "none" && !perception.regions.productPresent) {
    return { ok: false, reason: "Weak composition or unclear overlay zone for motion-led output." };
  }
  return { ok: true, reason: "Image is suitable for governed image-to-video planning." };
}

function buildImageToVideoMotionPlan(params: {
  imageInput: string;
  niche: PipelineNiche;
  outputMode: OutputMode;
  automationMode: AutomationMode;
  governanceText: string;
}): MotionPlanV2 {
  const perception = buildPerception(params.imageInput, params.niche);
  const intent = buildIntent(params.niche, params.outputMode);
  const strategy = buildStrategy(params.niche, perception, intent);
  const constraints = buildConstraints(params.niche);
  const cameraSystem = buildCameraSystem(params.niche, perception);
  const timeline = buildTimeline(params.niche, perception);
  const validation = buildValidation(perception, constraints);
  const usage = shouldApplyImageToVideo(perception, params.niche);

  return {
    shouldUseImageToVideo: usage.ok,
    reason: usage.reason,
    perception,
    intent,
    strategy,
    constraints,
    cameraSystem,
    timeline,
    validation,
    feedback: {
      performanceScore: null,
      userApproval: null,
      issues: [],
      improvements: [],
    },
    modeBehavior: {
      activeMode: params.automationMode,
      behavior: modeBehavior(params.automationMode),
    },
    governanceApplied: {
      niche: params.niche,
      outputMode: params.outputMode,
      governanceExcerpt: params.governanceText.slice(0, 800),
    },
  };
}

export async function executeNode(node: any, context: any) {
  const type = (node.type === "pipelineNode" ? node.data?.type : node.type) || "unknown";
  const data = node.data || {};

  let output: any = {};
  const generationId = crypto.randomUUID();

  await new Promise((resolve) => setTimeout(resolve, 300));
