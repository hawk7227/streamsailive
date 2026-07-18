"use client";

import { useEffect, useRef } from "react";
import { useProjectWorkspace } from "./ProjectWorkspaceController";
import type { UniversalWorkspaceState } from "./workspace-state";

type ActiveFile = {
  repo?: string;
  branch?: string;
  path?: string;
  folder?: string;
  sha?: string;
  content?: string;
  route?: string;
};

type DurableDraft = {
  draftId?: string;
  checkpointId?: string;
  repo?: string;
  branch?: string;
  filePath?: string;
  baseSha?: string;
  route?: string;
  content?: string;
  patchState?: string;
  previewBuildState?: string;
  previewId?: string;
  previewUrl?: string;
  commitSha?: string;
  lastError?: string;
};

type Snapshot = {
  projectId: string;
  revision: number;
  stateHash: string;
  workspace: Record<string, unknown>;
  activeFile: ActiveFile | null;
  draft: DurableDraft | null;
  selection: Record<string, unknown> | null;
  proof: Record<string, unknown> | null;
  updatedAt: string;
};

type WorkspaceStateResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  projectId?: string;
  jobId?: string | null;
  snapshot?: Snapshot | null;
};

const ACTIVE_FILE_KEY = "streams-builder:active-file";
const CHANNEL_NAME = "streams-builder:workspace-state";
const SAVE_DELAY_MS = 900;

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function visualDraftKey(file: ActiveFile | null) {
  return file?.repo && file?.branch && file?.path
    ? `streams-builder:visual-draft:${file.repo}:${file.branch}:${file.path}`
    : "";
}

function readLocalDraft(file: ActiveFile | null): DurableDraft | null {
  const key = visualDraftKey(file);
  const value = key ? readJson<Record<string, unknown>>(key) : null;
  if (!value) return null;
  return {
    draftId: String(value.id || value.draftId || ""),
    checkpointId: String(value.checkpointId || ""),
    repo: String(value.repo || file?.repo || ""),
    branch: String(value.branch || file?.branch || ""),
    filePath: String(value.filePath || file?.path || ""),
    baseSha: String(value.baseSha || file?.sha || ""),
    route: String(value.route || file?.route || ""),
    content: String(value.currentContent || value.content || file?.content || ""),
    patchState: String(value.patchState || "not_generated"),
    previewBuildState: String(value.previewBuildState || "not_started"),
    previewId: String(value.previewId || ""),
    previewUrl: String(value.previewUrl || ""),
    commitSha: String(value.commitSha || ""),
    lastError: String(value.lastError || ""),
  };
}

function writeLocalSnapshot(snapshot: Snapshot) {
  if (snapshot.activeFile?.path) {
    window.localStorage.setItem(ACTIVE_FILE_KEY, JSON.stringify(snapshot.activeFile));
  }
  if (snapshot.draft?.filePath && snapshot.draft.repo && snapshot.draft.branch) {
    const key = `streams-builder:visual-draft:${snapshot.draft.repo}:${snapshot.draft.branch}:${snapshot.draft.filePath}`;
    window.localStorage.setItem(key, JSON.stringify({
      id: snapshot.draft.draftId,
      checkpointId: snapshot.draft.checkpointId,
      repo: snapshot.draft.repo,
      branch: snapshot.draft.branch,
      filePath: snapshot.draft.filePath,
      route: snapshot.draft.route,
      currentContent: snapshot.draft.content,
      patchState: snapshot.draft.patchState,
      previewBuildState: snapshot.draft.previewBuildState,
      previewId: snapshot.draft.previewId,
      previewUrl: snapshot.draft.previewUrl,
      commitSha: snapshot.draft.commitSha,
      lastError: snapshot.draft.lastError,
      updatedAt: snapshot.updatedAt,
    }));
  }
}

function snapshotWorkspaceState(state: UniversalWorkspaceState, builder: Record<string, unknown>) {
  return {
    activeGlobalNav: state.activeGlobalNav,
    activeInspectorTab: state.activeInspectorTab,
    activeTrayTab: state.activeTrayTab,
    projectPanelOpen: state.projectPanelOpen,
    inspectorOpen: state.inspectorOpen,
    trayOpen: state.trayOpen,
    fullscreenCanvas: state.fullscreenCanvas,
    activeModule: String(builder.activeModule || "Primary Builder"),
    viewMode: String(builder.viewMode || "Single"),
    lastPhase: String(builder.lastPhase || ""),
  };
}

export default function BuilderWorkspacePersistenceBridge() {
  const { state, setState } = useProjectWorkspace();
  const projectIdRef = useRef("");
  const revisionRef = useRef(0);
  const hydratedRef = useRef(false);
  const savingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const activeFileRef = useRef<ActiveFile | null>(null);
  const draftRef = useRef<DurableDraft | null>(null);
  const selectionRef = useRef<Record<string, unknown> | null>(null);
  const proofRef = useRef<Record<string, unknown> | null>(null);
  const builderRef = useRef<Record<string, unknown>>({ activeModule: "Primary Builder", viewMode: "Single" });
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  async function fetchState(projectId: string) {
    const response = await fetch(`/api/streams-builder/workspace-state?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as WorkspaceStateResponse;
    if (!response.ok || data.ok === false) throw new Error(data.error || "Unable to restore builder workspace state.");
    return data;
  }

  function hydrateSnapshot(snapshot: Snapshot, projectName?: string) {
    revisionRef.current = snapshot.revision;
    activeFileRef.current = snapshot.activeFile;
    draftRef.current = snapshot.draft;
    selectionRef.current = snapshot.selection;
    proofRef.current = snapshot.proof;
    builderRef.current = { ...builderRef.current, ...(snapshot.workspace || {}) };
    writeLocalSnapshot(snapshot);
    setState((current) => ({
      ...current,
      projectId: snapshot.projectId,
      projectName: projectName || current.projectName,
      activeGlobalNav: String(snapshot.workspace?.activeGlobalNav || current.activeGlobalNav),
      activeInspectorTab: (snapshot.workspace?.activeInspectorTab || current.activeInspectorTab) as UniversalWorkspaceState["activeInspectorTab"],
      activeTrayTab: (snapshot.workspace?.activeTrayTab || current.activeTrayTab) as UniversalWorkspaceState["activeTrayTab"],
      projectPanelOpen: typeof snapshot.workspace?.projectPanelOpen === "boolean" ? snapshot.workspace.projectPanelOpen : current.projectPanelOpen,
      inspectorOpen: typeof snapshot.workspace?.inspectorOpen === "boolean" ? snapshot.workspace.inspectorOpen : current.inspectorOpen,
      trayOpen: typeof snapshot.workspace?.trayOpen === "boolean" ? snapshot.workspace.trayOpen : current.trayOpen,
      fullscreenCanvas: typeof snapshot.workspace?.fullscreenCanvas === "boolean" ? snapshot.workspace.fullscreenCanvas : current.fullscreenCanvas,
      saveStatus: `Saved · revision ${snapshot.revision}`,
      durableRevision: snapshot.revision,
      durableState: "saved",
    }));
    if (snapshot.activeFile?.path) {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: snapshot.activeFile })), 0);
    }
  }

  async function saveNow(eventType: string, eventMessage: string) {
    if (!hydratedRef.current || !projectIdRef.current || savingRef.current) return;
    savingRef.current = true;
    setState((current) => ({ ...current, saveStatus: "Saving…", durableState: "saving" }));
    const idempotencyKey = `${projectIdRef.current}:${Date.now()}:${eventType}`;
    const payload = {
      projectId: projectIdRef.current,
      expectedRevision: revisionRef.current,
      idempotencyKey,
      workspace: snapshotWorkspaceState(stateRef.current, builderRef.current),
      activeFile: activeFileRef.current,
      draft: draftRef.current,
      selection: selectionRef.current,
      proof: proofRef.current,
      eventType,
      eventMessage,
    };

    async function send(expectedRevision: number) {
      const response = await fetch("/api/streams-builder/workspace-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ ...payload, expectedRevision }),
      });
      const data = await response.json().catch(() => ({})) as WorkspaceStateResponse;
      return { response, data };
    }

    try {
      let result = await send(revisionRef.current);
      if (result.response.status === 409) {
        const latest = await fetchState(projectIdRef.current);
        if (latest.snapshot) hydrateSnapshot(latest.snapshot);
        result = await send(revisionRef.current);
      }
      if (!result.response.ok || result.data.ok === false || !result.data.snapshot) {
        throw new Error(result.data.error || "Unable to save builder workspace state.");
      }
      hydrateSnapshot(result.data.snapshot);
      channelRef.current?.postMessage({ projectId: projectIdRef.current, revision: result.data.snapshot.revision });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save builder workspace state.";
      setState((current) => ({ ...current, saveStatus: "Save failed", durableState: "error", durableError: message }));
    } finally {
      savingRef.current = false;
    }
  }

  function scheduleSave(eventType: string, eventMessage: string) {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveNow(eventType, eventMessage), SAVE_DELAY_MS);
  }

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      setState((current) => ({ ...current, saveStatus: "Restoring…", durableState: "loading" }));
      try {
        const projectResponse = await fetch("/api/streams-ai/projects", { cache: "no-store" });
        const projectData = await projectResponse.json().catch(() => ({})) as { ok?: boolean; project?: { id?: string; name?: string } };
        if (!projectResponse.ok || !projectData.project?.id) throw new Error("Unable to resolve the active Streams project.");
        if (cancelled) return;
        const projectId = projectData.project.id;
        projectIdRef.current = projectId;
        const stateData = await fetchState(projectId);
        if (cancelled) return;
        if (stateData.snapshot) {
          hydrateSnapshot(stateData.snapshot, projectData.project.name);
        } else {
          activeFileRef.current = readJson<ActiveFile>(ACTIVE_FILE_KEY);
          draftRef.current = readLocalDraft(activeFileRef.current);
          setState((current) => ({ ...current, projectId, projectName: projectData.project?.name || current.projectName, saveStatus: "Local state ready to migrate", durableState: "local" }));
        }
        hydratedRef.current = true;
        if (!stateData.snapshot && (activeFileRef.current || draftRef.current)) {
          scheduleSave("workspace.local_migrated", "Migrated existing browser-local builder state into authoritative project storage.");
        } else if (!stateData.snapshot) {
          scheduleSave("workspace.initialized", "Initialized authoritative builder workspace state for the project.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to restore builder workspace state.";
        setState((current) => ({ ...current, saveStatus: "Local cache only", durableState: "error", durableError: message }));
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [setState]);

  useEffect(() => {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
    channelRef.current = channel;
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.projectId !== projectIdRef.current || Number(event.data?.revision || 0) <= revisionRef.current) return;
        void fetchState(projectIdRef.current).then((data) => { if (data.snapshot) hydrateSnapshot(data.snapshot); }).catch(() => {});
      };
    }

    function onPulledFile(event: Event) {
      const detail = (event as CustomEvent<ActiveFile>).detail;
      if (!detail?.path) return;
      activeFileRef.current = detail;
      draftRef.current = readLocalDraft(detail);
      scheduleSave("file.opened", `Persisted active source file ${detail.path}.`);
    }

    function onCodeDraftChanged(event: Event) {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      const active = activeFileRef.current;
      draftRef.current = {
        ...draftRef.current,
        repo: String(detail.repo || active?.repo || ""),
        branch: String(detail.branch || active?.branch || ""),
        filePath: String(detail.path || active?.path || ""),
        baseSha: String(active?.sha || ""),
        route: String(detail.route || active?.route || ""),
        content: String(detail.content || ""),
        patchState: String(detail.patchState || "not_generated"),
      };
      scheduleSave("draft.changed", "Persisted shared visual and code editor draft.");
    }

    function onBuilderEvent(event: Event) {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      const phase = String(detail.phase || "workspace.changed");
      if (detail.activeModule) builderRef.current.activeModule = detail.activeModule;
      if (detail.viewMode) builderRef.current.viewMode = detail.viewMode;
      builderRef.current.lastPhase = phase;
      if (phase.includes("select") || phase.includes("visual")) selectionRef.current = detail;
      if (/proof|preview|patch|push|verification|approval|build/.test(phase)) proofRef.current = detail;
      if (detail.previewId || detail.previewUrl || detail.patchState || detail.checkpointId) {
        draftRef.current = {
          ...draftRef.current,
          checkpointId: String(detail.checkpointId || draftRef.current?.checkpointId || ""),
          patchState: String(detail.patchState || draftRef.current?.patchState || "not_generated"),
          previewBuildState: String(detail.previewBuildState || draftRef.current?.previewBuildState || "not_started"),
          previewId: String(detail.previewId || draftRef.current?.previewId || ""),
          previewUrl: String(detail.previewUrl || draftRef.current?.previewUrl || ""),
          commitSha: String(detail.commitSha || draftRef.current?.commitSha || ""),
          lastError: String(detail.error || detail.lastError || draftRef.current?.lastError || ""),
        };
      }
      scheduleSave(phase.replace(/[^a-zA-Z0-9_.-]/g, "."), String(detail.message || "Builder workspace state changed."));
    }

    function onStorage(event: StorageEvent) {
      if (event.key === ACTIVE_FILE_KEY && event.newValue) {
        try {
          activeFileRef.current = JSON.parse(event.newValue) as ActiveFile;
          scheduleSave("workspace.cross_tab_cache_changed", "Detected a builder active-file change from another browser tab.");
        } catch {}
      }
    }

    window.addEventListener("streams-builder:pulled-file", onPulledFile);
    window.addEventListener("streams-builder:code-draft-changed", onCodeDraftChanged);
    window.addEventListener("streams-builder-summary-event", onBuilderEvent);
    window.addEventListener("streams-builder:chat-context-event", onBuilderEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("streams-builder:pulled-file", onPulledFile);
      window.removeEventListener("streams-builder:code-draft-changed", onCodeDraftChanged);
      window.removeEventListener("streams-builder-summary-event", onBuilderEvent);
      window.removeEventListener("streams-builder:chat-context-event", onBuilderEvent);
      window.removeEventListener("storage", onStorage);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      channel?.close();
      channelRef.current = null;
    };
  }, [setState]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    scheduleSave("workspace.ui_changed", "Persisted universal workspace panel and navigation state.");
  }, [state.activeGlobalNav, state.activeInspectorTab, state.activeTrayTab, state.projectPanelOpen, state.inspectorOpen, state.trayOpen, state.fullscreenCanvas]);

  return null;
}
