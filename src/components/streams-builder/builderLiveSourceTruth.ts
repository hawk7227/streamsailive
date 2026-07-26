export type BuilderSelectionRange = {
  startLine: number;
  startColumn?: number;
  endLine: number;
  endColumn?: number;
  text?: string;
};

export type BuilderSourceTruth = {
  mode: "brainstorm" | "github-file";
  repo: string;
  branch: string;
  folder: string;
  filePath: string;
  sourceSha: string;
  lockToken: string;
  lockedAt: string;
  route: string;
  previewId?: string;
  sessionId?: string;
  projectId?: string;
  draftRevision: number;
  selectedRange?: BuilderSelectionRange | null;
};

export const BUILDER_SOURCE_TRUTH_KEY = "streams-builder:source-truth";
export const BUILDER_SOURCE_TRUTH_EVENT = "streams-builder:source-truth-changed";
export const BUILDER_CONTEXT_EVENT = "streams-builder:live-context";
export const BUILDER_AGENT_FOCUS_EVENT = "streams-builder:agent-focus";

export function createLockToken(input: Pick<BuilderSourceTruth, "repo" | "branch" | "filePath" | "sourceSha">) {
  const base = `${input.repo}:${input.branch}:${input.filePath}:${input.sourceSha}:${Date.now()}`;
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : base;
}

export function readBuilderSourceTruth(): BuilderSourceTruth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BUILDER_SOURCE_TRUTH_KEY);
    return raw ? JSON.parse(raw) as BuilderSourceTruth : null;
  } catch {
    return null;
  }
}

export function writeBuilderSourceTruth(next: BuilderSourceTruth) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BUILDER_SOURCE_TRUTH_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(BUILDER_SOURCE_TRUTH_EVENT, { detail: next }));
  window.dispatchEvent(new CustomEvent(BUILDER_CONTEXT_EVENT, { detail: { kind: "source-truth", sourceTruth: next } }));
}

export function clearBuilderSourceTruth(route = "/") {
  const next: BuilderSourceTruth = {
    mode: "brainstorm",
    repo: "",
    branch: "",
    folder: "",
    filePath: "",
    sourceSha: "",
    lockToken: "",
    lockedAt: "",
    route,
    draftRevision: 0,
    selectedRange: null,
  };
  writeBuilderSourceTruth(next);
  return next;
}

export function targetMatchesSourceTruth(
  truth: BuilderSourceTruth | null,
  target: { repo?: string; branch?: string; filePath?: string; sourceSha?: string; lockToken?: string },
) {
  if (!truth || truth.mode !== "github-file") return false;
  return truth.repo === target.repo
    && truth.branch === target.branch
    && truth.filePath === target.filePath
    && truth.sourceSha === target.sourceSha
    && truth.lockToken === target.lockToken;
}
