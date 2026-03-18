import crypto from "crypto";
import { generateContent } from "@/lib/ai";
import { GenerationType } from "@/lib/ai/types";

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

const normalizeString = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getGovernance = (data: Record<string, any>) => {
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
};

const detectSceneType = (input: string): string => {
  const s = input.toLowerCase();
  if (/comparison|versus|vs\./.test(s)) return "comparison";
  if (/ui|dashboard|screen|interface/.test(s)) return "ui";
  if (/product|bottle|package|box|jar|supplement/.test(s)) return "product";
  if (/portrait|face|woman|man|person|doctor|patient/.test(s)) return "portrait";
  if (/bedroom|kitchen|living room|routine|lifestyle|home/.test(s)) return "lifestyle";
  return "unknown";
};

const buildPerception = (input: string, niche: PipelineNiche): MotionPlanV2["perception"] => {
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
};

const buildIntent = (niche: PipelineNiche, outputMode: OutputMode): MotionPlanV2["intent"] => ({
  goal: "conversion",
  format: outputMode === "full_campaign_pack" ? "explainer" : "ad",
  platform: outputMode === "video" || outputMode === "image_to_video" ? "meta" : "general",
  audience: niche === "telehealth" ? "warm" : "cold",
});

const buildStrategy = (
  niche: PipelineNiche,
  perception: MotionPlanV2["perception"],
  intent: MotionPlanV2["intent"]
): MotionPlanV2["strategy"] => {
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
};

const buildConstraints = (niche: PipelineNiche): MotionPlanV2["constraints"] => ({
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
});

const buildCameraSystem = (
  niche: PipelineNiche,
  perception: MotionPlanV2["perception"]
): MotionPlanV2["cameraSystem"] => {
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
};

const buildTimeline = (
  niche: PipelineNiche,
  perception: MotionPlanV2["perception"]
): MotionPlanV2["timeline"] => {
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
};

const buildValidation = (
  perception: MotionPlanV2["perception"],
  constraints: MotionPlanV2["constraints"]
): MotionPlanV2["validation"] => {
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
};

const describeModeBehavior = (mode: AutomationMode): string => {
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
};

const shouldApplyImageToVideo = (
  perception: MotionPlanV2["perception"],
  niche: PipelineNiche
): { ok: boolean; reason: string } => {
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
};

const buildImageToVideoMotionPlan = (params: {
  imageInput: string;
  niche: PipelineNiche;
  outputMode: OutputMode;
  automationMode: AutomationMode;
  governanceText: string;
}): MotionPlanV2 => {
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
      behavior: describeModeBehavior(params.automationMode),
    },
    governanceApplied: {
      niche: params.niche,
      outputMode: params.outputMode,
      governanceExcerpt: params.governanceText.slice(0, 800),
    },
  };
};

export async function executeNode(node: any, context: any) {
  const type = (node.type === "pipelineNode" ? node.data?.type : node.type) || "unknown";
  const data = node.data || {};
  const generationId = crypto.randomUUID();

  if (type === "scriptWriter") {
    const prompt = replaceVariables(data.content || "", context);
    const output = await generateContent("script" as GenerationType, prompt, {
      niche: data?.governance?.pipelineType || data?.pipelineType || "telehealth",
    });

    return {
      success: true,
      output,
      generationId,
    };
  }

  if (type === "imageGenerator") {
    const prompt = replaceVariables(data.content || "", context);
    const output = await generateContent("image" as GenerationType, prompt, {
      aspectRatio: data.aspectRatio || "16:9",
      niche: data?.governance?.pipelineType || data?.pipelineType || "telehealth",
      imageMode: data?.imageMode || data?.governance?.imageMode,
    });

    return {
      success: true,
      output,
      generationId,
    };
  }

  if (type === "imageMotionAnalyzer") {
    const governance = getGovernance(data);

    const imageInput =
      normalizeString(context?.image_motion_source) ||
      normalizeString(context?.image_generator) ||
      normalizeString(context?.image) ||
      normalizeString(context?.image_output) ||
      normalizeString(data?.content);

    const outputMode = (data?.outputMode || "image_to_video") as OutputMode;
    const automationMode = (data?.automationMode || "full_ai_ideas_with_rules") as AutomationMode;

    const motionPlan = buildImageToVideoMotionPlan({
      imageInput,
      niche: governance.pipelineType,
      outputMode,
      automationMode,
      governanceText: governance.imageToVideo,
    });

    return {
      success: true,
      output: motionPlan,
      generationId,
    };
  }

  if (type === "videoGenerator") {
    const governance = getGovernance(data);

    const motionPlan =
      data.motionPlan ||
      context?.motion_plan ||
      context?.image_motion_analysis ||
      null;

    const motionSource = data.motionSource || "auto";
    const motionIntensity = data.motionIntensity || "controlled";
    const timelinePreference = data.timelinePreference || "governed";

    const basePrompt = replaceVariables(data.content || "", context);

   resolvedMotionPlan?.validation?.warnings?.includes(...)
   resolvedMotionPlan?.perception?.riskProfile?.motionRisk
   resolvedMotionPlan?.shouldUseImageToVideo === false
    const unsafeForMotion =
      resolvedMotionPlan?.validation?.warnings?.includes?.("high_face_distortion_risk") ||
      resolvedMotionPlan?.perception?.riskProfile?.motionRisk === "high" ||
      resolvedMotionPlan?.shouldUseImageToVideo === false;

    const finalCameraSystem = unsafeForMotion
      ? {
          shotType: "medium",
          movement: "static",
          lens: "50mm",
          stabilization: "locked",
          depthEffect: "none",
        }
      : resolvedMotionPlan?.cameraSystem || {
          shotType: "medium",
          movement: "dolly_in",
          lens: "50mm",
          stabilization: "locked",
          depthEffect: "none",
        };

    const finalTimeline = unsafeForMotion
      ? {
          camera: [
            { t: 0, action: "static_hold_start" },
            { t: 2.4, action: "static_hold_end" },
          ],
          subject: [],
          overlays: [
            { t: 1.4, action: "headline_focus" },
            { t: 2.0, action: "cta_focus" },
          ],
        }
      : resolvedMotionPlan?.timeline || {
          camera: [{ t: 0, action: "dolly_in_start" }],
          subject: [{ t: 1.0, action: "subject_emphasis" }],
          overlays: [{ t: 2.0, action: "cta_focus" }],
        };

    const providerInstruction = [
      basePrompt,
      "",
      `Pipeline type: ${governance.pipelineType}`,
      `Motion source: ${motionSource}`,
      `Motion intensity: ${motionIntensity}`,
      `Timeline preference: ${timelinePreference}`,
      `Camera system: ${JSON.stringify(finalCameraSystem)}`,
      `Timeline: ${JSON.stringify(finalTimeline)}`,
      `Fallback used: ${unsafeForMotion ? "yes" : "no"}`,
      unsafeForMotion ? `Fallback reason: ${resolvedMotionPlan?.reason || "Unsafe motion conditions detected."}` : "",
      resolvedMotionPlan?.strategy ? `Strategy: ${JSON.stringify(resolvedMotionPlan.strategy)}` : "",
      resolvedMotionPlan?.constraints ? `Constraints: ${JSON.stringify(resolvedMotionPlan.constraints)}` : "",
      governance.imageToVideo ? `Image-to-video governance: ${governance.imageToVideo}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const output = await generateContent("video" as GenerationType, providerInstruction, {
      duration: data.duration || 4,
      quality: data.quality || "1080p",
      niche: governance.pipelineType,
      motionPlan: resolvedMotionPlan,
      cameraSystem: finalCameraSystem,
      timeline: finalTimeline,
      unsafeForMotion,
    });

    return {
      success: true,
      output: {
        ...output,
        providerReadyInstruction: {
          mode: data.outputMode || "video",
          motionPlanAvailable: !!resolvedMotionPlan,
          motionSource,
          motionIntensity,
          timelinePreference,
          cameraSystem: finalCameraSystem,
          timeline: finalTimeline,
          fallbackUsed: unsafeForMotion,
          fallbackReason: unsafeForMotion
            ? resolvedMotionPlan?.reason || "Unsafe motion conditions detected."
            : null,
        },
      },
      generationId,
    };
  }

  if (type === "voiceGenerator") {
    const prompt = replaceVariables(data.content || "", context);
    const output = await generateContent("voice" as GenerationType, prompt, {
      speaker: data.speaker || "Rachel",
      niche: data?.governance?.pipelineType || data?.pipelineType || "telehealth",
    });

    return {
      success: true,
      output,
      generationId,
    };
  }

  if (type === "httpRequest") {
    const url = replaceVariables(data.url || "", context);
    const method = data.method || "GET";

    let headers: Record<string, string> = {};
    if (data.headers) {
      try {
        headers = typeof data.headers === "string" ? JSON.parse(data.headers) : data.headers;
      } catch {
        headers = {};
      }
    }

    if (data.authType === "bearer" && data.authToken) {
      headers.Authorization = `Bearer ${replaceVariables(data.authToken, context)}`;
    }
    if (data.authType === "apiKey" && data.authKey && data.authValue) {
      headers[data.authKey] = replaceVariables(data.authValue, context);
    }
    if (data.authType === "basic" && data.authUsername && data.authPassword) {
      const encoded = Buffer.from(
        `${replaceVariables(data.authUsername, context)}:${replaceVariables(data.authPassword, context)}`
      ).toString("base64");
      headers.Authorization = `Basic ${encoded}`;
    }

    let body: string | undefined;
    if (method !== "GET" && method !== "DELETE") {
      if (data.bodyMode === "fields" && Array.isArray(data.bodyFields)) {
        const obj: Record<string, string> = {};
        for (const field of data.bodyFields) {
          if (field?.key) obj[field.key] = replaceVariables(field.value || "", context);
        }
        body = JSON.stringify(obj);
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
      } else if (data.body) {
        body = replaceVariables(data.body, context);
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body,
    });

    let output: any;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      output = await res.json();
    } else {
      output = await res.text();
    }

    return {
      success: res.ok,
      output,
      generationId,
    };
  }

  if (type === "zapierWebhook") {
    const webhookUrl = replaceVariables(data.webhookUrl || "", context);

    const payload: Record<string, any> = {};
    if (Array.isArray(data.bodyFields)) {
      for (const field of data.bodyFields) {
        if (field?.key) payload[field.key] = replaceVariables(field.value || "", context);
      }
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    return {
      success: res.ok,
      output: {
        status: res.status,
        body: text,
        payload,
      },
      generationId,
    };
  }

  if (type === "webhookResponse") {
    let output: any = null;

    if (data.bodyMode === "fields" && Array.isArray(data.bodyFields)) {
      const body: Record<string, any> = {};
      for (const field of data.bodyFields) {
        if (field?.key) body[field.key] = replaceVariables(field.value || "", context);
      }
      output = body;
    } else {
      output = replaceVariables(data.output || "", context);
      try {
        output = JSON.parse(output);
      } catch {
        // leave as string
      }
    }

    return {
      success: true,
      output,
      generationId,
    };
  }

  if (type === "schedule") {
    return {
      success: true,
      output: {
        scheduleType: data.scheduleType || "hourly",
        cron: data.cron || data.interval || "0 * * * *",
        content: data.content || "Scheduled pipeline trigger",
      },
      generationId,
    };
  }

  if (type === "webhook") {
    return {
      success: true,
      output: {
        status: "listening",
        method: data.method || "POST",
      },
      generationId,
    };
  }

  if (type === "imageEditor" || type === "videoEditor") {
    return {
      success: true,
      output: data.output || {
        editorType: type,
        status: "ready",
      },
      generationId,
    };
  }

  return {
    success: false,
    error: `Unsupported node type: ${type}`,
    generationId,
  };
}

export async function executePipeline(nodes: any[], edges: any[]) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const results = new Map<string, any>();

  const incomingCount = new Map<string, number>();
  for (const node of nodes) incomingCount.set(node.id, 0);
  for (const edge of edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  }

  const queue = nodes.filter((node) => (incomingCount.get(node.id) || 0) === 0);

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (!currentNode) continue;

    const context: Record<string, any> = {};
    for (const [nodeId, result] of results.entries()) {
      const sourceNode = nodeMap.get(nodeId);
      if (sourceNode?.data?.label) {
        const key = sourceNode.data.label.toLowerCase().replace(/\s+/g, "_");
        context[key] = result;
      }
    }

    const execution = await executeNode(currentNode, context);
    results.set(currentNode.id, execution.output);

    const outgoing = edges.filter((edge) => edge.source === currentNode.id);
    for (const edge of outgoing) {
      const nextCount = (incomingCount.get(edge.target) || 0) - 1;
      incomingCount.set(edge.target, nextCount);
      if (nextCount === 0) {
        const nextNode = nodeMap.get(edge.target);
        if (nextNode) queue.push(nextNode);
      }
    }
  }

  return Object.fromEntries(results.entries());
}
