// @vitest-environment node

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

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