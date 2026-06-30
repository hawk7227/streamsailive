export type UniversalAssistantMode =
  | "conversation"
  | "question-answering"
  | "reasoning"
  | "writing"
  | "rewriting"
  | "summarization"
  | "translation"
  | "file-analysis"
  | "image-analysis"
  | "coding-help"
  | "inspect"
  | "build"
  | "repair"
  | "visual-edit"
  | "generation"
  | "research-tool-mode"
  | "safety-intervention"
  | "workflow-automation";

export type UniversalCapabilityRisk = "safe" | "caution" | "approval-required" | "blocked";
export type UniversalCapabilityAccess = "read" | "write" | "generate" | "validate" | "deploy" | "report";

export type UniversalCapability = {
  id: string;
  displayName: string;
  category:
    | "chat"
    | "files"
    | "images"
    | "code"
    | "repo"
    | "visual"
    | "build-repair"
    | "deployment"
    | "generation"
    | "data-backend"
    | "memory-context"
    | "future";
  description: string;
  whenToUse: string;
  requiredInput: string[];
  outputShape: string;
  access: UniversalCapabilityAccess;
  risk: UniversalCapabilityRisk;
  requiresApproval: boolean;
  available: boolean;
  unavailableReason?: string;
  proofReturned: string;
  possibleRisks: string[];
  supportedModes: UniversalAssistantMode[];
  supportedScopes: string[];
  costOrTimeSensitivity?: "none" | "low" | "medium" | "high";
  scopeType: "universal" | "module-specific";
};

const ALL_CHAT_MODES: UniversalAssistantMode[] = ["conversation", "question-answering", "reasoning", "writing", "rewriting", "summarization", "translation", "coding-help", "inspect", "build", "repair", "visual-edit", "generation", "research-tool-mode", "safety-intervention", "workflow-automation"];

export const UNIVERSAL_CAPABILITY_REGISTRY: UniversalCapability[] = [
  { id: "chat.answer", displayName: "Answer normally", category: "chat", description: "Answer broad user questions like ChatGPT without forcing tool use.", whenToUse: "Use for normal questions and explanations when no external proof/action is needed.", requiredInput: ["userMessage"], outputShape: "assistant text", access: "report", risk: "safe", requiresApproval: false, available: true, proofReturned: "chat response only", possibleRisks: ["may need runtime context if user references workspace"], supportedModes: ["conversation", "question-answering", "reasoning"], supportedScopes: ["universal"], costOrTimeSensitivity: "none", scopeType: "universal" },
  { id: "chat.write", displayName: "Write or rewrite", category: "chat", description: "Draft, rewrite, summarize, translate, or structure content.", whenToUse: "Use for writing, rewriting, summarization, and translation requests.", requiredInput: ["userMessage", "sourceText optional"], outputShape: "text artifact or response", access: "report", risk: "safe", requiresApproval: false, available: true, proofReturned: "chat response only", possibleRisks: ["must preserve user-provided meaning"], supportedModes: ["writing", "rewriting", "summarization", "translation"], supportedScopes: ["universal"], costOrTimeSensitivity: "none", scopeType: "universal" },
  { id: "file.analyze", displayName: "Analyze files", category: "files", description: "Analyze uploaded or connected files when file context is present.", whenToUse: "Use when the user asks about uploaded files, documents, or file contents.", requiredInput: ["fileReference or extracted context"], outputShape: "file-grounded summary or extraction", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "file reference/context", possibleRisks: ["must not invent unavailable file content"], supportedModes: ["file-analysis", "summarization", "inspect"], supportedScopes: ["uploaded files", "connected files"], costOrTimeSensitivity: "low", scopeType: "universal" },
  { id: "image.understand", displayName: "Understand images", category: "images", description: "Analyze images and screenshots when provided.", whenToUse: "Use for screenshot/design/image questions.", requiredInput: ["image context"], outputShape: "image-grounded answer", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "visible image context", possibleRisks: ["identity and privacy limits", "must not infer unsupported facts"], supportedModes: ["image-analysis", "visual-edit", "inspect"], supportedScopes: ["uploaded images", "workspace screenshots"], costOrTimeSensitivity: "low", scopeType: "universal" },
  { id: "code.explain", displayName: "Explain/debug code", category: "code", description: "Explain, debug, or generate code without mutating repo files.", whenToUse: "Use for conceptual coding help and non-mutating snippets.", requiredInput: ["code or prompt"], outputShape: "explanation or code block", access: "report", risk: "safe", requiresApproval: false, available: true, proofReturned: "chat response only", possibleRisks: ["repo mutation must not occur without explicit build request"], supportedModes: ["coding-help", "reasoning"], supportedScopes: ["universal"], costOrTimeSensitivity: "none", scopeType: "universal" },
  { id: "repo.search", displayName: "Search repository", category: "repo", description: "Search connected repository files.", whenToUse: "Use for find/inspect/where-is questions.", requiredInput: ["repo", "query"], outputShape: "matching files and snippets", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "repo search result", possibleRisks: ["repo access may be unavailable"], supportedModes: ["inspect", "build", "repair", "coding-help"], supportedScopes: ["connected repos"], costOrTimeSensitivity: "low", scopeType: "universal" },
  { id: "repo.patch", displayName: "Patch repository", category: "repo", description: "Apply approved scoped file changes.", whenToUse: "Use only when user explicitly asks to build/fix/update and safety scope is clear.", requiredInput: ["repo", "branch", "filePath", "patch or content", "approval if risky"], outputShape: "commit/change proof", access: "write", risk: "approval-required", requiresApproval: true, available: true, proofReturned: "commit SHA or patch result", possibleRisks: ["unrelated file changes", "build failure", "unsafe source mapping"], supportedModes: ["build", "repair", "visual-edit"], supportedScopes: ["connected repos"], costOrTimeSensitivity: "medium", scopeType: "universal" },
  { id: "visual.layer_map", displayName: "Map visual layers", category: "visual", description: "Break visible page/workspace surfaces into editable layers.", whenToUse: "Use for visual editing, selected frontend content, screenshots, or UI layer questions.", requiredInput: ["route or selectedLayer"], outputShape: "layer map", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "layer payload/event", possibleRisks: ["source mapping may be unresolved"], supportedModes: ["visual-edit", "inspect", "safety-intervention"], supportedScopes: ["visual surfaces"], costOrTimeSensitivity: "low", scopeType: "module-specific" },
  { id: "visual.source_resolve", displayName: "Resolve visual source", category: "visual", description: "Resolve visual selection to exact source/action target.", whenToUse: "Use before mutating source from visual selections.", requiredInput: ["selectedLayer", "context"], outputShape: "confidence and safe scopes", access: "validate", risk: "caution", requiresApproval: false, available: true, proofReturned: "resolver confidence and target", possibleRisks: ["low confidence blocks mutation"], supportedModes: ["visual-edit", "build", "repair", "safety-intervention"], supportedScopes: ["visual layers", "source files"], costOrTimeSensitivity: "low", scopeType: "module-specific" },
  { id: "build.run", displayName: "Run build/validation", category: "build-repair", description: "Run build/test/validation when available.", whenToUse: "Use after patches or during repair diagnostics.", requiredInput: ["repo or job context"], outputShape: "build status and logs", access: "validate", risk: "caution", requiresApproval: false, available: true, proofReturned: "build event/log/status", possibleRisks: ["can take time", "may fail"], supportedModes: ["build", "repair"], supportedScopes: ["connected repos", "workspaces"], costOrTimeSensitivity: "medium", scopeType: "universal" },
  { id: "generation.start", displayName: "Start generation", category: "generation", description: "Start image, video, audio, voice, or music workflows through approved providers.", whenToUse: "Use when the user asks to generate media.", requiredInput: ["prompt", "generationType", "provider if required"], outputShape: "job/provider run/asset proof", access: "generate", risk: "approval-required", requiresApproval: true, available: true, proofReturned: "job id, provider run id, asset id/url when complete", possibleRisks: ["cost/time", "provider failure", "output not proven until asset exists"], supportedModes: ["generation"], supportedScopes: ["media modules"], costOrTimeSensitivity: "high", scopeType: "universal" },
  { id: "assets.list", displayName: "List assets", category: "data-backend", description: "Read stored generated/uploaded assets.", whenToUse: "Use when user asks about generated outputs/assets.", requiredInput: ["sessionId or projectId"], outputShape: "asset rows", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "asset rows", possibleRisks: ["asset rows may not prove provider execution alone"], supportedModes: ["inspect", "generation", "repair"], supportedScopes: ["current session", "project"], costOrTimeSensitivity: "low", scopeType: "universal" },
  { id: "jobs.list", displayName: "List jobs", category: "data-backend", description: "Read persisted job state.", whenToUse: "Use when user asks about queued/running/completed jobs.", requiredInput: ["sessionId or projectId"], outputShape: "job rows", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "job rows", possibleRisks: ["job row alone may not prove output"], supportedModes: ["inspect", "generation", "repair"], supportedScopes: ["current session", "project"], costOrTimeSensitivity: "low", scopeType: "universal" },
  { id: "provider_runs.lookup", displayName: "Lookup provider runs", category: "data-backend", description: "Read provider execution tracking rows.", whenToUse: "Use to verify provider execution proof.", requiredInput: ["jobId optional"], outputShape: "provider run rows", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "provider run rows", possibleRisks: ["placeholder rows do not prove execution"], supportedModes: ["inspect", "generation", "repair"], supportedScopes: ["job", "session"], costOrTimeSensitivity: "low", scopeType: "universal" },
  { id: "memory.runtime_events", displayName: "Read/write runtime events", category: "memory-context", description: "Record and read rich runtime events for chat awareness.", whenToUse: "Use every time a meaningful action happens or when user asks what happened.", requiredInput: ["sessionId", "event or query"], outputShape: "events or stored event proof", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "runtime events", possibleRisks: ["must sanitize secrets"], supportedModes: ALL_CHAT_MODES, supportedScopes: ["session", "workspace", "project"], costOrTimeSensitivity: "low", scopeType: "universal" },
  { id: "deploy.check", displayName: "Check deployment", category: "deployment", description: "Read deployment/build status when available.", whenToUse: "Use before claiming deployment success.", requiredInput: ["commitSha or deployment id"], outputShape: "deployment status", access: "read", risk: "safe", requiresApproval: false, available: true, proofReturned: "deployment status", possibleRisks: ["pending does not equal success"], supportedModes: ["build", "repair", "inspect"], supportedScopes: ["connected deployments"], costOrTimeSensitivity: "low", scopeType: "universal" },
];

export function getUniversalCapabilityRegistry() {
  return UNIVERSAL_CAPABILITY_REGISTRY;
}

export function getUniversalCapabilitiesForMode(mode: UniversalAssistantMode) {
  return UNIVERSAL_CAPABILITY_REGISTRY.filter((capability) => capability.available && capability.supportedModes.includes(mode));
}

export function getUniversalCapability(id: string) {
  return UNIVERSAL_CAPABILITY_REGISTRY.find((capability) => capability.id === id) || null;
}

export function summarizeUniversalCapabilities(mode?: UniversalAssistantMode) {
  const capabilities = mode ? getUniversalCapabilitiesForMode(mode) : UNIVERSAL_CAPABILITY_REGISTRY;
  return {
    total: capabilities.length,
    byCategory: capabilities.reduce<Record<string, number>>((acc, capability) => {
      acc[capability.category] = (acc[capability.category] || 0) + 1;
      return acc;
    }, {}),
    approvalRequired: capabilities.filter((capability) => capability.requiresApproval).map((capability) => capability.id),
    unavailable: capabilities.filter((capability) => !capability.available).map((capability) => ({ id: capability.id, reason: capability.unavailableReason || "Unavailable" })),
  };
}
