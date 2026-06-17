import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/components/streams-builder/agent-one-state-controller.ts",
  "src/components/streams-builder/agent-one-state-controller.test.ts",
  "src/components/streams-builder/AgentOneWorkstation.tsx",
];

const requiredWorkstationMarkers = [
  "verifyAgentOneWorkspaceState",
  "getAgentOneRepairPlan",
  "Repair + Test",
  "Push blocked",
  "Source-backed Agent",
  "verification.canPush",
  "writeTarget",
  "activeWorkFile",
  "openedFile",
];

const requiredControllerMarkers = [
  "wrong-file-open",
  "wrong-route-preview",
  "stale-pulled-file",
  "missing-sha",
  "preview-blank",
  "build-failed",
  "route-mismatch",
  "component-mismatch",
  "write-target-mismatch",
  "block-push",
  "verifyAgentOneWorkspaceState",
  "getAgentOneRepairPlan",
];

function fail(message) {
  console.error(`Agent 1 self-test failed: ${message}`);
  process.exit(1);
}

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) fail(`missing required file ${file}`);
}

const workstation = readFileSync(join(root, "src/components/streams-builder/AgentOneWorkstation.tsx"), "utf8");
const controller = readFileSync(join(root, "src/components/streams-builder/agent-one-state-controller.ts"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

for (const marker of requiredWorkstationMarkers) {
  if (!workstation.includes(marker)) fail(`AgentOneWorkstation missing marker ${marker}`);
}

for (const marker of requiredControllerMarkers) {
  if (!controller.includes(marker)) fail(`agent-one-state-controller missing marker ${marker}`);
}

if (!packageJson.scripts?.build) fail("package.json missing build script");
if (!packageJson.scripts?.test) fail("package.json missing test script");
if (!packageJson.scripts?.["streams:agent-one-self-test"]) fail("package.json missing streams:agent-one-self-test script");

console.log("Agent 1 self-test passed: source-backed controller, repair gate, push block, tests, build script, and test script are present.");
