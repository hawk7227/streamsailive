import { recordBuilderSystemEvent } from "@/lib/streams-builder/system-events";

export type StreamsBuilderMode =
  | "conversation"
  | "inspect"
  | "build"
  | "repair"
  | "visual-edit"
  | "safety-intervention";

export type StreamsBuilderTool = {
  name: string;
  category: string;
  modes: StreamsBuilderMode[];
  risk: "safe" | "caution" | "approval" | "blocked";
  requiresApproval: boolean;
  available: boolean;
  description: string;
};

export type StreamsBuilderLayer = {
  layerId?: string;
  kind?: string;
  selector?: string;
  sourceFile?: string;
  startLine?: number;
  endLine?: number;
  childLayerCount?: number;
  text?: string;
  src?: string;
};

export type StreamsBuilderOrchestratorInput = {
  sessionId?: string;
  userPrompt?: string;
  requestedAction?: string;
  repo?: string;
  branch?: string;
  route?: string;
  filePath?: string;
  selectedLayer?: StreamsBuilderLayer;
  safetyAlert?: { reason?: string; recommendations?: unknown[] } | null;
  buildError?: string;
  approvalGranted?: boolean;
};

const TOOLS: StreamsBuilderTool[] = [
  { name: "conversation.free_flow", category: "chat", modes: ["conversation", "inspect", "build", "repair", "visual-edit", "safety-intervention"], risk: "safe", requiresApproval: false, available: true, description: "Keep natural chat active while detecting whether action is needed." },
  { name: "router.mode_selector", category: "orchestrator", modes: ["conversation", "inspect", "build", "repair", "visual-edit", "safety-intervention"], risk: "safe", requiresApproval: false, available: true, description: "Choose conversation, inspect, build, repair, visual-edit, or safety mode." },
  { name: "tools.registry", category: "orchestrator", modes: ["conversation", "inspect", "build", "repair", "visual-edit", "safety-intervention"], risk: "safe", requiresApproval: false, available: true, description: "Expose available tools, risk level, and approval requirements." },
  { name: "visual.universal_layer_mapper", category: "visual", modes: ["inspect", "visual-edit", "safety-intervention"], risk: "safe", requiresApproval: false, available: true, description: "Use the existing visual editor bridge as the frontend layer foundation." },
  { name: "visual.source_range_resolver", category: "visual", modes: ["build", "repair", "visual-edit", "safety-intervention"], risk: "caution", requiresApproval: false, available: true, description: "Require exact source file and range before scoped edits." },
  { name: "safety.recommendations", category: "safety", modes: ["build", "repair", "visual-edit", "safety-intervention"], risk: "safe", requiresApproval: false, available: true, description: "Block unclear actions and recommend safer child, parent, group, or section scopes." },
  { name: "chat.intervention", category: "safety", modes: ["safety-intervention"], risk: "safe", requiresApproval: false, available: true, description: "Alert chat when the editor detects unsafe or unclear action scope." },
  { name: "repository.scoped_patch", category: "build", modes: ["build", "repair", "visual-edit"], risk: "approval", requiresApproval: true, available: true, description: "Apply only approved, smallest-scope source patches." },
  { name: "validation.build_test", category: "validation", modes: ["build", "repair"], risk: "caution", requiresApproval: false, available: true, description: "Validate with build/test and feed errors back into the same orchestrator loop." },
  { name: "trace.observability", category: "trace", modes: ["conversation", "inspect", "build", "repair", "visual-edit", "safety-intervention"], risk: "safe", requiresApproval: false, available: true, description: "Record mode, tool, safety, patch, validation, and rollback events." },
  { name: "validation.rollback", category: "validation", modes: ["build", "repair", "visual-edit"], risk: "safe", requiresApproval: false, available: true, description: "Keep previous file SHA/commit and provide a focused rollback path." },
];

function text(value?: string) {
  return String(value || "").toLowerCase();
}

export function resolveStreamsBuilderMode(input: StreamsBuilderOrchestratorInput): StreamsBuilderMode {
  const prompt = text(input.userPrompt);
  const action = text(input.requestedAction);
  if (input.safetyAlert || /unsafe|blocked|wrong layer|wrong source|risk/.test(prompt)) return "safety-intervention";
  if (input.selectedLayer || /visual editor|selected layer|frontend|replace image|delete image|parent|child|section mode/.test(prompt)) return "visual-edit";
  if (input.buildError || /failed|error|broken|repair|troubleshoot|vercel failed|build failed/.test(prompt)) return "repair";
  if (/build|fix|update|change|remove|delete|add|wire|implement|patch|commit|push/.test(prompt) || /build|fix|update|change|remove|delete|add|wire|implement|patch|commit|push/.test(action)) return "build";
  if (/find|look|locate|inspect|review|analyze|where|how many|search/.test(prompt) || /inspect|read|search/.test(action)) return "inspect";
  return "conversation";
}

export function getStreamsBuilderToolRegistry() {
  return TOOLS;
}

export function getStreamsBuilderToolsForMode(mode: StreamsBuilderMode) {
  return TOOLS.filter((tool) => tool.available && tool.modes.includes(mode));
}

export function evaluateStreamsBuilderSafety(input: StreamsBuilderOrchestratorInput, mode = resolveStreamsBuilderMode(input)) {
  const layer = input.selectedLayer;
  const action = text(input.requestedAction || input.userPrompt);
  const childCount = Number(layer?.childLayerCount || 0);
  const kind = text(layer?.kind);
  const hasSourceRange = Boolean(layer?.sourceFile && layer?.startLine && layer?.endLine);

  if (mode === "conversation" || mode === "inspect") {
    return { safe: true, risk: "safe" as const, reason: "Read-only or conversational mode.", recommendations: ["Do not write files", "Report findings only"], requiresChat: false, requiresApproval: false };
  }

  if (input.safetyAlert) {
    return { safe: false, risk: "blocked" as const, reason: String(input.safetyAlert.reason || "Visual editor raised a safety alert."), recommendations: Array.isArray(input.safetyAlert.recommendations) ? input.safetyAlert.recommendations.map(String) : ["Select exact child layer", "Use Parent/Child controls", "Confirm scope with chat"], requiresChat: true, requiresApproval: true };
  }

  if ((action.includes("delete") || action.includes("remove") || action.includes("replace")) && childCount > 0 && !input.approvalGranted) {
    return { safe: false, risk: "approval" as const, reason: "Selected layer contains child layers, so the action may affect more than one visible item.", recommendations: ["Select exact child item", "Move up only for confirmed group/section edits", "Ask chat to list child layers"], requiresChat: true, requiresApproval: true };
  }

  if (action.includes("replace") && kind && !["image", "background-image"].includes(kind)) {
    return { safe: false, risk: "blocked" as const, reason: "Replace image requires exact image or background-image layer.", recommendations: ["Select image child", "Select background-image layer", "Do not replace a parent/video/source layer"], requiresChat: true, requiresApproval: true };
  }

  if (["build", "repair", "visual-edit"].includes(mode) && layer && !hasSourceRange) {
    return { safe: false, risk: "caution" as const, reason: "Selected visual layer needs exact source range resolution before source mutation.", recommendations: ["Run source range resolver", "Inspect source before patch", "Block direct mutation until mapping is clean"], requiresChat: true, requiresApproval: false };
  }

  return { safe: true, risk: "caution" as const, reason: "Action can proceed through scoped tools.", recommendations: ["Use smallest scoped patch", "Validate after change", "Record trace event"], requiresChat: false, requiresApproval: ["build", "repair", "visual-edit"].includes(mode) };
}

export function createStreamsBuilderPlan(input: StreamsBuilderOrchestratorInput) {
  const mode = resolveStreamsBuilderMode(input);
  const tools = getStreamsBuilderToolsForMode(mode);
  const safety = evaluateStreamsBuilderSafety(input, mode);
  const validationRequired = ["build", "repair", "visual-edit"].includes(mode);

  return {
    ok: safety.safe || safety.risk === "caution",
    mode,
    intent: input.requestedAction || input.userPrompt || "continue",
    oneBrainRule: "OpenAI orchestrator remains the only planner/controller. Tools execute and report; tools do not become separate brains.",
    tools,
    safety,
    steps: mode === "safety-intervention"
      ? ["Block action", "Alert chat", "Explain risk", "Recommend safe scopes", "Wait for user-approved scope"]
      : mode === "inspect"
        ? ["Search/read files", "Map relevant structure", "Report only", "Do not write"]
        : mode === "conversation"
          ? ["Keep free-flowing conversation", "Switch modes only when intent requires it"]
          : ["Inspect current state", "Resolve exact scope", "Check safety", "Apply smallest approved action", "Validate", "Trace result"],
    validation: {
      required: validationRequired,
      checks: validationRequired ? ["scope matches selected layer", "no unrelated files touched", "build/test captured", "rollback available"] : ["no write action performed"],
      rollback: validationRequired ? ["keep previous commit/file SHA", "store patch diff", "revert only changed files if needed"] : ["not needed"],
    },
    chatIntervention: {
      shouldIntervene: safety.requiresChat,
      message: safety.requiresChat ? `Paused: ${safety.reason}` : "No chat intervention required.",
      options: safety.recommendations,
    },
  };
}

export async function traceStreamsBuilderPlan(input: StreamsBuilderOrchestratorInput) {
  const plan = createStreamsBuilderPlan(input);
  const sessionId = input.sessionId || "agent-1";
  await recordBuilderSystemEvent({ sessionId, phase: "orchestrator.mode.selected", source: "streams-builder-orchestrator", severity: "info", message: `Mode selected: ${plan.mode}`, repo: input.repo, branch: input.branch, filePath: input.filePath || input.selectedLayer?.sourceFile, route: input.route, status: plan.mode, metadata: { intent: plan.intent } });
  await recordBuilderSystemEvent({ sessionId, phase: "orchestrator.tools.selected", source: "streams-builder-orchestrator", severity: "info", message: `${plan.tools.length} tools selected.`, repo: input.repo, branch: input.branch, filePath: input.filePath || input.selectedLayer?.sourceFile, route: input.route, status: plan.mode, metadata: { tools: plan.tools.map((tool) => tool.name) } });
  await recordBuilderSystemEvent({ sessionId, phase: "orchestrator.safety.checked", source: "streams-builder-orchestrator", severity: plan.safety.safe ? "info" : plan.safety.risk === "blocked" ? "error" : "warning", message: plan.safety.reason, repo: input.repo, branch: input.branch, filePath: input.filePath || input.selectedLayer?.sourceFile, route: input.route, status: plan.safety.risk, metadata: { recommendations: plan.safety.recommendations, selectedLayer: input.selectedLayer } });
  return plan;
}
