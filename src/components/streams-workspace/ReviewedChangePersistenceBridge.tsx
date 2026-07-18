"use client";

import { useEffect } from "react";

type SnapshotResponse = {
  ok?: boolean;
  projectId?: string;
  snapshot?: {
    revision: number;
    workspace?: Record<string, unknown>;
    activeFile?: Record<string, unknown> | null;
    draft?: Record<string, unknown> | null;
    selection?: Record<string, unknown> | null;
    proof?: Record<string, unknown> | null;
  } | null;
};

async function readWorkspace() {
  const response = await fetch("/api/v1/builder/workspaces", { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as SnapshotResponse;
  if (!response.ok || data.ok === false || !data.projectId) throw new Error("Unable to read reviewed builder state.");
  return data;
}

async function persistDetail(detail: Record<string, unknown>, eventType: string, eventMessage: string) {
  const current = await readWorkspace();
  const snapshot = current.snapshot;
  const draft = {
    ...(snapshot?.draft || {}),
    previewBuildState: String(detail.previewBuildState || snapshot?.draft?.previewBuildState || "not_started"),
    previewId: String(detail.previewId || snapshot?.draft?.previewId || ""),
    previewUrl: String(detail.previewUrl || snapshot?.draft?.previewUrl || ""),
    previewBranch: String(detail.previewBranch || snapshot?.draft?.previewBranch || ""),
    deploymentId: String(detail.deploymentId || snapshot?.draft?.deploymentId || ""),
    deploymentUrl: String(detail.deploymentUrl || snapshot?.draft?.deploymentUrl || ""),
    pullRequestNumber: Number(detail.pullRequestNumber || snapshot?.draft?.pullRequestNumber || 0) || undefined,
    pullRequestUrl: String(detail.pullRequestUrl || snapshot?.draft?.pullRequestUrl || ""),
    lastError: String(detail.error || detail.lastError || snapshot?.draft?.lastError || ""),
  };

  const body = {
    projectId: current.projectId,
    expectedRevision: snapshot?.revision || 0,
    idempotencyKey: `${current.projectId}:${eventType}:${String(detail.previewId || detail.pullRequestNumber || Date.now())}`,
    workspace: snapshot?.workspace || {},
    activeFile: snapshot?.activeFile || null,
    draft,
    selection: snapshot?.selection || null,
    proof: { ...(snapshot?.proof || {}), ...detail, eventType, eventMessage },
    eventType,
    eventMessage,
  };

  let response = await fetch("/api/v1/builder/workspaces", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (response.status === 409) {
    const latest = await readWorkspace();
    response = await fetch("/api/v1/builder/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ ...body, expectedRevision: latest.snapshot?.revision || 0, workspace: latest.snapshot?.workspace || body.workspace, activeFile: latest.snapshot?.activeFile || body.activeFile, selection: latest.snapshot?.selection || body.selection, proof: { ...(latest.snapshot?.proof || {}), ...body.proof }, draft: { ...(latest.snapshot?.draft || {}), ...draft } }),
    });
  }
  if (!response.ok) throw new Error("Unable to persist reviewed builder state.");
}

export default function ReviewedChangePersistenceBridge() {
  useEffect(() => {
    function onPreview(event: Event) {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      void persistDetail(detail, "preview.identity_persisted", "Persisted the temporary preview branch and deployment identity.").catch(() => {});
    }
    function onPullRequest(event: Event) {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      void persistDetail(detail, "github.pr.created", "Persisted the reviewed GitHub pull request identity and status.").catch(() => {});
    }
    window.addEventListener("streams-builder:preview-state", onPreview);
    window.addEventListener("streams-builder:pull-request-state", onPullRequest);
    return () => {
      window.removeEventListener("streams-builder:preview-state", onPreview);
      window.removeEventListener("streams-builder:pull-request-state", onPullRequest);
    };
  }, []);
  return null;
}
