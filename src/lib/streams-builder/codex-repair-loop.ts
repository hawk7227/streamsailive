export type CodexRepairFailureKind =
  | "typescript"
  | "eslint"
  | "module-resolution"
  | "build"
  | "test"
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
  status: "patch_generated" | "patch_applied" | "rerun_passed" | "rerun_failed" | "no_patch" | "blocked";
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
  policy: CodexRepairPolicy;
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
};

export type CodexRepairCommandResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
};

const DEFAULT_ALLOWED_COMMANDS = ["npm_run_build", "apply_unified_diff", "git_status", "git_diff"];

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
  if (/cannot find module|module not found|failed to resolve|can't resolve/.test(text)) return "module-resolution";
  if (/typescript|ts\(|type error|typeerror|is not assignable|property .* does not exist/.test(text)) return "typescript";
  if (/eslint|lint/.test(text)) return "eslint";
  if (/vitest|jest|test failed|assertionerror|expect\(/.test(text)) return "test";
  if (/next build|compiled|build failed|failed to compile|npm run build/.test(text)) return "build";
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
  const failureKind = classifyCodexFailure(input.stdout || "", input.stderr || "");
  const policyBlocks = validateCodexRepairPolicy(input.policy, input.failedCommand, input.targetFiles);
  const attempts: CodexRepairAttempt[] = [];
  const proof = ["Codex repair loop evaluated failure logs", `failure classified as ${failureKind}`];
  const unproven: string[] = [];

  if (policyBlocks.length) {
    const blockedAttempt: CodexRepairAttempt = {
      attempt: 0,
      status: "blocked",
      failureKind,
      command: input.failedCommand,
      message: policyBlocks.join(" "),
      stdout: input.stdout,
      stderr: input.stderr,
    };
    attempts.push(blockedAttempt);
    await emitAttempt(input, blockedAttempt);
    return { repaired: false, blocked: true, attempts, proof, unproven: policyBlocks, finalError: policyBlocks.join(" ") };
  }

  for (let attempt = 1; attempt <= input.policy.maxAttempts; attempt += 1) {
    const patch = await input.generatePatch({
      attempt,
      failedCommand: input.failedCommand,
      failureKind,
      stdout: input.stdout || "",
      stderr: input.stderr || "",
      targetFiles: input.targetFiles,
    });

    if (!patch?.trim()) {
      const noPatch: CodexRepairAttempt = { attempt, status: "no_patch", failureKind, command: input.failedCommand, message: "No repair patch generated." };
      attempts.push(noPatch);
      await emitAttempt(input, noPatch);
      unproven.push(`repair attempt ${attempt} generated no patch`);
      continue;
    }

    const generated: CodexRepairAttempt = { attempt, status: "patch_generated", failureKind, command: input.failedCommand, message: `Repair attempt ${attempt} generated a patch.`, patch };
    attempts.push(generated);
    proof.push(`repair attempt ${attempt} generated patch`);
    await emitAttempt(input, generated);

    const applyResult = await input.applyPatch(patch, attempt);
    const applied: CodexRepairAttempt = {
      attempt,
      status: applyResult.ok ? "patch_applied" : "rerun_failed",
      failureKind,
      command: "apply_unified_diff",
      message: applyResult.ok ? `Repair attempt ${attempt} patch applied.` : `Repair attempt ${attempt} patch failed to apply.`,
      stdout: applyResult.stdout,
      stderr: applyResult.stderr,
    };
    attempts.push(applied);
    await emitAttempt(input, applied);

    if (!applyResult.ok) {
      unproven.push(`repair attempt ${attempt} patch failed to apply`);
      continue;
    }

    proof.push(`repair attempt ${attempt} patch applied`);
    const rerun = await input.rerunCommand(attempt);
    const rerunAttempt: CodexRepairAttempt = {
      attempt,
      status: rerun.ok ? "rerun_passed" : "rerun_failed",
      failureKind,
      command: input.failedCommand,
      message: rerun.ok ? `Repair attempt ${attempt} fixed ${input.failedCommand}.` : `Repair attempt ${attempt} did not fix ${input.failedCommand}.`,
      stdout: rerun.stdout,
      stderr: rerun.stderr,
    };
    attempts.push(rerunAttempt);
    await emitAttempt(input, rerunAttempt);

    if (rerun.ok) {
      proof.push(`repair attempt ${attempt} rerun passed`);
      if (input.policy.requireApprovalBeforePush) unproven.push("push remains locked until user approval");
      return { repaired: true, blocked: false, attempts, proof, unproven };
    }

    unproven.push(`repair attempt ${attempt} rerun failed`);
  }

  return {
    repaired: false,
    blocked: false,
    attempts,
    proof,
    unproven,
    finalError: `Codex repair loop exhausted ${input.policy.maxAttempts} attempts without a passing rerun.`,
  };
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
  for (const item of root?.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

export function createOpenAICodexRepairDiffGenerator(options?: { model?: string; apiKey?: string }) {
  return async function openAICodexRepairDiffGenerator(input: CodexRepairGeneratePatchInput) {
    const apiKey = options?.apiKey || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return null;
    const model = options?.model || process.env.OPENAI_CODEX_REPAIR_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const prompt = [
      "You are the Streams Builder Codex repair agent.",
      "Return ONLY a valid unified diff patch. Do not include markdown fences or commentary.",
      `Failed command: ${input.failedCommand}`,
      `Failure kind: ${input.failureKind}`,
      `Target files: ${input.targetFiles.join(", ") || "unknown"}`,
      "STDOUT:",
      input.stdout.slice(0, 12000),
      "STDERR:",
      input.stderr.slice(0, 12000),
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: prompt }),
    });

    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const text = extractOutputText(payload).trim();
    return text.startsWith("diff --git") ? text : null;
  };
}
