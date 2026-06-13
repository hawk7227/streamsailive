import "server-only";

import { getEnvReadinessReport } from "@/lib/streams-builder/env-readiness";
import type { CapabilityId, ReadinessState } from "@/lib/streams-builder/env-readiness";

type DeliveryMode = "execute_now" | "knowledge_only" | "blocked" | "approval_required";

type PracticalCapability = {
  id: string;
  label: string;
  linkedReadiness: CapabilityId[];
  canDeliver: string[];
  executionRoute: string;
  requiredTooling: string[];
  proofRequired: string[];
  failureModes: string[];
  fallback: string;
};

type CapabilityRuntimeStatus = PracticalCapability & {
  mode: DeliveryMode;
  readiness: Array<{ id: CapabilityId; state: ReadinessState; missing: string[] }>;
};

const PRACTICAL_CAPABILITIES: PracticalCapability[] = [
  {
    id: "answer-plan-analyze",
    label: "Expert answering, planning, analysis, and document reasoning",
    linkedReadiness: ["chat-core", "chat-uploads"],
    canDeliver: [
      "expert reasoning across domains",
      "document/file understanding when files are indexed",
      "project planning and structured handoff writing",
      "source-aware answers when retrieved context or web tools are available",
    ],
    executionRoute: "Streams Chat / assistant-core/context.ts / assistant-core/tools.ts",
    requiredTooling: ["chat-core", "search_files", "web_search when current facts are required"],
    proofRequired: ["clear answer", "stated assumptions", "file/source citations when used", "blocker stated if current lookup is unavailable"],
    failureModes: [
      "answering from conversation memory only",
      "claiming current facts without verification",
      "dumping irrelevant context",
      "failing to use uploaded/indexed files",
    ],
    fallback: "Return knowledge-only guidance and state what source/tool is needed for verification.",
  },
  {
    id: "repo-build-repair",
    label: "Repository build, repair, troubleshooting, and deployment execution",
    linkedReadiness: ["builder-repair-loop", "builder-github", "builder-vercel", "builder-proof"],
    canDeliver: [
      "find source files",
      "read/write/patch workspace files",
      "run allowed build/test commands",
      "inspect errors and repair one red error at a time",
      "push/deploy through GitHub/Vercel flows when configured",
      "return proof from build logs, browser verification, commits, and routes",
    ],
    executionRoute: "Streams Builder / repository-execution / browser-verification / GitHub/Vercel routes",
    requiredTooling: ["list_workspace_files", "read_workspace_file", "write_workspace_file", "apply_workspace_patch", "run_workspace_command", "build_workspace", "run_verification"],
    proofRequired: ["changed files", "diff or patch summary", "build/test result", "browser proof", "commit/deploy status"],
    failureModes: [
      "editing without reading source truth",
      "touching unrelated files",
      "claiming build success without running build",
      "not checking deployed route",
      "staging secrets or dirty unrelated files",
    ],
    fallback: "If execution is unavailable, provide exact commands and mark the task as not executed.",
  },
  {
    id: "generation-image-video-voice",
    label: "AI image, video, image-to-video, music, and voice generation",
    linkedReadiness: [
      "gen-admin-jobs",
      "gen-text-to-image-openai",
      "gen-text-to-image-fal",
      "gen-image-to-video-runway",
      "gen-image-to-video-kling",
      "gen-image-to-video-veo",
      "gen-text-to-video-runway",
      "gen-text-to-video-kling",
      "gen-text-to-video-veo",
      "gen-voice-elevenlabs",
      "gen-voice-openai",
    ],
    canDeliver: [
      "route image generation to OpenAI/fal when ready",
      "route video/image-to-video to Runway/Kling/Veo when ready",
      "route voice to ElevenLabs/OpenAI voice when ready",
      "return job status and artifact URLs when the runtime produces them",
      "apply realism, continuity, prompt, and provider selection standards",
    ],
    executionRoute: "Admingeneration / assistant generate_media / voice-runtime / song-runtime",
    requiredTooling: ["generate_media", "generate_voice", "generate_song", "list_conversation_artifacts"],
    proofRequired: ["provider", "job status", "asset URL", "artifact id", "error reason if failed"],
    failureModes: [
      "provider key missing",
      "job queued without final asset",
      "claiming visual output without URL",
      "wrong provider for input type",
      "prompt drift or missing continuity constraints",
    ],
    fallback: "If provider execution is blocked, provide a provider-ready prompt and exact missing readiness item.",
  },
  {
    id: "visual-ui-system-build",
    label: "Visual frontend, design-to-code, and UI system delivery",
    linkedReadiness: ["builder-repair-loop", "builder-proof", "chat-uploads"],
    canDeliver: [
      "read design references/screenshots/uploads",
      "map UI to components/routes/files",
      "patch React/Next/Tailwind/shadcn UI",
      "verify mobile/desktop/browser behavior",
      "return before/after proof where available",
    ],
    executionRoute: "Streams Builder + file retrieval + browser verification",
    requiredTooling: ["search_files", "read_workspace_file", "apply_workspace_patch", "run_workspace_command", "run_verification"],
    proofRequired: ["component path", "route URL", "browser screenshot/check", "responsive check", "changed files"],
    failureModes: [
      "building from visual memory only",
      "wrong file/component mapping",
      "pixel mismatch",
      "mobile safe-area regression",
      "changing backend logic during frontend-only tasks",
    ],
    fallback: "Create a precise implementation plan and ask for route/file/source truth if execution is unavailable.",
  },
  {
    id: "industry-workflow-implementation",
    label: "Industry workflow implementation across healthcare, ecommerce, marketing, automation, and operations",
    linkedReadiness: ["chat-core", "builder-repair-loop", "builder-proof", "gen-admin-jobs"],
    canDeliver: [
      "apply domain expert standards to product/workflow decisions",
      "convert strategy into specs, UI, data flows, automations, and proof requirements",
      "route code implementation to Builder and creative assets to Admingeneration",
      "keep privacy/security/business constraints explicit",
    ],
    executionRoute: "Streams Chat -> Builder/Admingeneration based on requested outcome",
    requiredTooling: ["search_files", "send_workspace_action", "generate_media", "read_workspace_file", "write_workspace_file", "run_verification"],
    proofRequired: ["acceptance criteria", "route/tool used", "implementation proof", "domain-specific risk/blocker note"],
    failureModes: [
      "generic advice instead of workflow-specific execution",
      "confusing knowledge-only recommendation with implemented feature",
      "missing privacy/compliance/security boundaries",
      "not mapping strategy to real files/routes/jobs",
    ],
    fallback: "Return a source-backed playbook and exact execution path before claiming implementation.",
  },
];

function readinessById() {
  const report = getEnvReadinessReport();
  return new Map(report.capabilities.map((item) => [item.id, item] as const));
}

function resolveMode(states: ReadinessState[]): DeliveryMode {
  if (states.includes("missing")) return "blocked";
  if (states.includes("partial")) return "execute_now";
  return "execute_now";
}

export function getPracticalCapabilityStatuses(): CapabilityRuntimeStatus[] {
  const readiness = readinessById();
  return PRACTICAL_CAPABILITIES.map((capability) => {
    const linked = capability.linkedReadiness.map((id) => {
      const item = readiness.get(id);
      return {
        id,
        state: item?.state ?? "missing",
        missing: item?.missing ?? [id],
      };
    });

    return {
      ...capability,
      mode: resolveMode(linked.map((item) => item.state)),
      readiness: linked,
    };
  });
}

export function buildPracticalCapabilityPrompt(): string {
  const statuses = getPracticalCapabilityStatuses();
  const lines: string[] = [
    "--- Practical capability delivery engine ---",
    "Use this to convert knowledge into real delivered work. Do not stop at advice when a ready execution route exists. Do not claim delivery when proof signals are missing.",
  ];

  for (const status of statuses) {
    const blocked = status.readiness
      .filter((item) => item.state === "missing")
      .flatMap((item) => item.missing)
      .filter(Boolean);

    lines.push(`Capability: ${status.label}`);
    lines.push(`Mode: ${blocked.length ? "blocked" : status.mode}`);
    lines.push(`Execution route: ${status.executionRoute}`);
    lines.push(`Can deliver: ${status.canDeliver.join("; ")}`);
    lines.push(`Required tooling: ${status.requiredTooling.join(", ")}`);
    lines.push(`Proof required: ${status.proofRequired.join(", ")}`);
    lines.push(`Failure modes to prevent: ${status.failureModes.join("; ")}`);
    if (blocked.length) lines.push(`Blocked by: ${Array.from(new Set(blocked)).join(", ")}`);
    lines.push(`Fallback: ${status.fallback}`);
  }

  lines.push("--- End practical capability delivery engine ---");
  return lines.join("\n");
}
