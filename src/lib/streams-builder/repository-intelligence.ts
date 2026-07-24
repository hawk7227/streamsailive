import { access, readFile } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

export type StreamsPackageManager = "pnpm" | "yarn" | "npm" | "bun";

export type StreamsRepositoryInstruction = {
  path: string;
  scope: string;
  precedence: number;
  content: string;
};

export type StreamsRepositoryIntelligence = {
  packageManager: StreamsPackageManager;
  buildCommand: string[] | null;
  testCommand: string[] | null;
  typecheckCommand: string[] | null;
  instructions: StreamsRepositoryInstruction[];
  instructionCharacters: number;
  targetFiles: string[];
};

const MAX_INSTRUCTION_CHARS = 32_768;
const INSTRUCTION_FILENAMES = ["AGENTS.override.md", "AGENTS.md"] as const;

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertInside(root: string, candidate: string) {
  const rootPath = resolve(root);
  const candidatePath = resolve(candidate);
  if (candidatePath !== rootPath && !candidatePath.startsWith(`${rootPath}${sep}`)) {
    throw new Error(`Repository intelligence path escaped workspace: ${candidate}`);
  }
}

function safeTarget(root: string, target: string) {
  const normalized = normalize(target).replace(/^([/\\])+/, "");
  const absolute = resolve(root, normalized);
  assertInside(root, absolute);
  return absolute;
}

function directoriesFromRoot(root: string, targetFile: string) {
  const rootPath = resolve(root);
  const targetDir = dirname(safeTarget(root, targetFile));
  const result: string[] = [];
  let current = targetDir;
  while (true) {
    result.push(current);
    if (current === rootPath) break;
    const parent = dirname(current);
    if (parent === current || !parent.startsWith(rootPath)) break;
    current = parent;
  }
  return result.reverse();
}

export function instructionCandidatePaths(workspaceDir: string, targetFiles: string[]) {
  const root = resolve(workspaceDir);
  const directories = new Set<string>([root]);
  for (const target of targetFiles) {
    for (const directory of directoriesFromRoot(root, target)) directories.add(directory);
  }

  const candidates: string[] = [];
  for (const directory of [...directories].sort((a, b) => a.length - b.length)) {
    for (const filename of INSTRUCTION_FILENAMES) candidates.push(join(directory, filename));
  }
  return candidates;
}

async function readJson(path: string): Promise<Record<string, any> | null> {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

export async function detectPackageManager(workspaceDir: string): Promise<StreamsPackageManager> {
  const packageJson = await readJson(join(workspaceDir, "package.json"));
  const declared = String(packageJson?.packageManager || "").split("@")[0];
  if (["pnpm", "yarn", "npm", "bun"].includes(declared)) return declared as StreamsPackageManager;
  if (await exists(join(workspaceDir, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(join(workspaceDir, "yarn.lock"))) return "yarn";
  if (await exists(join(workspaceDir, "bun.lockb")) || await exists(join(workspaceDir, "bun.lock"))) return "bun";
  return "npm";
}

function scriptCommand(packageManager: StreamsPackageManager, script: string) {
  if (packageManager === "npm") return ["npm", "run", script];
  if (packageManager === "bun") return ["bun", "run", script];
  return [packageManager, script];
}

export async function loadRepositoryIntelligence(input: {
  workspaceDir: string;
  targetFiles: string[];
  maxInstructionChars?: number;
}): Promise<StreamsRepositoryIntelligence> {
  const workspaceDir = resolve(input.workspaceDir);
  const maxChars = Math.max(1_024, Math.min(input.maxInstructionChars || MAX_INSTRUCTION_CHARS, MAX_INSTRUCTION_CHARS));
  const packageJson = await readJson(join(workspaceDir, "package.json"));
  const scripts = packageJson?.scripts || {};
  const packageManager = await detectPackageManager(workspaceDir);
  const instructions: StreamsRepositoryInstruction[] = [];
  let remaining = maxChars;

  const candidates = instructionCandidatePaths(workspaceDir, input.targetFiles);
  for (const candidate of candidates) {
    if (!(await exists(candidate)) || remaining <= 0) continue;
    const raw = await readFile(candidate, "utf-8");
    const content = raw.slice(0, remaining);
    remaining -= content.length;
    instructions.push({
      path: relative(workspaceDir, candidate) || candidate,
      scope: relative(workspaceDir, dirname(candidate)) || ".",
      precedence: candidate.split(sep).length,
      content,
    });
  }

  instructions.sort((a, b) => a.precedence - b.precedence || a.path.localeCompare(b.path));

  return {
    packageManager,
    buildCommand: scripts.build ? scriptCommand(packageManager, "build") : null,
    testCommand: scripts.test ? scriptCommand(packageManager, "test") : null,
    typecheckCommand: scripts.typecheck ? scriptCommand(packageManager, "typecheck") : null,
    instructions,
    instructionCharacters: maxChars - remaining,
    targetFiles: input.targetFiles,
  };
}
