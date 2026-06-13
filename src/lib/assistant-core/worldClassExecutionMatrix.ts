import "server-only";

export type ExecutionLevel =
  | "native_ready"
  | "adapter_ready"
  | "adapter_needed"
  | "knowledge_only"
  | "blocked";

export type WorldClassCapability = {
  id: string;
  category: string;
  exemplars: string[];
  targetCapabilities: string[];
  streamsExecutionPath: string;
  currentExecutionLevel: ExecutionLevel;
  requiredStreamsTools: string[];
  requiredExternalAccess: string[];
  deliveryProof: string[];
  failureModesToPrevent: string[];
};

export const WORLD_CLASS_EXECUTION_MATRIX_VERSION = "2026-06-13";

export const WORLD_CLASS_EXECUTION_MATRIX: WorldClassCapability[] = [
  {
    id: "image-generation-editing",
    category: "AI image generation and editing",
    exemplars: ["OpenAI Images", "Midjourney", "Adobe Firefly", "Stability", "fal.ai"],
    targetCapabilities: [
      "text-to-image",
      "image editing/inpainting",
      "style and brand controlled generation",
      "reference image conditioning",
      "bulk variations",
      "asset QC and retry",
      "storage and artifact return",
    ],
    streamsExecutionPath: "assistant generate_media -> admingeneration/jobs -> OpenAI/fal runtime -> Supabase artifact",
    currentExecutionLevel: "native_ready",
    requiredStreamsTools: ["generate_media", "list_conversation_artifacts"],
    requiredExternalAccess: ["OPENAI_API_KEY or OPENAI_API_KEY_IMAGES", "FAL_API_KEY or FAL_KEY"],
    deliveryProof: ["provider", "job status", "image URL", "artifact id", "prompt/result metadata"],
    failureModesToPrevent: ["prompt drift", "claiming output without URL", "wrong provider", "no artifact storage", "no retry reason"],
  },
  {
    id: "video-generation-movies",
    category: "AI video, movie, scene, and long-form generation",
    exemplars: ["Sora-style video", "Runway", "Kling", "Veo", "Luma", "Pika", "fal.ai"],
    targetCapabilities: [
      "text-to-video",
      "image-to-video",
      "multi-scene story planning",
      "shot lists and scene continuity",
      "long-video chunking/stitching strategy",
      "character/style continuity constraints",
      "video QC for motion, object consistency, edge defects, and prompt adherence",
    ],
    streamsExecutionPath: "assistant generate_media -> admingeneration/jobs -> Runway/Kling/Veo/fal provider route -> artifact/status return",
    currentExecutionLevel: "adapter_ready",
    requiredStreamsTools: ["generate_media", "send_workspace_action", "list_conversation_artifacts"],
    requiredExternalAccess: ["RUNWAY_API_KEY", "KLING_API_KEY", "VEO_API_KEY", "FAL_API_KEY"],
    deliveryProof: ["provider", "job id", "queued/running/completed status", "video URL", "error reason if failed"],
    failureModesToPrevent: ["calling unavailable provider", "one-clip thinking for movie request", "no scene bible", "no status polling", "missing asset URL", "visual defects unreported"],
  },
  {
    id: "voice-song-audio-generation",
    category: "AI voice, songs, music, narration, and audio workflows",
    exemplars: ["ElevenLabs", "OpenAI voice", "Suno-style workflows", "Udio-style workflows", "Descript"],
    targetCapabilities: [
      "text-to-speech",
      "voice style control",
      "script narration",
      "song/music prompt planning",
      "lyrics/instrumental workflows",
      "stems request planning when supported",
      "audio artifact return",
    ],
    streamsExecutionPath: "assistant generate_voice/generate_song -> voice-runtime/song-runtime -> artifact/status return",
    currentExecutionLevel: "adapter_ready",
    requiredStreamsTools: ["generate_voice", "generate_song", "list_conversation_artifacts"],
    requiredExternalAccess: ["ELEVENLABS_API_KEY", "OPENAI_API_KEY", "song provider key when connected"],
    deliveryProof: ["provider", "audio URL", "artifact id", "duration/format", "error reason"],
    failureModesToPrevent: ["claiming song generation when only prompt was produced", "missing audio URL", "wrong voice/provider", "no usage of script text"],
  },
  {
    id: "coding-agent-repo-execution",
    category: "AI coding agents and repo execution",
    exemplars: ["Codex", "Claude Code", "Cursor", "Devin", "Replit Agent", "GitHub Copilot coding agent"],
    targetCapabilities: [
      "repo source-truth reading",
      "task planning",
      "file patching",
      "command execution",
      "build/test repair loop",
      "PR-style change summary",
      "browser verification",
      "human approval gates",
    ],
    streamsExecutionPath: "Streams Builder -> source truth -> workspace tools -> build/browser verification -> GitHub/Vercel proof",
    currentExecutionLevel: "adapter_ready",
    requiredStreamsTools: ["list_workspace_files", "read_workspace_file", "write_workspace_file", "apply_workspace_patch", "run_workspace_command", "build_workspace", "run_verification"],
    requiredExternalAccess: ["GITHUB_TOKEN or GH_TOKEN", "VERCEL_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "CONNECTOR_ENCRYPTION_KEY"],
    deliveryProof: ["changed files", "diff", "build logs", "browser check", "commit SHA", "deployment URL"],
    failureModesToPrevent: ["editing without reading", "unrelated file changes", "build not run", "secret commit", "hallucinated success", "bad UI verification"],
  },
  {
    id: "app-ui-builder-systems",
    category: "App builders, UI builders, design-to-code, and no/low-code systems",
    exemplars: ["v0", "Bolt", "Lovable", "Builder.io", "Locofy", "Codia", "Figma Make/Dev Mode", "Framer", "Webflow"],
    targetCapabilities: [
      "prompt-to-app/page",
      "screenshot-to-code",
      "Figma/design-to-code handoff",
      "component mapping",
      "responsive and safe-area behavior",
      "visual proof",
      "deployable Next/React code",
    ],
    streamsExecutionPath: "Streams Builder visual/frontend workflow -> file tools -> browser/mobile verification -> deployment proof",
    currentExecutionLevel: "adapter_ready",
    requiredStreamsTools: ["search_files", "read_workspace_file", "apply_workspace_patch", "write_workspace_file", "run_verification", "send_workspace_action"],
    requiredExternalAccess: ["repository access", "browser verification runtime", "Vercel deploy access"],
    deliveryProof: ["route URL", "component/file path", "screenshot/browser proof", "mobile/desktop result", "commit/deploy"],
    failureModesToPrevent: ["visual mismatch", "wrong component", "mock-only UI", "unwired buttons", "backend changed without approval", "no browser proof"],
  },
  {
    id: "system-builder-automation",
    category: "System builders, orchestrators, MCP, workflow engines, and automation",
    exemplars: ["MCP", "Zapier", "Make", "n8n", "queues", "workers", "background jobs", "CI/CD", "approval gates", "observability"],
    targetCapabilities: [
      "tool registry",
      "agent routing",
      "workflow trigger/action design",
      "background worker execution",
      "retry/idempotency logic",
      "human approval gates",
      "status/events/logs",
      "observability and failure recovery",
    ],
    streamsExecutionPath: "assistant-core router/tools -> Streams Builder APIs -> worker/job routes -> Supabase status/events",
    currentExecutionLevel: "adapter_ready",
    requiredStreamsTools: ["send_workspace_action", "run_workspace_command", "build_workspace", "run_verification"],
    requiredExternalAccess: ["Supabase service role", "connector encryption", "provider credentials as needed"],
    deliveryProof: ["workflow state", "job id", "event log", "retry/failure status", "approval record"],
    failureModesToPrevent: ["hidden magic", "no idempotency", "no status", "no failure state", "tool called with wrong schema", "stale context"],
  },
  {
    id: "troubleshooting-elite-failure-map",
    category: "Elite troubleshooting and failure-mode handling",
    exemplars: ["AI coding agent failures", "PR rejection", "CI/build failure", "env failure", "provider API failure", "prompt injection", "secret leakage", "bad browser verification"],
    targetCapabilities: [
      "classify failure source",
      "read exact logs/errors",
      "fix one red error at a time",
      "verify after each patch",
      "prevent secret exposure",
      "detect missing proof",
      "recover from stale context and broken routing",
    ],
    streamsExecutionPath: "Builder repair loop -> log/error classification -> patch/test/retry -> proof gate",
    currentExecutionLevel: "adapter_ready",
    requiredStreamsTools: ["read_workspace_file", "search_files", "run_workspace_command", "build_workspace", "run_verification"],
    requiredExternalAccess: ["logs/build output", "repo files", "env readiness", "deployment status"],
    deliveryProof: ["error before", "patch", "error after", "build/pass state", "remaining blocker"],
    failureModesToPrevent: ["guessing fix", "looping same failed command", "ignoring first root error", "claiming fixed before verification", "not isolating dirty files"],
  },
  {
    id: "industry-ai-execution-map",
    category: "Cross-industry AI execution capability map",
    exemplars: ["healthcare", "ecommerce", "finance", "legal", "education", "media", "entertainment", "advertising", "real estate", "logistics", "HR", "customer support", "sales", "cybersecurity", "data analytics", "design", "software", "robotics/physical automation", "operations"],
    targetCapabilities: [
      "domain-specific workflows",
      "data and privacy constraints",
      "specialized UI/UX patterns",
      "automation and approval flows",
      "analysis/reporting",
      "content and generation workflows",
      "implementation path to Builder/generation tools",
    ],
    streamsExecutionPath: "Streams Chat domain reasoning -> Builder implementation or Admingeneration asset execution -> proof/status",
    currentExecutionLevel: "adapter_ready",
    requiredStreamsTools: ["search_files", "web_search", "send_workspace_action", "generate_media", "read_workspace_file", "write_workspace_file", "run_verification"],
    requiredExternalAccess: ["domain data or user-provided source", "connected APIs when actual live operations are required"],
    deliveryProof: ["domain playbook", "implementation plan", "file/route/job proof", "risk/compliance note", "acceptance criteria"],
    failureModesToPrevent: ["generic advice", "unsafe domain claims", "missing data provenance", "no route to execution", "confusing recommendation with implemented system"],
  },
];

export function buildWorldClassExecutionPrompt(): string {
  const lines: string[] = [
    `--- World-class AI execution matrix v${WORLD_CLASS_EXECUTION_MATRIX_VERSION} ---`,
    "Use this matrix to match leading AI-system capabilities to what Streams can actually deliver. If a named external product capability is not natively connected, do not claim exact parity. Build the closest available Streams execution route, name the adapter gap, and provide the proof needed to close it.",
  ];

  for (const item of WORLD_CLASS_EXECUTION_MATRIX) {
    lines.push(`Capability: ${item.category}`);
    lines.push(`Exemplars: ${item.exemplars.join(", ")}`);
    lines.push(`Target capabilities: ${item.targetCapabilities.join("; ")}`);
    lines.push(`Streams execution path: ${item.streamsExecutionPath}`);
    lines.push(`Current execution level: ${item.currentExecutionLevel}`);
    lines.push(`Required tools: ${item.requiredStreamsTools.join(", ")}`);
    lines.push(`Required external access: ${item.requiredExternalAccess.join(", ")}`);
    lines.push(`Proof required: ${item.deliveryProof.join(", ")}`);
    lines.push(`Failure modes to prevent: ${item.failureModesToPrevent.join("; ")}`);
  }

  lines.push("--- End world-class AI execution matrix ---");
  return lines.join("\n");
}
