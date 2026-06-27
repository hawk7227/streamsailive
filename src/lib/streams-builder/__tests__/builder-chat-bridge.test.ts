import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildConnectionContext, getWorkstationContract } from "@/components/streams-builder/builderSystemContract";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("iPhone chat to workstation bridge contract", () => {
  it("builds a Visual Editing connection with source truth and editing capabilities", () => {
    const connection = buildConnectionContext("Visual Editing", {
      repo: "hawk7227/patientpanel",
      branch: "master",
      path: "src/app/page.tsx",
      route: "/",
      sha: "abc123",
    });

    expect(connection.connected).toBe(true);
    expect(connection.activeWorkstationId).toBe("visual-editing");
    expect(connection.activeWorkstationName).toBe("Visual Editing");
    expect(connection.capabilities).toContain("runtime_react_preview");
    expect(connection.capabilities).toContain("edit_code");
    expect(connection.capabilities).toContain("patch_preview");
    expect(connection.capabilities).toContain("push_after_approval");
    expect(connection.source).toEqual({
      repo: "hawk7227/patientpanel",
      branch: "master",
      filePath: "src/app/page.tsx",
      route: "/",
      sha: "abc123",
    });
  });

  it("keeps Visual Editing, Approval Center, and Browser Verification as real workstation contracts", () => {
    expect(getWorkstationContract("Visual Editing").requiredProofBeforeDone).toContain("Staged React preview rendered from patch");
    expect(getWorkstationContract("Approval Center").capabilities).toContain("push_after_approval");
    expect(getWorkstationContract("Browser Verification").capabilities).toContain("browser_verify");
  });

  it("mounts the proof bridge in the Streams AI page", () => {
    const page = readRepoFile("src/app/streams-ai/page.tsx");
    expect(page).toContain("StreamsAIBuilderModeBridge");
    expect(page).toContain("StreamsAIBuilderProofBridge");
  });

  it("supports a real ping-pong proof between BuilderCenterChat and the iPhone frame", () => {
    const builderChat = readRepoFile("src/components/streams-builder/BuilderCenterChat.tsx");
    const proofBridge = readRepoFile("src/components/streams-ai/current-chat/runtime/streamsBuilderBridgeProof.js");

    expect(builderChat).toContain("streams-builder-bridge-ping");
    expect(builderChat).toContain("streams-builder-bridge-pong");
    expect(builderChat).toContain("Test Bridge");
    expect(builderChat).toContain("Bridge proof passed");

    expect(proofBridge).toContain("streams-builder-bridge-ping");
    expect(proofBridge).toContain("streams-builder-bridge-pong");
    expect(proofBridge).toContain("iphone-chat-frame");
  });

  it("routes iPhone chat commands only through an active workstation connection and into Codex queueing", () => {
    const builderChat = readRepoFile("src/components/streams-builder/BuilderCenterChat.tsx");
    const modeBridge = readRepoFile("src/components/streams-ai/current-chat/runtime/streamsBuilderModeBridge.js");

    expect(modeBridge).toContain("streams-builder-chat-command");
    expect(modeBridge).toContain("connection?.connected");
    expect(modeBridge).toContain("connection?.activeWorkstationId");

    expect(builderChat).toContain("iphone-chat-to-codex-workstation");
    expect(builderChat).toContain("autonomousRepair: true");
    expect(builderChat).toContain("Blocked iPhone command: no active workstation connection or stale connection.");
    expect(builderChat).toContain("streams-builder-summary-event");
  });
});
