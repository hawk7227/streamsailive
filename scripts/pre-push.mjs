#!/usr/bin/env node
/**
 * scripts/pre-push.mjs
 *
 * Phase 8 — Pre-Push Operator Workflow: Local Runner
 *
 * Runs every check required by BUILD_RULES.md before a push.
 * On success: commits + pushes + polls Vercel + reports status.
 * On failure: blocks the push and lists every violation.
 *
 * Usage:
 *   node scripts/pre-push.mjs
 *   node scripts/pre-push.mjs --message "feat(streams): your commit message"
 *   node scripts/pre-push.mjs --dry-run   (run checks, skip push)
 *   node scripts/pre-push.mjs --force     (push even if non-critical violations)
 *
 * Requires:
 *   STREAMS_API_URL  — e.g. https://streamsailive.vercel.app (or http://localhost:3000)
 *   STREAMS_API_TOKEN — a Supabase user session token (or omit for local dev)
 *
 * Steps:
 *   1. tsc --noEmit (streams/ filter)
 *   2. Untracked import check
 *   3. Repo root / branch / remote verify
 *   4. Pattern audit (BUILD_RULES)
 *   5. POST report to /api/streams/pre-push
 *   6. If allowed: git add -A, git commit, git push
 *   7. POST final report with pushedCommit
 *   8. Poll Vercel status
 */

import { execSync, spawnSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");

// ── CLI args ──────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes("--dry-run");
const FORCE       = args.includes("--force");
const MSG_IDX     = args.indexOf("--message");
const COMMIT_MSG  = MSG_IDX !== -1 ? args[MSG_IDX + 1] : null;
const API_URL     = process.env.STREAMS_API_URL ?? "https://streamsailive.vercel.app";
const API_TOKEN   = process.env.STREAMS_API_TOKEN ?? "";

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

function log(msg)    { console.log(msg); }
function ok(msg)     { console.log(C.green("✓") + " " + msg); }
function fail(msg)   { console.log(C.red("✗") + " " + msg); }
function warn(msg)   { console.log(C.yellow("⚠") + " " + msg); }
function info(msg)   { console.log(C.cyan("→") + " " + msg); }
function section(s)  { console.log("\n" + C.bold(s)); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", ...opts }).trim();
  } catch (e) {
    return null;
  }
}

function runLines(cmd) {
  const out = run(cmd);
  if (!out) return [];
  return out.split("\n").map(l => l.trim()).filter(Boolean);
}

// ── Step 1: TypeScript check ──────────────────────────────────────────────────

section("Step 1 — TypeScript");

const tscOut = run("npx tsc --noEmit 2>&1", { stdio: undefined }) ?? "";
const tscLines = tscOut.split("\n").filter(Boolean);

const STREAMS_DIRS = [
  "src/components/streams",
  "src/app/api/streams",
  "src/app/streams",
  "src/lib/streams",
  "src/lib/audit",
  "src/lib/connector",
  "src/lib/project-context",
  "next.config",
];

const TSC_IGNORE = [
  "TS7026", "next/server", "jsx-runtime", "navigation",
  "TS2503", "Cannot find module 'react'",
];

const tscErrors = [];
for (const line of tscLines) {
  const isStreams = STREAMS_DIRS.some(d => line.includes(d));
  const isIgnored = TSC_IGNORE.some(i => line.includes(i));
  const isError = line.includes(": error TS");
  if (isStreams && isError && !isIgnored) {
    // parse: file(line,col): error TSxxxx: message
    const m = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
    if (m) {
      tscErrors.push({ file: m[1], line: +m[2], col: +m[3], code: m[4], message: m[5] });
    }
  }
}

if (tscErrors.length === 0) {
  ok(`TypeScript — 0 errors in streams files`);
} else {
  fail(`TypeScript — ${tscErrors.length} error(s):`);
  tscErrors.slice(0, 5).forEach(e => fail(`  ${e.file}:${e.line} ${e.code}: ${e.message}`));
  if (tscErrors.length > 5) fail(`  ... and ${tscErrors.length - 5} more`);
}

// ── Step 2: Untracked imports ─────────────────────────────────────────────────

section("Step 2 — Untracked import check");

const untrackedAll = runLines("git status --short").filter(l => l.startsWith("??"));
const importedFiles = new Set();

// Scan streams source files for local imports
for (const dir of STREAMS_DIRS) {
  const dirPath = join(ROOT, dir);
  if (!existsSync(dirPath)) continue;
  try {
    const files = runLines(`find ${dir} -name "*.ts" -o -name "*.tsx"`);
    for (const f of files) {
      const fullPath = join(ROOT, f);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, "utf8");
      const importMatches = content.matchAll(/from\s+['"](@\/|\.\.?\/)([\w\/\-\.]+)['"]/g);
      for (const m of importMatches) {
        const rel = m[2];
        if (!rel.includes(".")) continue; // skip bare module names
        importedFiles.add(rel);
      }
    }
  } catch { /* skip */ }
}

const untrackedImports = untrackedAll
  .map(l => l.replace(/^\?\?\s+/, "").trim())
  .filter(f => {
    // Check if this untracked file is imported by anything
    for (const imp of importedFiles) {
      if (f.includes(imp) || imp.includes(f.replace(/\.(ts|tsx)$/, ""))) return true;
    }
    return false;
  });

if (untrackedImports.length === 0) {
  ok("No untracked imports found");
} else {
  fail(`${untrackedImports.length} untracked file(s) imported:`);
  untrackedImports.forEach(f => fail(`  ${f}`));
}

// ── Step 3: Repo verification ─────────────────────────────────────────────────

section("Step 3 — Repo verification");

const repoRoot = run("git rev-parse --show-toplevel");
const branch   = run("git branch --show-current");
const remote   = run("git remote get-url origin");
const headSha  = run("git rev-parse HEAD");

let repoOk = true;
if (!repoRoot || !repoRoot.includes("streamsailive")) {
  fail(`Wrong repo root: ${repoRoot}`); repoOk = false;
} else { ok(`Repo root: ${repoRoot}`); }

if (branch !== "main") {
  fail(`Wrong branch: ${branch} (expected: main)`); repoOk = false;
} else { ok(`Branch: main`); }

if (!remote || !remote.includes("hawk7227/streamsailive")) {
  fail(`Wrong remote: ${remote}`); repoOk = false;
} else { ok(`Remote: ${remote}`); }

// ── Step 4: Pattern audit ─────────────────────────────────────────────────────

section("Step 4 — BUILD_RULES pattern audit");

const auditFindings = [];

// Quick pattern checks inline (subset of full audit.py)
const PATTERN_CHECKS = [
  {
    rule: "Rule 4.1", severity: "critical",
    // Match background:C.acc inside a message bubble — must be on a div/span
    // that wraps msg.text, not on buttons or badges
    pattern: /(?:role.*user|userMsg|user-msg).*background:\s*C\.acc|background:\s*C\.acc.*(?:role.*user|userMsg|user-msg)/,
    dirs: ["src/components/streams/tabs/ChatTab"],
    message: "Chat bubble using accent color background — Rule 4.1",
  },
  {
    rule: "Rule 4.2", severity: "critical",
    // Match background+border on an AI message wrapper — must be adjacent to msg.role
    pattern: /(?:assistant|ai-msg|aiMsg).*(?:background:\s*C\.surf.*border|border.*background:\s*C\.surf)|(?:background:\s*C\.surf.*border.*1px|border.*1px.*background:\s*C\.surf).*(?:msg|message|assistant)/,
    dirs: ["src/components/streams/tabs/ChatTab"],
    message: "AI message card with background + border — Rule 4.2",
  },
  {
    rule: "Rule 4.3", severity: "critical",
    pattern: /role.*===.*['"](user|assistant)['"].*avatar|avatar.*role/,
    dirs: ["src/components/streams/tabs/ChatTab"],
    message: "Avatar circle in chat — Rule 4.3",
  },
  {
    rule: "Rule 2.3", severity: "critical",
    pattern: /overflowX:\s*['"]auto['"]/,
    dirs: ["src/components/streams/tabs/GenerateTab"],
    message: "Native scroll arrows on tab row — Rule 2.3",
  },
  {
    rule: "Rule 1.2", severity: "critical",
    pattern: /display:\s*['"]none['"]\s*!important/,
    dirs: ["src/components/streams/tabs/GenerateTab"],
    message: "Content hidden with display:none !important — Rule 1.2",
  },
  {
    rule: "Rule 7.1", severity: "high",
    pattern: /setTimeout\s*\(\s*\(\s*\)\s*=>\s*setState/,
    dirs: ["src/components/streams"],
    message: "setTimeout masking missing functionality — Rule 7.1",
  },
  {
    rule: "Rule 6.2", severity: "critical",
    pattern: /Shell data|shell data|coming soon|TODO/,
    dirs: ["src/components/streams"],
    message: "Developer/stub text in rendered UI — Rule 6.2",
  },
  {
    rule: "Rule 9.1", severity: "critical",
    pattern: /fontSize:\s*(10|11)(?!\d)/,
    dirs: ["src/components/streams"],
    message: "Font size below 12px floor — Rule 9.1",
  },
];

for (const check of PATTERN_CHECKS) {
  for (const dir of check.dirs) {
    const dirPath = join(ROOT, dir + ".tsx");
    const altPath = join(ROOT, dir);
    const paths = existsSync(dirPath) ? [dirPath] : [];
    if (existsSync(altPath)) {
      const found = runLines(`find ${altPath} -name "*.tsx" -o -name "*.ts" 2>/dev/null`);
      paths.push(...found.map(f => join(ROOT, f)).filter(p => existsSync(p)));
    }

    for (const filePath of paths) {
      try {
        const content = readFileSync(filePath, "utf8");
        const contentLines = content.split("\n");
        contentLines.forEach((line, idx) => {
          if (check.pattern.test(line)) {
            auditFindings.push({
              rule:     check.rule,
              file:     filePath.replace(ROOT + "/", ""),
              line:     idx + 1,
              message:  check.message,
              severity: check.severity,
            });
          }
        });
      } catch { /* skip */ }
    }
  }
}

// Also run audit.py if it exists
const auditPy = join(ROOT, "scripts", "audit.py");
if (existsSync(auditPy)) {
  const pyResult = spawnSync("python3", [auditPy], { cwd: ROOT, encoding: "utf8" });
  if (pyResult.stdout) {
    const pyLines = pyResult.stdout.split("\n").filter(l => l.includes("[FAIL]"));
    for (const line of pyLines) {
      const m = line.match(/\[FAIL\]\s+(Rule\s+[\w.]+)\s+(.+?):(\d+)?\s*—\s*(.+)/);
      if (m) {
        auditFindings.push({
          rule: m[1], file: m[2], line: m[3] ? +m[3] : undefined,
          message: m[4], severity: "critical",
        });
      }
    }
  }
}

const criticalFindings = auditFindings.filter(f => f.severity === "critical");
const highFindings     = auditFindings.filter(f => f.severity === "high");

if (auditFindings.length === 0) {
  ok("Pattern audit — 0 violations");
} else {
  if (criticalFindings.length > 0) {
    fail(`Pattern audit — ${criticalFindings.length} critical, ${highFindings.length} high violations:`);
    criticalFindings.forEach(f => fail(`  [${f.rule}] ${f.file}${f.line ? `:${f.line}` : ""} — ${f.message}`));
  } else {
    warn(`Pattern audit — ${highFindings.length} high violations (non-blocking):`);
    highFindings.forEach(f => warn(`  [${f.rule}] ${f.file} — ${f.message}`));
  }
}

// ── Determine if push is allowed ──────────────────────────────────────────────

section("Summary");

const hasCritical = tscErrors.length > 0 || untrackedImports.length > 0 || criticalFindings.length > 0;
const stagedFiles = runLines("git status --short").filter(l => !l.startsWith("??")).map(l => l.slice(3));
const lastCommitMsg = run("git log -1 --pretty=%s") ?? "";

if (hasCritical && !FORCE) {
  fail(C.bold("PUSH BLOCKED — resolve critical violations before pushing."));
  fail("Run with --force to push anyway (not recommended).");
  log("");
} else {
  if (hasCritical && FORCE) {
    warn("Forcing push despite violations (--force flag).");
  } else {
    ok(C.bold("All checks passed."));
  }
}

// ── POST initial report ───────────────────────────────────────────────────────

const report = {
  branch:          branch ?? "unknown",
  remote:          remote ?? "unknown",
  headCommit:      headSha ?? "unknown",
  commitMessage:   COMMIT_MSG ?? lastCommitMsg,
  tscErrors,
  untrackedImports,
  auditFindings,
  stagedFiles,
  pushed:          false,
};

let pushedCommit = null;
let pushError    = null;

// ── Step 5: Commit + Push ─────────────────────────────────────────────────────

if (!DRY_RUN && (!hasCritical || FORCE)) {
  section("Step 5 — Commit + Push");

  const msg = COMMIT_MSG ?? (() => {
    // Auto-generate commit message from staged files
    const files = stagedFiles.slice(0, 3).map(f => f.split("/").pop()).join(", ");
    return `chore: pre-push auto-commit (${files})`;
  })();

  // Stage all changes
  run("git add -A");

  // Check if there's anything to commit
  const status = run("git status --short");
  if (!status || status.trim() === "") {
    warn("Nothing to commit — working tree clean.");
  } else {
    const commitResult = run(`git commit -m ${JSON.stringify(msg)} 2>&1`);
    if (!commitResult) {
      pushError = "git commit failed";
      fail("Commit failed.");
    } else {
      ok(`Committed: ${msg}`);
    }
  }

  if (!pushError) {
    info("Pushing to origin main...");
    const pushResult = spawnSync("git", ["push", "origin", "main"], {
      cwd: ROOT, encoding: "utf8",
    });

    if (pushResult.status !== 0) {
      pushError = pushResult.stderr ?? "git push failed";
      fail(`Push failed: ${pushError}`);
    } else {
      pushedCommit = run("git rev-parse HEAD");
      ok(`Pushed — ${pushedCommit?.slice(0, 8)}`);
    }
  }
}

// ── Step 6: Report to API ─────────────────────────────────────────────────────

section("Step 6 — Recording results");

const finalReport = {
  ...report,
  pushed:       !!pushedCommit && !pushError,
  pushedCommit: pushedCommit ?? undefined,
  pushError:    pushError ?? undefined,
};

try {
  const headers = { "Content-Type": "application/json" };
  if (API_TOKEN) headers["Authorization"] = `Bearer ${API_TOKEN}`;

  const res = await fetch(`${API_URL}/api/streams/pre-push`, {
    method:  "POST",
    headers,
    body:    JSON.stringify(finalReport),
  });

  if (res.ok) {
    const result = await res.json();
    ok("Report recorded.");

    if (result.vercelStatus) {
      info(`Vercel: ${result.vercelStatus}${result.vercelUrl ? ` — ${result.vercelUrl}` : ""}`);
    }

    // ── Step 7: Poll Vercel ──────────────────────────────────────────────────
    if (result.deploymentId && result.vercelStatus === "building") {
      section("Step 7 — Polling Vercel");
      info("Waiting for deployment...");

      let polls = 0;
      const maxPolls = 24; // 24 × 5s = 2 minutes
      while (polls < maxPolls) {
        await new Promise(r => setTimeout(r, 5000));
        polls++;

        const pollRes = await fetch(
          `${API_URL}/api/streams/pre-push?deploymentId=${result.deploymentId}`,
          { headers }
        );
        if (!pollRes.ok) break;

        const pollData = await pollRes.json();
        const state = pollData.state ?? "unknown";

        if (state === "ready") {
          ok(`Vercel READY — ${pollData.url ?? result.vercelUrl}`);
          break;
        } else if (state === "error") {
          fail(`Vercel ERROR — check ${result.vercelUrl ?? "vercel.com"}`);
          break;
        } else {
          process.stdout.write(`\r  ${C.dim(`Polling... ${state} (${polls * 5}s)`)}`);
        }
      }
      log("");
    }
  } else {
    warn(`API returned ${res.status} — results not recorded remotely.`);
  }
} catch (err) {
  warn(`Could not reach API (${API_URL}): ${err.message}`);
  warn("Results not recorded. Push still happened.");
}

// ── Final exit ────────────────────────────────────────────────────────────────

log("");
if (hasCritical && !FORCE) {
  log(C.red(C.bold("BLOCKED. Fix violations above before pushing.")));
  process.exit(1);
} else if (pushError) {
  log(C.red(C.bold(`Push failed: ${pushError}`)));
  process.exit(1);
} else if (DRY_RUN) {
  log(C.yellow("Dry run complete — no push made."));
  process.exit(0);
} else {
  log(C.green(C.bold("Done. ✓")));
  process.exit(0);
}
