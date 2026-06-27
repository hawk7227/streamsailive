import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const CRITICAL_FILES = [
  "src/lib/streams-builder/codex-repair-loop.ts",
  "src/lib/streams-builder/repository-execution.ts",
  "src/lib/streams-builder/repository-worker.ts",
  "src/app/api/streams-builder/repository-execution/route.ts",
  "src/components/streams-builder/BuilderCenterChat.tsx",
  "src/components/streams-ai/current-chat/runtime/streamsBuilderBridgeProof.js",
  "src/components/streams-ai/current-chat/runtime/streamsBuilderModeBridge.js",
  "src/app/streams-ai/StreamsAIBuilderProofBridge.jsx",
  "src/app/streams-ai/StreamsAIBuilderModeBridge.jsx",
  "src/app/streams-ai/page.tsx",
];

const FORBIDDEN_FAKE_MARKERS = [
  "TODO: fake",
  "fake implementation",
  "mock implementation",
  "placeholder only",
  "not implemented",
  "coming soon",
  "return null; // fake",
  "no-op placeholder",
];

describe("Codex and iPhone bridge real component audit", () => {
  it("keeps every critical Codex/iPhone bridge file present with production code", () => {
    for (const file of CRITICAL_FILES) {
      const content = readRepoFile(file);
      expect(content.length, file).toBeGreaterThan(120);
      for (const marker of FORBIDDEN_FAKE_MARKERS) {
        expect(content.toLowerCase(), file).not.toContain(marker.toLowerCase());
      }
    }
  });

  it("wires the iPhone chat command path into autonomous Codex repository execution", () => {
    const chat = readRepoFile("src/components/streams-builder/BuilderCenterChat.tsx");
    expect(chat).toContain("autonomousRepair: true");
    expect(chat).toContain("maxRepairAttempts: 3");
    expect(chat).toContain("requireApprovalBeforePush: true");
    expect(chat).toContain("Codex repair loop queued job");
  });

  it("wires the repository worker into the repair loop instead of failing once", () => {
    const worker = readRepoFile("src/lib/streams-builder/repository-worker.ts");
    expect(worker).toContain("runCodexRepairLoop");
    expect(worker).toContain("repository.codex.loop.started");
    expect(worker).toContain("createOpenAICodexRepairDiffGenerator");
    expect(worker).toContain("repairResult.repaired");
    expect(worker).toContain("continue;");
  });

  it("keeps push locked behind approval even when Codex repair succeeds", () => {
    const codex = readRepoFile("src/lib/streams-builder/codex-repair-loop.ts");
    const execution = readRepoFile("src/lib/streams-builder/repository-execution.ts");
    expect(codex).toContain("push remains locked until user approval");
    expect(codex).toContain("Approval-gated git write command cannot be auto-repaired or auto-pushed.");
    expect(execution).toContain("requireApprovalBeforePush");
  });
});
