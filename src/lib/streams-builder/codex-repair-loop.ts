import { createHash } from "node:crypto";

export type CodexRepairFailureKind =
  | "typescript"
  | "eslint"
  | "module-resolution"
  | "build"
  | "test"
  | "runtime"
  | "database"
  | "security"
  | "unknown";

export type CodexRepairPolicy = {
  autonomousRepair: boolean;
  maxAttempts: number;
  maxFilesTouched: number;
  allowedCommands: string[];
  runBuildAfterPatch: boolean;
  requireApprovalBeforePush: boolean;
};

export type CodexRepairAttempt = {
  attempt: number;
  status: "patch_generated" | "patch_applied" | "patch_rejected" | "rerun_passed" | "rerun_failed" | "no_patch" | "no_progress" | "blocked";
  failureKind: CodexRepairFailureKind;
  command: string;
  message: string;
  patch?: string;
  stdout?: string;
  stderr?: string;
};

export type CodexRepairResult = {
  repaired: boolean;
  blocked: boolean;
  attempts: CodexRepairAttempt[];
  proof: string[];
  unproven: string[];
  finalError?: string;
};

export type CodexRepairLoopInput = {
  failedCommand: string;
  stdout?: string;
  stderr?: string;
  targetFiles: string[];
  permittedFiles?: string[];
  policy: CodexRepairPolicy;
  contextProvider?: (input: { attempt: number; stdout: string; stderr: string }) => Promise<string> | string;
  generatePatch: (input: CodexRepairGeneratePatchInput) => Promise<string | null>;
  applyPatch: (patch: string, attempt: number) => Promise<CodexRepairCommandResult>;
  rerunCommand: (attempt: number) => Promise<CodexRepairCommandResult>;
  emit?: (event: CodexRepairAttempt) => Promise<void> | void;
};

export type CodexRepairGeneratePatchInput = {
  attempt: number;
  failedCommand: string;
  failureKind: CodexRepairFailureKind;
  stdout: string;
  stderr: string;
  targetFiles: string[];
  repositoryContext?: string;
  previousPatchFingerprints?: string[];
};

export type CodexRepairCommandResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
};

export type UnifiedDiffValidation = {
  valid: boolean;
  files: string[];
  errors: string[];
};

const DEFAULT_ALLOWED_COMMANDS = ["npm_run_build", "apply_unified_diff", "git_status", "git_diff"];

function normalizedPath(value: string) {
  return value.replace(/^([ab]\/)+/, "").replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function patchFingerprint(patch: string) {
  return createHash("sha256").update(patch.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 20);
}

export function validateUnifiedDiffPatch(patch: string, policy: CodexRepairPolicy, permittedFiles: string[] = []): UnifiedDiffValidation {
  const errors: string[] = [];
  const files: string[] = [];
  const allowed = new Set(permittedFiles.map(normalizedPath).filter(Boolean));
  const lines = patch.replace(/\r\n/g, "\n").split("\n");

  if (!patch.startsWith("diff --git ")) errors.push("Patch must start with a git unified-diff header.");
  if (/^GIT binary patch$/m.test(patch) || /^Binary files /m.test(patch)) errors.push("Binary patches are not allowed.");

  for (const line of lines) {
    if (!line.startsWith("diff --git ")) continue;
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (!match) {
      errors.push(`Invalid diff header: ${line.slice(0, 180)}`);
      continue;
    }
    const left = normalizedPath(match[1]);
    const right = normalizedPath(match[2]);
    if (left !== right) errors.push(`Rename or cross-file patch is not allowed: ${left} -> ${right}`);
    const path = right;
    if (!path || path.startsWith("/") || path.includes("../") || path.includes("\0")) errors.push(`Unsafe patch path: ${path || "empty"}`);
    if (/^(node_modules|\.git|\.next|dist|build|coverage)\//.test(path)) errors.push(`Generated or protected path cannot be patched: ${path}`);
    if (!files.includes(path)) files.push(path);
  }

  if (!files.length) errors.push("Patch does not declare any changed files.");
  if (files.length > policy.maxFilesTouched) errors.push(`Patch touches ${files.length} files; policy permits ${policy.maxFilesTouched}.`);
  if (allowed.size > 0) {
    for (const file of files) if (!allowed.has(file)) errors.push(`Patch targets unverified file outside the grounded repair scope: ${file}`);
  }
  return { valid: errors.length === 0, files, errors };
}

export function createCodexRepairPolicy(input?: Partial<CodexRepairPolicy>): CodexRepairPolicy {
  const maxAttempts = Math.min(Math.max(Math.floor(input?.maxAttempts ?? 3), 0), 5);
  const maxFilesTouched = Math.min(Math.max(Math.floor(input?.maxFilesTouched ?? 4), 1), 12);
  return {
    autonomousRepair: input?.autonomousRepair === true,
    maxAttempts,
    maxFilesTouched,
    allowedCommands: input?.allowedCommands?.length ? input.allowedCommands : DEFAULT_ALLOWED_COMMANDS,
    runBuildAfterPatch: input?.runBuildAfterPatch !== false,
    requireApprovalBeforePush: input?.requireApprovalBeforePush !== false,
  };
}

export function classifyCodexFailure(stdout = "", stderr = ""): CodexRepairFailureKind {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  if (/permission denied|row.level security|rls|sqlstate|postgres|supabase|relation .* does not exist/.test(text)) return "database";
  if (/vulnerab|security|csrf|xss|injection|unauthorized|forbidden|secret|credential/.test(text)) return "security";
  if (/cannot find module|module not found|failed to resolve|can't resolve/.test(text)) return "module-resolution";
  if (/typescript|ts\(|type error|typeerror|is not assignable|property .* does not exist/.test(text)) return "typescript";
  if (/eslint|lint/.test(text)) return "eslint";
  if (/vitest|jest|playwright|test failed|assertionerror|expect\(/.test(text)) return "test";
  if (/uncaught|runtime error|referenceerror|rangeerror|syntaxerror/.test(text)) return "runtime";
  if (/next build|compiled|build failed|failed to compile|npm run build|pnpm build/.test(text)) return "build";
  return "unknown";
}

export function validateCodexRepairPolicy(policy: CodexRepairPolicy, failedCommand: string, targetFiles: string[]) {
  const blocked: string[] = [];
  if (!policy.autonomousRepair) blocked.push("autonomousRepair is false.");
  if (policy.maxAttempts < 1) blocked.push("maxAttempts must be at least 1.");
  if (!policy.allowedCommands.includes(failedCommand)) blocked.push(`Command ${failedCommand} is not allowed for autonomous repair.`);
  if (targetFiles.length > policy.maxFilesTouched) blocked.push(`targetFiles exceeds maxFilesTouched (${policy.maxFilesTouched}).`);
  if (policy.requireApprovalBeforePush && ["git_add_specific_file", "git_commit", "git_push"].includes(failedCommand)) blocked.push("Approval-gated git write command cannot be auto-repaired or auto-pushed.");
  return blocked;
}

async function emitAttempt(input: CodexRepairLoopInput, attempt: CodexRepairAttempt) {
  await input.emit?.(attempt);
}

export async function runCodexRepairLoop(input: CodexRepairLoopInput): Promise<CodexRepairResult> {
  let currentStdout = input.stdout || "";
  let currentStderr = input.stderr || "";
  let failureKind = classifyCodexFailure(currentStdout, currentStderr);
  const policyBlocks = validateCodexRepairPolicy(input.policy, input.failedCommand, input.targetFiles);
  const attempts: CodexRepairAttempt[] = [];
  const proof = ["Codex repair loop evaluated failure logs", `failure classified as ${failureKind}`];
  const unproven: string[] = [];
  const fingerprints = new Set<string>();

  if (policyBlocks.length) {
    const blockedAttempt: CodexRepairAttempt = { attempt: 0, status: "blocked", failureKind, command: input.failedCommand, message: policyBlocks.join(" "), stdout: currentStdout, stderr: currentStderr };
    attempts.push(blockedAttempt);
    await emitAttempt(input, blockedAttempt);
    return { repaired: false, blocked: true, attempts, proof, unproven: policyBlocks, finalError: policyBlocks.join(" ") };
  }

  const permittedFiles = (input.permittedFiles?.length ? input.permittedFiles : input.targetFiles).map(normalizedPath).filter(Boolean);

  for (let attempt = 1; attempt <= input.policy.maxAttempts; attempt += 1) {
    const repositoryContext = await input.contextProvider?.({ attempt, stdout: currentStdout, stderr: currentStderr });
    const patch = await input.generatePatch({
      attempt,
      failedCommand: input.failedCommand,
      failureKind,
      stdout: currentStdout,
      stderr: currentStderr,
      targetFiles: input.targetFiles,
      repositoryContext: repositoryContext || "",
      previousPatchFingerprints: [...fingerprints],
    });

    if (!patch?.trim()) {
      const noPatch: CodexRepairAttempt = { attempt, status: "no_patch", failureKind, command: input.failedCommand, message: "No grounded repair patch generated." };
      attempts.push(noPatch);
      await emitAttempt(input, noPatch);
      unproven.push(`repair attempt ${attempt} generated no patch`);
      continue;
    }

    const fingerprint = patchFingerprint(patch);
    if (fingerprints.has(fingerprint)) {
      const duplicate: CodexRepairAttempt = { attempt, status: "no_progress", failureKind, command: input.failedCommand, message: `Repair attempt ${attempt} repeated an earlier patch and was stopped.`, patch };
      attempts.push(duplicate);
      await emitAttempt(input, duplicate);
      unproven.push(`repair attempt ${attempt} repeated patch ${fingerprint}`);
      break;
    }
    fingerprints.add(fingerprint);

    const validation = validateUnifiedDiffPatch(patch, input.policy, permittedFiles);
    if (!validation.valid) {
      const rejected: CodexRepairAttempt = { attempt, status: "patch_rejected", failureKind, command: input.failedCommand, message: `Repair patch rejected: ${validation.errors.join(" ")}`, patch };
      attempts.push(rejected);
      await emitAttempt(input, rejected);
      currentStderr = `${currentStderr}\nPATCH_VALIDATION_REJECTED: ${validation.errors.join("; ")}`.slice(-24000);
      unproven.push(`repair attempt ${attempt} failed patch safety validation`);
      continue;
    }

    const generated: CodexRepairAttempt = { attempt, status: "patch_generated", failureKind, command: input.failedCommand, message: `Repair attempt ${attempt} generated a grounded patch for ${validation.files.join(", ")}.`, patch };
    attempts.push(generated);
    proof.push(`repair attempt ${attempt} generated validated patch ${fingerprint}`);
    await emitAttempt(input, generated);

    const applyResult = await input.applyPatch(patch, attempt);
    const applied: CodexRepairAttempt = { attempt, status: applyResult.ok ? "patch_applied" : "rerun_failed", failureKind, command: "apply_unified_diff", message: applyResult.ok ? `Repair attempt ${attempt} patch applied.` : `Repair attempt ${attempt} patch failed to apply.`, stdout: applyResult.stdout, stderr: applyResult.stderr };
    attempts.push(applied);
    await emitAttempt(input, applied);

    if (!applyResult.ok) {
      currentStdout = applyResult.stdout || currentStdout;
      currentStderr = applyResult.stderr || currentStderr;
      failureKind = classifyCodexFailure(currentStdout, currentStderr);
      unproven.push(`repair attempt ${attempt} patch failed to apply`);
      continue;
    }

    proof.push(`repair attempt ${attempt} patch applied`);
    const rerun = await input.rerunCommand(attempt);
    const rerunAttempt: CodexRepairAttempt = { attempt, status: rerun.ok ? "rerun_passed" : "rerun_failed", failureKind, command: input.failedCommand, message: rerun.ok ? `Repair attempt ${attempt} fixed ${input.failedCommand}.` : `Repair attempt ${attempt} did not fix ${input.failedCommand}; the next attempt will use the new failure evidence.`, stdout: rerun.stdout, stderr: rerun.stderr };
    attempts.push(rerunAttempt);
    await emitAttempt(input, rerunAttempt);

    if (rerun.ok) {
      proof.push(`repair attempt ${attempt} rerun passed`);
      if (input.policy.requireApprovalBeforePush) unproven.push("push remains locked until user approval");
      return { repaired: true, blocked: false, attempts, proof, unproven };
    }

    currentStdout = rerun.stdout || "";
    currentStderr = rerun.stderr || "";
    failureKind = classifyCodexFailure(currentStdout, currentStderr);
    unproven.push(`repair attempt ${attempt} rerun failed as ${failureKind}`);
  }

  return { repaired: false, blocked: false, attempts, proof, unproven, finalError: `Codex repair loop exhausted bounded attempts without a passing rerun.` };
}

export function createStaticRepairDiffGenerator(repairDiffs: string[] = []) {
  return async function staticRepairDiffGenerator(input: CodexRepairGeneratePatchInput) {
    return repairDiffs[input.attempt - 1] || null;
  };
}

function extractOutputText(payload: unknown): string {
  const root = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> };
  if (typeof root?.output_text === "string") return root.output_text;
  const parts: string[] = [];
  for (const item of root?.output || []) for (const content of item.content || []) if (typeof content.text === "string") parts.push(content.text);
  return parts.join("\n");
}

export function createOpenAICodexRepairDiffGenerator(options?: { model?: string; apiKey?: string }) {
  return async function openAICodexRepairDiffGenerator(input: CodexRepairGeneratePatchInput) {
    const apiKey = options?.apiKey || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return null;
    const model = options?.model || process.env.OPENAI_CODEX_REPAIR_MODEL || process.env.OPENAI_MODEL || "gpt-4.1";
    const prompt = [
      "You are the Streams Builder principal repair agent operating inside a verified repository sandbox.",
      "Return ONLY one valid git unified diff. Never return markdown fences, explanations, speculative files, broad rewrites, disabled checks, or weakened tests.",
      "Use only the repository context supplied below. Preserve architecture, public APIs, security boundaries, data integrity, accessibility, and existing behavior unless the user request requires a change.",
      "Prefer the smallest causal fix. Do not hide errors with any, ts-ignore, skipped tests, empty catches, hard-coded credentials, fake success, or fallback data.",
      `Attempt: ${input.attempt}`,
      `Failed command: ${input.failedCommand}`,
      `Failure kind: ${input.failureKind}`,
      `Grounded target files: ${input.targetFiles.join(", ") || "repository context must identify the exact file"}`,
      `Previously rejected or failed patch fingerprints: ${(input.previousPatchFingerprints || []).join(", ") || "none"}`,
      "REPOSITORY CONTEXT:",
      (input.repositoryContext || "No repository context was available; return no patch.").slice(0, 60000),
      "LATEST STDOUT:",
      input.stdout.slice(-16000),
      "LATEST STDERR:",
      input.stderr.slice(-20000),
      "Produce a minimal patch that addresses the latest causal failure and remains within the grounded file scope.",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: prompt, store: false }),
    });

    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const text = extractOutputText(payload).trim();
    return text.startsWith("diff --git") ? text : null;
  };
}
