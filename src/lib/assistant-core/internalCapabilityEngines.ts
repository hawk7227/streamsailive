import "server-only";

export type EngineExecutionLevel = "ready" | "partial" | "requires_adapter" | "blocked";

export type CapabilityEngineStep = {
  id: string;
  action: string;
  tools: string[];
  proof: string[];
  failureChecks: string[];
};

export type InternalCapabilityEngine = {
  id: string;
  label: string;
  equalsOrExceedsClass: string[];
  purpose: string;
  executionLevel: EngineExecutionLevel;
  primaryRoute: string;
  inputs: string[];
  outputs: string[];
  steps: CapabilityEngineStep[];
  mustNotDo: string[];
};

export const INTERNAL_CAPABILITY_ENGINE_VERSION = "2026-06-13";

export const INTERNAL_CAPABILITY_ENGINES: InternalCapabilityEngine[] = [
  {
    id: "creation-engine",
    label: "Creation Engine",
    equalsOrExceedsClass: ["OpenAI Images", "Midjourney", "Firefly", "Stability", "fal.ai", "v0", "Lovable", "Builder.io"],
    purpose: "Turn an idea, prompt, screenshot, document, or business need into a concrete creative/build plan and then route the work to generation, Builder, or both.",
    executionLevel: "ready",
    primaryRoute: "Streams Chat -> Admingeneration or Streams Builder",
    inputs: ["plain prompt", "uploaded image", "document", "screenshot", "business goal", "brand/product context"],
    outputs: ["creative brief", "prompt stack", "story bible", "asset plan", "component/page plan", "job request", "proof requirements"],
    steps: [
      {
        id: "understand-intent",
        action: "Classify whether the user wants image, video, song, app, workflow, copy, or system output.",
        tools: ["search_files", "web_search when current sources are needed"],
        proof: ["request type", "required output", "source inputs"],
        failureChecks: ["do not route all creative requests to image only", "do not ask unnecessary clarifying questions when enough input exists"],
      },
      {
        id: "compose-production-plan",
        action: "Create the production plan using best-in-class standards: audience, medium, constraints, style, continuity, quality gate, and proof.",
        tools: ["send_workspace_action"],
        proof: ["plan", "constraints", "quality gate"],
        failureChecks: ["generic prompt", "missing continuity", "missing proof"],
      },
      {
        id: "execute-or-route",
        action: "Route to Admingeneration for assets or Streams Builder for implemented pages/systems.",
        tools: ["generate_media", "generate_song", "generate_voice", "send_workspace_action"],
        proof: ["job id", "artifact URL", "workspace action", "status"],
        failureChecks: ["claiming generation without asset/status", "claiming build without file changes"],
      },
    ],
    mustNotDo: ["pretend a provider ran", "stop at advice when execution is ready", "ignore uploaded assets"],
  },
  {
    id: "movie-engine",
    label: "Movie / Long-Form Video Engine",
    equalsOrExceedsClass: ["Sora-style video", "Runway", "Kling", "Veo", "Luma", "Pika", "Descript"],
    purpose: "Produce videos and movie-style outputs from scratch by planning story, scenes, shots, continuity, clips, status, and proof instead of treating every video as one prompt.",
    executionLevel: "ready",
    primaryRoute: "generate_media(type=video|i2v, longVideo=true) -> video runtime -> scene jobs -> polling/finalization",
    inputs: ["movie idea", "script", "story", "reference image", "brand/product goal", "duration", "aspect ratio"],
    outputs: ["story bible", "scene list", "shot prompts", "clip jobs", "provider status", "artifact URLs", "final proof"],
    steps: [
      {
        id: "story-bible",
        action: "Convert prompt into story bible: characters, identity anchors, locations, timeline, style, continuity, and negative constraints.",
        tools: ["generate_media"],
        proof: ["story bible in plan", "continuity profile"],
        failureChecks: ["one-clip thinking", "missing identity locks", "missing scene timeline"],
      },
      {
        id: "scene-breakdown",
        action: "Break long-form requests into scenes/clips with shot prompts, duration, motion, and camera rules.",
        tools: ["generate_media"],
        proof: ["scene count", "clip prompts", "target seconds"],
        failureChecks: ["duration mismatch", "same scene repeated", "no clip status"],
      },
      {
        id: "submit-and-prove",
        action: "Submit clip jobs through ready providers, track parent/child status, and return pending/completed proof.",
        tools: ["generate_media", "list_conversation_artifacts"],
        proof: ["generation id", "provider", "pending/completed status", "asset URL when ready"],
        failureChecks: ["no polling path", "no artifact", "unreported provider failure"],
      },
    ],
    mustNotDo: ["call one video prompt a movie", "claim completed before polling/finalization", "skip continuity QC"],
  },
  {
    id: "song-audio-engine",
    label: "Song / Voice / Audio Engine",
    equalsOrExceedsClass: ["ElevenLabs", "OpenAI Voice", "Suno-style workflows", "Udio-style workflows", "Descript"],
    purpose: "Produce voice, narration, song, and audio workflow outputs from concept through lyrics/script/style to audio artifact proof.",
    executionLevel: "ready",
    primaryRoute: "generate_voice / generate_song -> voice-runtime/song-runtime -> artifacts",
    inputs: ["script", "voice style", "song idea", "lyrics", "genre", "mood", "tempo", "reference audio"],
    outputs: ["voice audio", "song prompt", "lyrics", "instrumental/vocal plan", "audio artifact", "status"],
    steps: [
      {
        id: "audio-intent",
        action: "Classify narration, voiceover, song, instrumental, jingle, dubbing, or audio-editing request.",
        tools: ["generate_voice", "generate_song"],
        proof: ["audio type", "provider", "voice/style plan"],
        failureChecks: ["song treated as TTS", "voiceover treated as song"],
      },
      {
        id: "audio-production-plan",
        action: "Create script/lyrics/style/tempo/voice plan before execution when the request needs production quality.",
        tools: ["generate_song", "generate_voice"],
        proof: ["script/lyrics", "style", "duration/format"],
        failureChecks: ["generic lyrics", "missing voice style", "no format"],
      },
      {
        id: "audio-artifact-proof",
        action: "Execute and return audio URL/status or clear provider blocker.",
        tools: ["generate_song", "generate_voice", "list_conversation_artifacts"],
        proof: ["audio URL", "artifact id", "provider", "status"],
        failureChecks: ["claiming generated with no URL", "missing provider error"],
      },
    ],
    mustNotDo: ["claim Suno/Udio parity unless provider output exists", "return only lyrics when user asked for audio"],
  },
  {
    id: "builder-engine",
    label: "Builder / System Creation Engine",
    equalsOrExceedsClass: ["Codex", "Claude Code", "Cursor", "Devin", "Replit Agent", "GitHub Copilot coding agent", "v0", "Bolt", "Lovable"],
    purpose: "Build, change, and deploy real software systems from source truth with repair loops and proof, not mock frontend-only claims.",
    executionLevel: "ready",
    primaryRoute: "Streams Builder -> repo/source truth -> tools -> build -> browser proof -> deploy",
    inputs: ["feature request", "bug report", "screenshot", "logs", "repo path", "route", "acceptance criteria"],
    outputs: ["file mapping", "patch", "build result", "browser verification", "commit/deploy proof", "remaining blockers"],
    steps: [
      {
        id: "source-truth",
        action: "Find exact files/routes/components before editing.",
        tools: ["list_workspace_files", "search_files", "read_workspace_file"],
        proof: ["file list", "read file", "mapped route/component"],
        failureChecks: ["guessing file", "editing wrong route", "using stale chat memory"],
      },
      {
        id: "safe-change",
        action: "Apply minimal file writes/patches and keep unrelated files untouched.",
        tools: ["apply_workspace_patch", "write_workspace_file"],
        proof: ["changed path", "content preview", "patch summary"],
        failureChecks: ["unrelated dirty files", "secret edits", "backend changed without approval"],
      },
      {
        id: "verify-and-deploy",
        action: "Run build/test/browser verification and only claim done with proof.",
        tools: ["run_workspace_command", "build_workspace", "run_verification"],
        proof: ["exit code", "build logs", "browser result", "deployment URL when deployed"],
        failureChecks: ["claiming fixed without running", "not reading errors", "no browser proof"],
      },
    ],
    mustNotDo: ["invent code execution", "change unrelated files", "skip proof", "commit env/secrets"],
  },
  {
    id: "repair-engine",
    label: "Repair / Troubleshooting Engine",
    equalsOrExceedsClass: ["elite AI coding agent repair", "CI repair", "provider failure repair", "env repair", "browser proof repair"],
    purpose: "Diagnose and repair broken builds, routes, providers, env, PR failures, hallucinated tool calls, stale context, bad verification, and missing proof.",
    executionLevel: "ready",
    primaryRoute: "error/log -> classify -> root cause -> patch -> rerun -> proof",
    inputs: ["terminal log", "CI error", "provider error", "screenshot", "missing env", "bad output", "route failure"],
    outputs: ["failure class", "root cause", "exact fix", "rerun result", "proof", "next blocker"],
    steps: [
      {
        id: "classify-failure",
        action: "Classify the failure type before changing code.",
        tools: ["search_files", "read_workspace_file", "run_workspace_command"],
        proof: ["failure class", "first root error", "affected file/route/tool"],
        failureChecks: ["fixing symptoms", "ignoring first root error", "looping same command"],
      },
      {
        id: "repair-smallest-unit",
        action: "Patch the smallest responsible file/config and rerun only the needed verification first.",
        tools: ["apply_workspace_patch", "write_workspace_file", "run_workspace_command"],
        proof: ["patch", "rerun output", "pass/fail"],
        failureChecks: ["large rewrite", "no rerun", "new unrelated error"],
      },
      {
        id: "proof-or-next-blocker",
        action: "Return proof if fixed or a precise next blocker if not fixed.",
        tools: ["build_workspace", "run_verification"],
        proof: ["build/browser/provider proof", "remaining blocker"],
        failureChecks: ["declaring done while partial", "missing proof"],
      },
    ],
    mustNotDo: ["guess without logs", "hide unresolved blocker", "repeat same failed fix", "expose secrets"],
  },
  {
    id: "system-orchestration-engine",
    label: "System Orchestration / Automation Engine",
    equalsOrExceedsClass: ["MCP", "Zapier", "Make", "n8n", "queues", "workers", "CI/CD", "approval gates", "observability"],
    purpose: "Turn multi-step workflows into triggers, actions, jobs, retries, approval gates, events, status, and logs.",
    executionLevel: "ready",
    primaryRoute: "assistant-core tools -> Streams Builder APIs -> Supabase job/event state -> workers/routes",
    inputs: ["workflow goal", "trigger", "action list", "approval rule", "schedule", "provider event", "repo/build event"],
    outputs: ["workflow spec", "job/event model", "route/worker implementation", "retry policy", "approval proof", "status log"],
    steps: [
      {
        id: "workflow-contract",
        action: "Define trigger, actions, state, idempotency, retries, approval, and observability contract.",
        tools: ["send_workspace_action", "write_workspace_file"],
        proof: ["workflow contract", "state model", "retry/approval rules"],
        failureChecks: ["hidden magic", "no failure state", "no approval state"],
      },
      {
        id: "implement-route-worker",
        action: "Build or patch the route/worker/job state needed for the workflow.",
        tools: ["read_workspace_file", "write_workspace_file", "apply_workspace_patch"],
        proof: ["changed files", "route/worker path", "job status shape"],
        failureChecks: ["unwired frontend action", "no persistence", "no logs"],
      },
      {
        id: "verify-flow",
        action: "Run command/browser/API verification and return status proof.",
        tools: ["run_workspace_command", "run_verification"],
        proof: ["test/run output", "event log", "approval/status proof"],
        failureChecks: ["no idempotency", "no retry", "no audit/proof"],
      },
    ],
    mustNotDo: ["build fake frontend-only automations", "skip status/logs", "ignore retries/approval"],
  },
  {
    id: "industry-execution-engine",
    label: "Industry Execution Engine",
    equalsOrExceedsClass: ["healthcare", "ecommerce", "finance", "legal", "education", "media", "entertainment", "advertising", "real estate", "logistics", "HR", "support", "sales", "cybersecurity", "data", "design", "software", "robotics", "operations"],
    purpose: "Convert industry-specific goals into workflows, UI, automations, reports, assets, and systems with domain constraints and proof.",
    executionLevel: "ready",
    primaryRoute: "domain reasoning -> Builder/generation/automation execution -> proof",
    inputs: ["industry", "workflow", "data/source", "policy/constraint", "desired output", "approval/risk"],
    outputs: ["domain workflow", "implementation spec", "UI/system changes", "assets", "proof", "risk/compliance note"],
    steps: [
      {
        id: "domain-map",
        action: "Map the request to industry workflow, constraints, data, approval, and proof requirements.",
        tools: ["web_search", "search_files"],
        proof: ["domain map", "constraint list", "data/source needs"],
        failureChecks: ["generic advice", "unsafe medical/legal/financial claim", "no data provenance"],
      },
      {
        id: "execute-domain-output",
        action: "Route to Builder for systems, generation for assets, or Chat for sourced plan/handoff.",
        tools: ["generate_media", "generate_voice", "generate_song", "write_workspace_file", "send_workspace_action"],
        proof: ["tool route", "asset/file/job output", "status"],
        failureChecks: ["recommendation mistaken for implementation", "missing proof", "unhandled privacy/security"],
      },
      {
        id: "domain-proof",
        action: "Return the domain-specific proof required for acceptance.",
        tools: ["run_verification", "list_conversation_artifacts"],
        proof: ["acceptance criteria", "route/output proof", "risk note"],
        failureChecks: ["no acceptance criteria", "no verification"],
      },
    ],
    mustNotDo: ["pretend expert domain execution without data/source", "skip privacy/compliance", "stop at generic strategy when implementation is requested"],
  },
];

export function buildInternalCapabilityEnginePrompt(): string {
  const lines: string[] = [
    `--- Streams internal capability engines v${INTERNAL_CAPABILITY_ENGINE_VERSION} ---`,
    "These are the real Streams delivery engines. Use them to perform work, not just describe outside companies. Every engine requires route/tool/proof selection before claiming completion.",
  ];

  for (const engine of INTERNAL_CAPABILITY_ENGINES) {
    lines.push(`Engine: ${engine.label}`);
    lines.push(`Equals/exceeds class target: ${engine.equalsOrExceedsClass.join(", ")}`);
    lines.push(`Purpose: ${engine.purpose}`);
    lines.push(`Execution level: ${engine.executionLevel}`);
    lines.push(`Primary route: ${engine.primaryRoute}`);
    lines.push(`Inputs: ${engine.inputs.join(", ")}`);
    lines.push(`Outputs: ${engine.outputs.join(", ")}`);
    for (const step of engine.steps) {
      lines.push(`Step ${step.id}: ${step.action}`);
      lines.push(`Step tools: ${step.tools.join(", ")}`);
      lines.push(`Step proof: ${step.proof.join(", ")}`);
      lines.push(`Step failure checks: ${step.failureChecks.join("; ")}`);
    }
    lines.push(`Must not do: ${engine.mustNotDo.join("; ")}`);
  }

  lines.push("--- End Streams internal capability engines ---");
  return lines.join("\n");
}
