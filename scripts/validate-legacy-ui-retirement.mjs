#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const retiredPaths = [
  ".github/workflows/enforce-streams-auth-shell.yml",
  ".github/workflows/universal-workspace-verify.yml",
  "docs/merge-policies/universal-project-workspace-replacement-slice.md",
  "docs/streams-builder/personal-use-integration-capability-audit.md",
  "scripts/build-personal-use-merged-builder.ps1",
  "scripts/fix-streams-ai-mobile-source-truth.js",
  "scripts/restore-builder-dropdowns-only.ps1",
  "scripts/scope-guard.mjs",
  "src/app/streams-ai/streams-builder/workspace-grid.css",
  "src/app/streams-ai/streams-builder/workspace-offset.css",
  "src/components/streams-builder/BuilderExistingChatMount.jsx",
  "tests/streams-chat-builder-style.test.tsx",
  "tests/streams-workspace-preservation-contract.test.ts",
  "tests/streams-workspace-shell-contract.test.tsx",
];

const forbiddenRestoreMarkers = [
  "restore-builder-dropdowns-only.ps1",
  "build-personal-use-merged-builder.ps1",
  "BuilderExistingChatMount",
  "workspace-offset.css",
  "workspace-grid.css",
  "preserved-workspace-grid",
  "Existing editors are combined, not rebuilt.",
  "No legacy frontend surface may be removed before",
];

const scanRoots = ["src", "scripts", ".github", "docs", "tests"];
const textExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".css", ".md", ".yml", ".yaml", ".json", ".ps1"]);

function extension(path) {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index) : "";
}

function walk(path, files = []) {
  if (!existsSync(path)) return files;
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, files);
    else if (textExtensions.has(extension(full))) files.push(full);
  }
  return files;
}

const restored = retiredPaths.filter((path) => existsSync(join(root, path)));
const markerHits = [];

for (const scanRoot of scanRoots) {
  for (const file of walk(join(root, scanRoot))) {
    const rel = relative(root, file).replaceAll("\\", "/");
    if (rel === "scripts/validate-legacy-ui-retirement.mjs") continue;
    const source = readFileSync(file, "utf8");
    for (const marker of forbiddenRestoreMarkers) {
      if (source.includes(marker)) markerHits.push(`${rel}: ${marker}`);
    }
  }
}

if (restored.length || markerHits.length) {
  console.error("Legacy custom UI retirement guard failed.");
  if (restored.length) {
    console.error("Retired files were restored:");
    for (const path of restored) console.error(`- ${path}`);
  }
  if (markerHits.length) {
    console.error("Restore instructions or legacy preservation markers were reintroduced:");
    for (const hit of markerHits) console.error(`- ${hit}`);
  }
  process.exit(1);
}

console.log("Legacy custom UI retirement guard: PASS");
