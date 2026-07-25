import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { detectPackageManager, instructionCandidatePaths, loadRepositoryIntelligence } from "@/lib/streams-builder/repository-intelligence";
import { createRepositoryExecutionPlan } from "@/lib/streams-builder/repository-execution";

describe("repository intelligence", () => {
  it("loads scoped instructions from root to the target directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "streams-repo-intelligence-"));
    await mkdir(join(root, "src", "feature"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "root rules");
    await writeFile(join(root, "src", "AGENTS.override.md"), "src rules");
    await writeFile(join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0", scripts: { build: "next build", test: "vitest" } }));

    const intelligence = await loadRepositoryIntelligence({ workspaceDir: root, targetFiles: ["src/feature/page.tsx"] });

    expect(intelligence.packageManager).toBe("pnpm");
    expect(intelligence.buildCommand).toEqual(["pnpm", "build"]);
    expect(intelligence.instructions.map((entry) => entry.path)).toEqual(["AGENTS.md", "src/AGENTS.override.md"]);
    expect(intelligence.instructions.at(-1)?.content).toContain("src rules");
  });

  it("detects lockfile package managers when packageManager is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "streams-package-manager-"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "yarn.lock"), "");
    expect(await detectPackageManager(root)).toBe("yarn");
  });

  it("does not permit instruction discovery to escape the workspace", () => {
    expect(() => instructionCandidatePaths("/tmp/workspace", ["../secret.ts"])).toThrow(/escaped workspace/);
  });

  it("defaults repository jobs to resumable workspaces", () => {
    const plan = createRepositoryExecutionPlan({ projectId: "p1", sessionId: "s1", repoFullName: "owner/repo", requestedCommands: ["clone_repo"] });
    expect(plan.codexRepair.resumeWorkspace).toBe(true);
  });
});
