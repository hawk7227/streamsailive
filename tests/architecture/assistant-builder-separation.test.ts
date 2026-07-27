// @vitest-environment node

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const REQUIRED_ASSISTANT_TOOLS = [
  "web_search",
  "run_verification",
  "generate_media",
  "generate_song",
  "generate_voice",
  "search_files",
  "list_conversation_artifacts",
  "list_workspace_files",
  "read_workspace_file",
  "write_workspace_file",
  "apply_workspace_patch",
  "run_workspace_command",
  "send_workspace_action",
  "build_workspace",
] as const;

describe("assistant and builder separation", () => {
  it("keeps the authoritative chat conversational and free of builder activity cards", () => {
    const chat = source("src/components/streams-builder/ActualBuilderSessionChat.tsx");
    expect(chat).toContain('placeholder="Ask anything"');
    expect(chat).not.toContain("BUILDER_AGENT_COMMUNICATION_EVENT");
    expect(chat).not.toContain("Builder agent");
    expect(chat).not.toContain("agentFeed");
  });

  it("does not dispatch raw user messages directly to the builder engine", () => {
    const chat = source("src/components/streams-builder/ActualBuilderSessionChat.tsx");
    expect(chat).not.toContain('dispatchEvent(new CustomEvent("streams:authoritative-chat-command"');
    expect(chat).toContain('fetch("/api/streams-ai/messages"');
  });

  it("keeps structured engineering activity in the builder presence bridge", () => {
    const presence = source("src/components/streams-builder/BuilderAgentPresenceBridge.tsx");
    expect(presence).toContain("emitBuilderAgentCommunication");
    expect(presence).toContain('window.addEventListener("streams-builder:runtime-job"');
    expect(presence).toContain('window.addEventListener("streams-builder-summary-event"');
  });

  it("routes build intent through the assistant API before execution", () => {
    const route = source("src/app/api/streams-ai/messages/route.ts");
    expect(route).toContain("routeProductIntent(userContent)");
    expect(route).toContain("return builderResponse(request, authoritativeBody, userContent)");
    expect(route).toContain("executeWebsiteBuild");
  });
});

describe("Streams company capability integrity", () => {
  it("keeps the restored human-like Streams identity on the fast conversation path", () => {
    const route = source("src/app/api/streams-ai/messages/route.ts");
    expect(route).toContain("the unified intelligence and creation assistant from Streams");
    expect(route).toContain("ask a question only when the missing answer would materially change the result");
    expect(route).toContain("Never expose or announce internal modes");
    expect(route).toContain("Codex, Claude Code, Gemini CLI, and Cursor Agent");
    expect(route).toContain("image, video, voice, music, and cinematic creation");
    expect(route).not.toContain('const FAST_SYSTEM_PROMPT = [\n  "You are Streams AI, a capable and direct AI assistant."');
  });

  it("attaches the complete capability brain to every assistant-core route", () => {
    const context = source("src/lib/assistant-core/context.ts");
    const brain = source("src/lib/assistant-core/capabilityIndustryBrain.ts");

    expect(context).toContain("appendCapabilityIndustryBrain(");
    expect(context).toContain("buildSystemPromptBase(input.route, input.userText)");
    expect(context).toContain("buildCapabilityIndustryBrainPrompt(route)");

    expect(brain).toContain("buildMaxKnowledgeRegistryPrompt()");
    expect(brain).toContain("buildInternalCapabilityEnginePrompt()");
    expect(brain).toContain("buildProviderCapabilityPrompt()");
    expect(brain).toContain("buildPracticalCapabilityPrompt()");
    expect(brain).toContain("buildWorldClassExecutionPrompt()");
    expect(brain).toContain("Live Streams readiness map");
  });

  it("preserves the major assistant, builder, and generation capability classes", () => {
    const brain = source("src/lib/assistant-core/capabilityIndustryBrain.ts");
    const engines = source("src/lib/assistant-core/internalCapabilityEngines.ts");

    for (const capability of [
      "conversation, planning, research-style reasoning",
      "repository execution, source truth, file read/write",
      "browser verification",
      "GitHub/Vercel operations",
      "text-to-image",
      "image-to-video",
      "text-to-video",
      "voice/captions",
      "Creation Engine",
      "Movie / Long-Form Video Engine",
      "Song / Voice / Audio Engine",
      "Builder / System Creation Engine",
      "Repair / Troubleshooting Engine",
      "System Orchestration / Automation Engine",
    ]) {
      expect(`${brain}\n${engines}`).toContain(capability);
    }
  });

  it("keeps every advertised assistant tool both defined and executable", () => {
    const tools = source("src/lib/assistant-core/tools.ts");

    for (const tool of REQUIRED_ASSISTANT_TOOLS) {
      expect(tools).toContain(`name: "${tool}"`);
      expect(tools).toContain(`case "${tool}"`);
    }
  });

  it("keeps runtime readiness gates for chat, builder, image, video, voice, storage, and proof", () => {
    const readiness = source("src/lib/streams-builder/env-readiness.ts");

    for (const id of [
      "chat-core",
      "chat-uploads",
      "builder-repair-loop",
      "builder-github",
      "builder-vercel",
      "builder-proof",
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
      "supabase-core",
    ]) {
      expect(readiness).toContain(`"${id}"`);
    }
  });

  it("does not claim exact vendor connectivity where an exact adapter is absent", () => {
    const providers = source("src/lib/assistant-core/providerCapabilityRegistry.ts");

    for (const id of [
      "luma-pika-sora-style",
      "midjourney-firefly-stability",
      "heygen-synthesia-descript",
    ]) {
      const start = providers.indexOf(`id: "${id}"`);
      expect(start).toBeGreaterThan(-1);
      const block = providers.slice(start, providers.indexOf("},", start) + 2);
      expect(block).toContain('streamsStatus: "adapter_needed"');
    }
  });
});
