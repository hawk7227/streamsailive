import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("iPhone chat builder prompt auto route", () => {
  it("intercepts builder prompts from supported chat endpoints", () => {
    const bridge = read("src/components/streams-ai/current-chat/runtime/streamsBuilderModeBridge.js");
    expect(bridge).toContain("isBuilderCommand");
    expect(bridge).toContain("inferConnection");
    expect(bridge).toContain("/api/ai-assistant");
    expect(bridge).toContain("/api/streams-ai/messages");
    expect(bridge).toContain("streams-builder-chat-command");
  });

  it("auto-connects standalone chat commands and queues Codex with route and prompt context", () => {
    const chat = read("src/components/streams-builder/BuilderCenterChat.tsx");
    expect(chat).toContain("iPhone chat auto-connected");
    expect(chat).toContain("runAgentOneText(data.message, \"local-form\")");
    expect(chat).toContain("userPrompt: prompt");
    expect(chat).toContain("route: detail.route");
    expect(chat).toContain("autonomousRepair: true");
  });
});
