export type AgentOneStatus = "Ready" | "Running" | "Repairing" | "Verified" | "Blocked";

export type AgentOneMismatchCode =
  | "wrong-file-open"
  | "wrong-route-preview"
  | "stale-pulled-file"
  | "missing-sha"
  | "preview-blank"
  | "build-failed"
  | "route-mismatch"
  | "component-mismatch"
  | "write-target-mismatch";

export type AgentOneRepairAction =
  | "reload-tree"
  | "re-pull-file"
  | "re-map-route"
  | "refresh-preview"
  | "restore-active-file-from-memory"
  | "block-push";

export type AgentOneSourceTruth = {
  selectedRepo: string;
  selectedBranch: string;
  selectedFile: string;
  selectedRoute: string;
};

export type AgentOneWorkspaceState = AgentOneSourceTruth & {
  activeWorkFile: string;
  activeRoute: string;
  activePreview: string;
  activeCode: string;
  activeProof: string;
  activeSha: string;
  openedFile: string;
  writeTarget: string;
  componentFile?: string;
  buildOk?: boolean;
  previewLoaded?: boolean;
  previewHardCoded?: boolean;
  lastPulledSha?: string;
  lastVerifiedAt?: string;
};

export type AgentOneCheck = {
  ok: boolean;
  code: AgentOneMismatchCode;
  message: string;
  repair: AgentOneRepairAction;
};

export type AgentOneVerification = {
  status: AgentOneStatus;
  canPush: boolean;
  checks: AgentOneCheck[];
  proof: string[];
};

function sameValue(left?: string, right?: string) {
  return (left || "").trim() === (right || "").trim();
}

function hasValue(value?: string) {
  return Boolean((value || "").trim());
}

function normalizeRoute(route?: string) {
  const trimmed = (route || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function appRouteFromFile(path?: string) {
  const file = (path || "").trim();
  if (!file.startsWith("src/app/")) return "";
  if (!file.endsWith("/page.tsx") && !file.endsWith("/page.jsx")) return "";
  const route = file
    .replace(/^src\/app/, "")
    .replace(/\/page\.(tsx|jsx)$/, "")
    .replace(/\/\([^)]*\)/g, "")
    .replace(/\/page$/, "");
  return route === "" ? "/" : route;
}

export function createAgentOneWorkspaceState(sourceTruth: AgentOneSourceTruth): AgentOneWorkspaceState {
  return {
    ...sourceTruth,
    selectedRoute: normalizeRoute(sourceTruth.selectedRoute || appRouteFromFile(sourceTruth.selectedFile)),
    activeWorkFile: sourceTruth.selectedFile,
    activeRoute: normalizeRoute(sourceTruth.selectedRoute || appRouteFromFile(sourceTruth.selectedFile)),
    activePreview: normalizeRoute(sourceTruth.selectedRoute || appRouteFromFile(sourceTruth.selectedFile)),
    activeCode: "",
    activeProof: "",
    activeSha: "",
    openedFile: sourceTruth.selectedFile,
    writeTarget: sourceTruth.selectedFile,
    componentFile: sourceTruth.selectedFile,
    buildOk: undefined,
    previewLoaded: undefined,
    previewHardCoded: false,
    lastPulledSha: "",
  };
}

export function rebuildAgentOneWorkspaceState(
  previous: AgentOneWorkspaceState,
  pulled: Partial<AgentOneWorkspaceState> & { content?: string; sha?: string; frontendRoute?: string },
): AgentOneWorkspaceState {
  const pulledFile = pulled.activeWorkFile || pulled.openedFile || pulled.writeTarget || previous.selectedFile;
  const route = normalizeRoute(pulled.frontendRoute || pulled.activeRoute || appRouteFromFile(pulledFile) || previous.selectedRoute);
  return {
    ...previous,
    activeWorkFile: pulledFile,
    openedFile: pulledFile,
    writeTarget: pulledFile,
    componentFile: pulled.componentFile || pulledFile,
    activeRoute: route,
    activePreview: route,
    activeCode: pulled.content ?? pulled.activeCode ?? previous.activeCode,
    activeProof: pulled.activeProof || previous.activeProof,
    activeSha: pulled.sha || pulled.activeSha || previous.activeSha,
    lastPulledSha: pulled.sha || pulled.lastPulledSha || previous.lastPulledSha,
    previewLoaded: pulled.previewLoaded ?? previous.previewLoaded,
    previewHardCoded: pulled.previewHardCoded ?? false,
    buildOk: pulled.buildOk ?? previous.buildOk,
  };
}

export function verifyAgentOneWorkspaceState(state: AgentOneWorkspaceState): AgentOneVerification {
  const checks: AgentOneCheck[] = [];
  const selectedRoute = normalizeRoute(state.selectedRoute || appRouteFromFile(state.selectedFile));
  const activeRoute = normalizeRoute(state.activeRoute);
  const activePreview = normalizeRoute(state.activePreview);

  if (!sameValue(state.selectedFile, state.openedFile)) {
    checks.push({ ok: false, code: "wrong-file-open", message: "Selected top-row file does not match the opened editor file.", repair: "restore-active-file-from-memory" });
  }

  if (!sameValue(state.selectedFile, state.activeWorkFile)) {
    checks.push({ ok: false, code: "component-mismatch", message: "Selected file does not match activeWorkFile.", repair: "re-pull-file" });
  }

  if (!sameValue(state.selectedFile, state.writeTarget)) {
    checks.push({ ok: false, code: "write-target-mismatch", message: "Selected file does not match the push/write target.", repair: "block-push" });
  }

  if (!sameValue(state.activeWorkFile, state.componentFile || state.activeWorkFile)) {
    checks.push({ ok: false, code: "component-mismatch", message: "Active component file does not match the active work file.", repair: "re-pull-file" });
  }

  if (!hasValue(state.activeSha)) {
    checks.push({ ok: false, code: "missing-sha", message: "No active SHA is present. Push must stay blocked until the selected source file is re-pulled.", repair: "re-pull-file" });
  }

  if (hasValue(state.lastPulledSha) && hasValue(state.activeSha) && !sameValue(state.lastPulledSha, state.activeSha)) {
    checks.push({ ok: false, code: "stale-pulled-file", message: "Active SHA does not match the last pulled SHA.", repair: "re-pull-file" });
  }

  if (!sameValue(selectedRoute, activeRoute)) {
    checks.push({ ok: false, code: "route-mismatch", message: "Selected route does not match activeRoute.", repair: "re-map-route" });
  }

  if (!sameValue(activeRoute, activePreview)) {
    checks.push({ ok: false, code: "wrong-route-preview", message: "Iframe preview route does not match activeRoute.", repair: "refresh-preview" });
  }

  if (!hasValue(state.activePreview)) {
    checks.push({ ok: false, code: "preview-blank", message: "No active preview route is available.", repair: "re-map-route" });
  }

  if (state.previewLoaded === false) {
    checks.push({ ok: false, code: "preview-blank", message: "Preview did not load the active route.", repair: "refresh-preview" });
  }

  if (state.previewHardCoded) {
    checks.push({ ok: false, code: "wrong-route-preview", message: "Preview is marked as hard-coded and cannot be used as proof.", repair: "refresh-preview" });
  }

  if (state.buildOk === false) {
    checks.push({ ok: false, code: "build-failed", message: "Build failed. Push must stay blocked until repair and verification pass.", repair: "block-push" });
  }

  const canPush = checks.length === 0;
  const status: AgentOneStatus = canPush ? "Verified" : "Blocked";
  const proof = canPush
    ? [
        `Verified repo: ${state.selectedRepo}`,
        `Verified branch: ${state.selectedBranch}`,
        `Verified file: ${state.selectedFile}`,
        `Verified route: ${activeRoute}`,
        `Verified SHA: ${state.activeSha}`,
        "Push gate open: selected file, opened file, active file, and write target match.",
      ]
    : checks.map((check) => `${check.code}: ${check.message} -> ${check.repair}`);

  return { status, canPush, checks, proof };
}

export function getAgentOneRepairPlan(state: AgentOneWorkspaceState): AgentOneRepairAction[] {
  const verification = verifyAgentOneWorkspaceState(state);
  const ordered: AgentOneRepairAction[] = [];
  for (const check of verification.checks) {
    if (!ordered.includes(check.repair)) ordered.push(check.repair);
  }
  if (ordered.length && !ordered.includes("block-push")) ordered.push("block-push");
  return ordered;
}

export function canAgentOnePush(state: AgentOneWorkspaceState) {
  return verifyAgentOneWorkspaceState(state).canPush;
}
