export type WorkstationCapability =
  | "chat"
  | "open_repo_file"
  | "search_repo"
  | "preview_file"
  | "runtime_react_preview"
  | "edit_code"
  | "highlight_code"
  | "patch_preview"
  | "apply_patch"
  | "reject_patch"
  | "undo_patch"
  | "show_diff"
  | "run_build"
  | "show_logs"
  | "browser_verify"
  | "upload_asset"
  | "display_asset"
  | "large_file_preview"
  | "image_generation"
  | "video_generation"
  | "image_to_video"
  | "url_ingest"
  | "web_search"
  | "approval_review"
  | "push_after_approval";

export type WorkstationId =
  | "primary-builder"
  | "visual-editing"
  | "component-mapping"
  | "approval-center"
  | "browser-verification"
  | "repository-truth"
  | "projects-dashboard"
  | "truth-panel"
  | "generation";

export type PulledFileDetail = {
  repo: string;
  branch: string;
  path: string;
  folder: string;
  sha: string;
  content: string;
  route: string;
};

export type BuilderChatConnection = {
  connected: boolean;
  activeWorkstationId: string;
  activeWorkstationName: string;
  sessionId: string;
  capabilities?: WorkstationCapability[];
  source?: {
    repo?: string;
    branch?: string;
    filePath?: string;
    route?: string;
    sha?: string;
  };
  rules?: string[];
};

export type WorkstationContract = {
  id: WorkstationId;
  name: string;
  purpose: string;
  previewHost: string[];
  capabilities: WorkstationCapability[];
  mustNever: string[];
  requiredProofBeforeDone: string[];
};

export const CHAT_CAPABILITY_AUDIT: { label: string; capability: WorkstationCapability; requiredWorkspaceReceiver: string }[] = [
  { label: "Normal chat and streamed reasoning/status", capability: "chat", requiredWorkspaceReceiver: "Live Summary lane and connected chat status receiver" },
  { label: "Open or pull any repo file by command", capability: "open_repo_file", requiredWorkspaceReceiver: "Repository file opener with repo/branch/path proof" },
  { label: "Search repo for matching sections/files", capability: "search_repo", requiredWorkspaceReceiver: "Repo search candidate list with file/route confidence" },
  { label: "Code editing and repair", capability: "edit_code", requiredWorkspaceReceiver: "Runtime code editor with visible line-range transaction" },
  { label: "Patch preview, apply, reject, undo", capability: "patch_preview", requiredWorkspaceReceiver: "Patch transaction lane with approve/reject controls" },
  { label: "Real React/Next frontend preview", capability: "runtime_react_preview", requiredWorkspaceReceiver: "Staged runtime preview rendered from the same source code" },
  { label: "Build, test, logs, diagnostics", capability: "run_build", requiredWorkspaceReceiver: "Build/log panel with inline error routing" },
  { label: "Image generation", capability: "image_generation", requiredWorkspaceReceiver: "Asset preview lane and library receiver" },
  { label: "Video generation and image-to-video", capability: "video_generation", requiredWorkspaceReceiver: "Video preview lane and artifact receiver" },
  { label: "Large file upload/transfer/preview", capability: "large_file_preview", requiredWorkspaceReceiver: "Large-file preview host and asset-transfer receiver" },
  { label: "URL ingest / read link", capability: "url_ingest", requiredWorkspaceReceiver: "Document/link preview and extracted context viewer" },
  { label: "Web search", capability: "web_search", requiredWorkspaceReceiver: "Search result/source viewer and Summary events" },
  { label: "Asset copy/save/share", capability: "display_asset", requiredWorkspaceReceiver: "Asset card with copy/download/share actions" },
];

export const RUNTIME_PREVIEW_ONLY_RULES = [
  "No HTML mock preview can be accepted as proof of a React/Next fix.",
  "No separate AI design preview can be used as final approval proof.",
  "The preview must render from the same staged source code that will be pushed.",
  "The visible code editor and the frontend preview must refer to the same repo, branch/session, file, route, dependencies, CSS, assets, and runtime.",
  "AI cannot claim fixed/done/resolved until the staged runtime preview is visible and the user approves the result.",
  "Push is locked until the user sees the source file, patch/diff, staged frontend preview, and approval state.",
];

export const PREVIEW_FIRST_STATE_MACHINE = [
  "REQUEST_RECEIVED",
  "WORKSTATION_CONNECTION_CONFIRMED",
  "CAPABILITY_CHECKED",
  "REAL_FILE_CANDIDATES_FOUND",
  "SOURCE_TO_ROUTE_PROOF_READY",
  "USER_CONFIRMS_FILE",
  "PATCH_TRANSACTION_CREATED",
  "PATCH_VISIBLE_IN_CODE_EDITOR",
  "PATCH_APPLIED_TO_STAGED_RUNTIME_ONLY",
  "REAL_REACT_PREVIEW_RENDERED",
  "USER_VISUAL_REVIEW",
  "BUILD_OR_DIAGNOSTIC_CHECK",
  "USER_APPROVES_PUSH",
  "PUSH_ALLOWED",
];

export const WORKSTATION_CONTRACTS: Record<WorkstationId, WorkstationContract> = {
  "primary-builder": {
    id: "primary-builder",
    name: "Primary Builder",
    purpose: "Full build, repo execution, file creation/editing, build logs, preview proof, and approval shipping.",
    previewHost: ["runtime app preview", "code", "diff", "logs", "proof"],
    capabilities: ["chat", "open_repo_file", "search_repo", "edit_code", "preview_file", "runtime_react_preview", "patch_preview", "apply_patch", "reject_patch", "undo_patch", "show_diff", "run_build", "show_logs", "approval_review", "push_after_approval"],
    mustNever: RUNTIME_PREVIEW_ONLY_RULES,
    requiredProofBeforeDone: ["Correct repo/file/route confirmed", "Patch visible", "Staged runtime preview visible", "Build/log status visible", "User approval captured"],
  },
  "visual-editing": {
    id: "visual-editing",
    name: "Visual Editing",
    purpose: "Real frontend visual/code editing with source-to-preview proof and no fake/mock preview.",
    previewHost: ["runtime React preview", "code editor", "diff", "before/after", "asset preview"],
    capabilities: ["chat", "open_repo_file", "search_repo", "preview_file", "runtime_react_preview", "edit_code", "highlight_code", "patch_preview", "apply_patch", "reject_patch", "undo_patch", "show_diff", "upload_asset", "display_asset", "large_file_preview", "approval_review", "push_after_approval"],
    mustNever: RUNTIME_PREVIEW_ONLY_RULES,
    requiredProofBeforeDone: ["Real file visible", "Rendered route visible", "Patch visible in code", "Staged React preview rendered from patch", "User visual approval"],
  },
  "component-mapping": {
    id: "component-mapping",
    name: "Component Mapping",
    purpose: "Map DOM elements to source files, component boundaries, source ranges, imports, and routes.",
    previewHost: ["DOM tree", "component graph", "source range", "preview highlight"],
    capabilities: ["chat", "open_repo_file", "search_repo", "preview_file", "highlight_code", "show_diff", "approval_review"],
    mustNever: ["Never use word-by-word fake layers as final mapping proof.", "Never claim a source map without file/route/component evidence."],
    requiredProofBeforeDone: ["DOM element selected", "Source range shown", "File and route shown", "Confidence/proof visible"],
  },
  "approval-center": {
    id: "approval-center",
    name: "Approval Center",
    purpose: "Gate approvals, patch review, staged preview confirmation, build proof, and push permission.",
    previewHost: ["before/after", "diff", "build proof", "approval checklist"],
    capabilities: ["chat", "patch_preview", "show_diff", "browser_verify", "show_logs", "approval_review", "push_after_approval"],
    mustNever: ["Never allow push without explicit user approval.", "Never accept backend-only proof for a frontend visual request."],
    requiredProofBeforeDone: ["Patch reviewed", "Preview reviewed", "Build state reviewed", "Approval logged"],
  },
  "browser-verification": {
    id: "browser-verification",
    name: "Browser Verification",
    purpose: "Navigate, verify, screenshot, compare, and prove frontend/browser behavior.",
    previewHost: ["browser", "screenshots", "logs", "proof"],
    capabilities: ["chat", "preview_file", "browser_verify", "show_logs", "display_asset", "approval_review"],
    mustNever: ["Never say verified without visible browser proof.", "Never treat a source diff as browser proof."],
    requiredProofBeforeDone: ["Route loaded", "Screenshot/proof visible", "Expected section visible", "User can inspect result"],
  },
  "repository-truth": {
    id: "repository-truth",
    name: "Repository Truth",
    purpose: "Repo, branch, SHA, diff, file history, and source truth control.",
    previewHost: ["repo browser", "code", "diff", "history", "status"],
    capabilities: ["chat", "open_repo_file", "search_repo", "show_diff", "run_build", "show_logs", "approval_review", "push_after_approval"],
    mustNever: ["Never edit an unconfirmed branch/file.", "Never push if branch/source truth is stale."],
    requiredProofBeforeDone: ["Repo/branch/SHA shown", "Diff shown", "Status shown", "Approval captured"],
  },
  "projects-dashboard": {
    id: "projects-dashboard",
    name: "Projects Dashboard",
    purpose: "Project overview, status, assets, sessions, jobs, and handoff tracking.",
    previewHost: ["project overview", "assets", "jobs", "proof"],
    capabilities: ["chat", "display_asset", "large_file_preview", "show_logs", "approval_review"],
    mustNever: ["Never mutate a workstation from dashboard mode without switching connection."],
    requiredProofBeforeDone: ["Project state visible", "Jobs/assets visible", "Next action visible"],
  },
  "truth-panel": {
    id: "truth-panel",
    name: "Truth Panel",
    purpose: "Global proof, source truth, claims, status, and final readiness validation.",
    previewHost: ["proof", "logs", "diff", "build status"],
    capabilities: ["chat", "show_diff", "show_logs", "approval_review", "browser_verify"],
    mustNever: ["Never mark complete without source, preview, and approval proof."],
    requiredProofBeforeDone: ["All proof lanes passed", "No missing preview", "No unapproved push"],
  },
  generation: {
    id: "generation",
    name: "Generation",
    purpose: "Image/video/image-to-video generation, asset staging, and transfer to preview hosts.",
    previewHost: ["image preview", "video preview", "asset library", "large file preview"],
    capabilities: ["chat", "upload_asset", "display_asset", "large_file_preview", "image_generation", "video_generation", "image_to_video", "approval_review"],
    mustNever: ["Never lose generated assets when switching workstations.", "Never hide generation status outside Summary."],
    requiredProofBeforeDone: ["Asset visible", "Generation status visible", "Asset transfer target visible", "User approval captured"],
  },
};

export function workstationIdFromName(name: string): WorkstationId {
  const id = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") as WorkstationId;
  return WORKSTATION_CONTRACTS[id] ? id : "primary-builder";
}

export function getWorkstationContract(nameOrId: string): WorkstationContract {
  return WORKSTATION_CONTRACTS[workstationIdFromName(nameOrId)];
}

export function buildConnectionContext(activeModule: string, activeFile?: Partial<PulledFileDetail>): BuilderChatConnection {
  const contract = getWorkstationContract(activeModule);
  return {
    connected: true,
    activeWorkstationId: contract.id,
    activeWorkstationName: contract.name,
    sessionId: "agent-1",
    capabilities: contract.capabilities,
    source: {
      repo: activeFile?.repo || "",
      branch: activeFile?.branch || "",
      filePath: activeFile?.path || "",
      route: activeFile?.route || "",
      sha: activeFile?.sha || "",
    },
    rules: contract.mustNever,
  };
}
