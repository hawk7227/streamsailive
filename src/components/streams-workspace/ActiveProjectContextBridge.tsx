"use client";

import { useEffect, useLayoutEffect } from "react";
import { useProjectWorkspace } from "./ProjectWorkspaceController";

const ACTIVE_PROJECT_KEY = "streams-ai:active-project-id";
const ACTIVE_PROJECT_NAME_KEY = "streams-ai:active-project-name";

type StreamsProject = {
  id?: string;
  name?: string;
  metadata?: Record<string, any>;
};

function selectedProjectId() {
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY) || "";
  } catch {
    return "";
  }
}

export default function ActiveProjectContextBridge() {
  const { setState } = useProjectWorkspace();

  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input?.url || "";
      const method = String(init?.method || (typeof input !== "string" && !(input instanceof URL) ? input?.method : "GET") || "GET").toUpperCase();
      const projectId = selectedProjectId();
      if (projectId && method === "GET" && (url === "/api/streams-ai/projects" || url.startsWith("/api/streams-ai/projects?"))) {
        const response = await originalFetch(`/api/v1/projects?projectId=${encodeURIComponent(projectId)}`, { ...init, method: "GET", credentials: "same-origin", cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false || !payload?.project?.id) {
          return new Response(JSON.stringify(payload), { status: response.status, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: true, project: payload.project }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      return originalFetch(input, init);
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function applyProject(project: StreamsProject) {
      if (!project?.id) return;
      const metadata = project.metadata || {};
      try {
        window.localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
        window.localStorage.setItem(ACTIVE_PROJECT_NAME_KEY, project.name || "StreamsAI project");
      } catch {}
      setState((current) => ({
        ...current,
        projectId: project.id || current.projectId,
        projectName: project.name || current.projectName,
        projectType: String(metadata.projectType || current.projectType),
        projectStatus: String(metadata.projectStatus || metadata.status || current.projectStatus),
        currentStage: String(metadata.currentStage || current.currentStage),
        progress: Number.isFinite(Number(metadata.progress)) ? Math.max(0, Math.min(100, Number(metadata.progress))) : current.progress,
        nextAction: String(metadata.nextRecommendedAction || metadata.nextAction || current.nextAction),
      }));
    }

    async function hydrate(projectId = selectedProjectId()) {
      if (!projectId) return;
      const response = await fetch(`/api/v1/projects?projectId=${encodeURIComponent(projectId)}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!cancelled && response.ok && data?.project?.id) applyProject(data.project);
    }

    function onProjectChanged(event: Event) {
      const project = (event as CustomEvent<StreamsProject>).detail;
      if (project?.id) applyProject(project);
      else void hydrate();
    }

    void hydrate();
    window.addEventListener("streams-ai:active-project-changed", onProjectChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("streams-ai:active-project-changed", onProjectChanged);
    };
  }, [setState]);

  return null;
}
