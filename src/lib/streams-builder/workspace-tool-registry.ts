import type { StreamsBuilderMode, StreamsBuilderTool } from "@/lib/streams-builder/orchestrator-core";

export type WorkspaceEventKind =
  | "workspace.loaded"
  | "file.opened"
  | "file.read"
  | "file.changed"
  | "visual.layer.selected"
  | "visual.layer.mapped"
  | "visual.safety.blocked"
  | "chat.intervention.required"
  | "mode.selected"
  | "tool.selected"
  | "tool.started"
  | "tool.finished"
  | "patch.created"
  | "build.started"
  | "build.failed"
  | "build.passed"
  | "repair.started"
  | "repair.completed"
  | "deploy.pending"
  | "deploy.success"
  | "rollback.available";

export type WorkspaceCapability = StreamsBuilderTool & {
  realPath?: string;
  eventKinds: WorkspaceEventKind[];
  chatAwareness: string;
};

const ALL_MODES: StreamsBuilderMode[] = ["conversation", "inspect", "build", "repair", "visual-edit", "safety-intervention"];

export const WORKSPACE_TOOL_REGISTRY: WorkspaceCapability[] = [
  {
    name: "chat.free_flow_conversation",
    category: "chat",
    modes: ALL_MODES,
    risk: "safe",
    requiresApproval: false,
    available: true,
    realPath: "src/components/streams-builder/BuilderCenterChat.tsx",
    description: "Natural conversation remains active and can shift into inspect, build, repair, visual edit, or safety mode.",
    eventKinds: ["workspace.loaded", "mode.selected", "chat.intervention.required"],
    chatAwareness: "Chat is the visible voice of the orchestrator and should summarize current workspace state before action.",
  },
  {
    name: "events.context_stream",
    category: "memory",
    modes: ALL_MODES,
    risk: "safe",
    requiresApproval: false,
    available: true,
    realPath: "src/lib/streams-builder/system-events.ts",
    description: "Stores workspace events so chat knows actions happening across the builder.",
    eventKinds: ["workspace.loaded", "file.opened", "visual.layer.selected", "tool.started", "tool.finished", "build.failed", "deploy.success"],
    chatAwareness: "Every meaningful workspace event should be recorded here for orchestrator recall.",
  },
  {
    name: "events.context_api",
    category: "memory",
    modes: ALL_MODES,
    risk: "safe",
    requiresApproval: false,
    available: true,
    realPath: "src/app/api/streams-builder/context-events/route.ts",
    description: "Reads and writes builder events from the workspace UI.",
    eventKinds: ["tool.started", "tool.finished", "chat.intervention.required"],
    chatAwareness: "Workspace UI can send events here so chat can react to current state.",
  },
  {
    name: "visual.editable_preview_bridge",
    category: "visual",
    modes: ["inspect", "visual-edit", "safety-intervention"],
    risk: "caution",
    requiresApproval: false,
    available: true,
    realPath: "src/app/api/streams-builder/editable-preview/route.ts",
    description: "Existing visual editor foundation for layer mapping, selection, parent/child controls, and safety alerts.",
    eventKinds: ["visual.layer.mapped", "visual.layer.selected", "visual.safety.blocked", "chat.intervention.required"],
    chatAwareness: "Visual selections and unsafe actions must be sent to chat through events.",
  },
  {
    name: "visual.code_dock",
    category: "visual",
    modes: ["inspect", "visual-edit", "safety-intervention"],
    risk: "safe",
    requiresApproval: false,
    available: true,
    realPath: "src/components/streams-builder/VisualEditorCodeDock.tsx",
    description: "Keeps visual preview and code locator coordinated without taking edit focus from visual clicks.",
    eventKinds: ["visual.layer.selected", "file.opened", "file.read"],
    chatAwareness: "Chat should know selected visual layer and matched file context.",
  },
  {
    name: "code.runtime_editor",
    category: "repository",
    modes: ["inspect", "build", "repair", "visual-edit"],
    risk: "caution",
    requiresApproval: true,
    available: true,
    realPath: "src/components/streams-builder/RuntimeCodeEditor.tsx",
    description: "Code editor for source display, locate/highlight, and controlled manual edits.",
    eventKinds: ["file.opened", "file.read", "file.changed"],
    chatAwareness: "Chat should know what file is open, selected, or changed.",
  },
  {
    name: "repository.execution_plan",
    category: "build",
    modes: ["build", "repair"],
    risk: "approval",
    requiresApproval: true,
    available: true,
    realPath: "src/app/api/streams-builder/repository-execution/route.ts",
    description: "Creates repository execution plans, queues jobs, and records build/repair events.",
    eventKinds: ["tool.started", "patch.created", "build.started", "build.failed", "repair.started", "repair.completed"],
    chatAwareness: "Chat should know when repository work is planned, queued, blocked, running, failed, or finished.",
  },
  {
    name: "repository.worker",
    category: "build",
    modes: ["build", "repair"],
    risk: "approval",
    requiresApproval: true,
    available: true,
    realPath: "src/lib/streams-builder/repository-worker.ts",
    description: "Executes repository actions under the orchestrator instead of acting as an independent brain.",
    eventKinds: ["tool.started", "tool.finished", "build.started", "build.failed", "build.passed"],
    chatAwareness: "Worker output must return to chat/orchestrator for the next decision.",
  },
  {
    name: "browser.verification",
    category: "validation",
    modes: ["build", "repair", "visual-edit"],
    risk: "caution",
    requiresApproval: false,
    available: true,
    realPath: "src/app/api/streams-builder/browser-verification/route.ts",
    description: "Checks browser/preview state after changes when available.",
    eventKinds: ["tool.started", "tool.finished", "build.passed", "build.failed"],
    chatAwareness: "Chat should receive preview verification results before claiming success.",
  },
  {
    name: "env.readiness",
    category: "validation",
    modes: ["inspect", "build", "repair"],
    risk: "safe",
    requiresApproval: false,
    available: true,
    realPath: "src/app/api/streams-builder/env-readiness/route.ts",
    description: "Reports environment/tool readiness so the orchestrator knows what is available.",
    eventKinds: ["tool.started", "tool.finished"],
    chatAwareness: "Chat should avoid promising unavailable tools.",
  },
  {
    name: "github.file_api",
    category: "repository",
    modes: ["inspect", "build", "repair"],
    risk: "approval",
    requiresApproval: true,
    available: true,
    realPath: "src/app/api/streams-builder/github/file/route.ts",
    description: "Reads or writes repository files through the Streams builder GitHub file API.",
    eventKinds: ["file.read", "file.changed", "patch.created", "rollback.available"],
    chatAwareness: "Chat should know each file read/write and changed path.",
  },
  {
    name: "source.truth_registry",
    category: "repository",
    modes: ["inspect", "build", "repair", "visual-edit"],
    risk: "safe",
    requiresApproval: false,
    available: true,
    realPath: "src/lib/streams-builder/source-truth-registry.ts",
    description: "Tracks source-of-truth targets for files/routes so scope decisions are grounded.",
    eventKinds: ["file.opened", "file.read", "visual.layer.selected"],
    chatAwareness: "Chat should prefer source-truth mappings over guessing.",
  },
  {
    name: "operation.dock",
    category: "visual",
    modes: ["visual-edit", "build", "repair"],
    risk: "caution",
    requiresApproval: true,
    available: true,
    realPath: "src/components/streams-builder/VisualOperationDock.tsx",
    description: "Visual operation controls for selected layers and scoped operations.",
    eventKinds: ["visual.layer.selected", "tool.selected", "chat.intervention.required"],
    chatAwareness: "Chat should know selected operations and whether they are safe.",
  },
  {
    name: "property.inspector",
    category: "visual",
    modes: ["visual-edit", "inspect"],
    risk: "safe",
    requiresApproval: false,
    available: true,
    realPath: "src/components/streams-builder/VisualPropertyInspector.tsx",
    description: "Shows visual layer properties and edit scope context.",
    eventKinds: ["visual.layer.selected", "visual.layer.mapped"],
    chatAwareness: "Chat should receive layer type, parent, child count, and editable properties.",
  },
];

export function getWorkspaceToolRegistry() {
  return WORKSPACE_TOOL_REGISTRY;
}

export function getWorkspaceToolsForMode(mode: StreamsBuilderMode) {
  return WORKSPACE_TOOL_REGISTRY.filter((tool) => tool.available && tool.modes.includes(mode));
}

export function getWorkspaceToolByName(name: string) {
  return WORKSPACE_TOOL_REGISTRY.find((tool) => tool.name === name) || null;
}

export function getWorkspaceEventKinds() {
  return Array.from(new Set(WORKSPACE_TOOL_REGISTRY.flatMap((tool) => tool.eventKinds))).sort();
}

export function summarizeWorkspaceCapabilities(mode?: StreamsBuilderMode) {
  const tools = mode ? getWorkspaceToolsForMode(mode) : WORKSPACE_TOOL_REGISTRY;
  return {
    totalTools: tools.length,
    toolsByCategory: tools.reduce<Record<string, number>>((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1;
      return acc;
    }, {}),
    approvalRequired: tools.filter((tool) => tool.requiresApproval).map((tool) => tool.name),
    eventKinds: Array.from(new Set(tools.flatMap((tool) => tool.eventKinds))).sort(),
  };
}
