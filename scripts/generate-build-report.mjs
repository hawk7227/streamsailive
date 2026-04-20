/**
 * scripts/generate-build-report.mjs
 *
 * Generates public/build-report.json at build time.
 * Run via: node scripts/generate-build-report.mjs
 * Wired into package.json build script.
 *
 * Output is a static JSON file served at /build-report.json.
 * No secrets — env var presence only (not values).
 */

import { writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown";
  }
}

function gitBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT })
      .toString()
      .trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_REF ?? "unknown";
  }
}

const REQUIRED_VARS = ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL"];
const OPTIONAL_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE",
  "FAL_API_KEY",
  "ADMIN_SECRET_KEY",
  "RUNWAY_API_KEY",
  "KLING_API_KEY",
  "ELEVENLABS_API_KEY",
];

const envChecks = {
  required: REQUIRED_VARS.map((k) => ({
    key: k,
    present: !!process.env[k]?.trim(),
  })),
  optional: OPTIONAL_VARS.map((k) => ({
    key: k,
    present: !!process.env[k]?.trim(),
  })),
};

const missingRequired = envChecks.required.filter((e) => !e.present);

const report = {
  generatedAt: new Date().toISOString(),
  commit: gitSha(),
  branch: gitBranch(),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  env: envChecks,
  ok: missingRequired.length === 0,
  issues: missingRequired.map((e) => `Missing required env var: ${e.key}`),
};

const outPath = join(ROOT, "public", "build-report.json");
mkdirSync(join(ROOT, "public"), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

console.log(`[build-report] Written to ${outPath}`);
console.log(`[build-report] ok=${report.ok} commit=${report.commit.slice(0, 8)}`);
if (!report.ok) {
  console.error(`[build-report] ISSUES:\n  ${report.issues.join("\n  ")}`);
}
