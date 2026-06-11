"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StreamsBuilderComponentMapRow } from "@/lib/streams-builder/component-map";
import type { StreamsBuilderNotification } from "@/lib/streams-builder/notifications";
import type { StreamsBuilderProjectView } from "@/lib/streams-builder/projects";
import ApprovalCenterPanel from "./ApprovalCenterPanel";
import BuilderNotificationPanel from "./BuilderNotificationPanel";
import ComponentMappingPanel from "./ComponentMappingPanel";
import MiniReviewWindow from "./MiniReviewWindow";
import ProjectPreviewCard from "./ProjectPreviewCard";
import ProjectSwitcher from "./ProjectSwitcher";
import ProjectThumbnailRail from "./ProjectThumbnailRail";
import StreamsBuilderVisualEditorPanel from "./StreamsBuilderVisualEditorPanel";

type DashboardMode = "dashboard" | "projects" | "approval";

type ProjectsResponse = { ok: boolean; projects?: StreamsBuilderProjectView[]; error?: string };
type NotificationsResponse = { ok: boolean; notifications?: StreamsBuilderNotification[]; error?: string };
type ComponentMapResponse = { ok: boolean; mappings?: StreamsBuilderComponentMapRow[]; error?: string };

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-6">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
    </section>
  );
}

export default function StreamsBuilderDashboard({ mode = "dashboard" }: { mode?: DashboardMode }) {
  const [projects, setProjects] = useState<StreamsBuilderProjectView[]>([]);
  const [notifications, setNotifications] = useState<StreamsBuilderNotification[]>([]);
  const [mappings, setMappings] = useState<StreamsBuilderComponentMapRow[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeProject = useMemo(() => projects.find((project) => project.projectId === activeProjectId) || projects[0] || null, [projects, activeProjectId]);
  const visibleNotifications = useMemo(() => activeProject ? notifications.filter((item) => item.projectId === activeProject.projectId) : notifications, [notifications, activeProject]);
  const visibleMappings = useMemo(() => activeProject ? mappings.filter((item) => item.projectId === activeProject.projectId) : mappings, [mappings, activeProject]);

  const loadDashboard = useCallback(async (preferredProjectId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const projectsResponse = await fetch("/api/streams-builder/projects", { credentials: "include" });
      const projectsJson = (await projectsResponse.json()) as ProjectsResponse;
      if (!projectsJson.ok) throw new Error(projectsJson.error || "Unable to load Streams Builder projects");
      const nextProjects = projectsJson.projects || [];
      const nextActive = preferredProjectId || activeProjectId || nextProjects[0]?.projectId || null;
      setProjects(nextProjects);
      setActiveProjectId(nextActive);

      const params = nextActive ? `?projectId=${encodeURIComponent(nextActive)}` : "";
      const [notificationsResponse, mappingsResponse] = await Promise.all([
        fetch(`/api/streams-builder/notifications${params}`, { credentials: "include" }),
        fetch(`/api/streams-builder/component-map${params}`, { credentials: "include" }),
      ]);
      const notificationsJson = (await notificationsResponse.json()) as NotificationsResponse;
      const mappingsJson = (await mappingsResponse.json()) as ComponentMapResponse;
      if (!notificationsJson.ok) throw new Error(notificationsJson.error || "Unable to load Streams Builder notifications");
      if (!mappingsJson.ok) throw new Error(mappingsJson.error || "Unable to load Streams Builder component map");
      setNotifications(notificationsJson.notifications || []);
      setMappings(mappingsJson.mappings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Streams Builder dashboard failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    void loadDashboard(params.get("activeProjectId"));
  }, []);

  const selectProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    const url = new URL(window.location.href);
    url.searchParams.set("activeProjectId", projectId);
    window.history.replaceState({}, "", url.toString());
    void loadDashboard(projectId);
  }, [loadDashboard]);

  async function toggleNotification(notification: StreamsBuilderNotification) {
    if (!activeProject) return;
    await fetch("/api/streams-builder/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: activeProject.projectId, sessionId: activeProject.jobId || activeProject.projectId, notificationId: notification.id, read: !notification.read }),
    });
    await loadDashboard(activeProject.projectId);
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">Streams Builder Dashboard</p>
            <h2 className="mt-2 text-3xl font-black text-white">Projects, proof, approvals, and notifications.</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">This dashboard reads real Streams AI job/event state. Missing ownership, previews, screenshots, or proof remain UNPROVEN.</p>
          </div>
          <ProjectSwitcher projects={projects} activeProjectId={activeProject?.projectId || null} onSelect={selectProject} />
        </div>
      </div>

      {error ? <EmptyState title="Dashboard error" message={error} /> : null}
      {loading ? <EmptyState title="Loading dashboard" message="Reading Streams Builder project, notification, and component mapping state." /> : null}

      {!loading && !projects.length ? (
        <EmptyState title="No real projects found" message="No Streams Builder project state was found in existing Streams AI jobs/events. Create or queue a Builder project to populate this dashboard." />
      ) : null}

      {projects.length ? (
        <>
          <ProjectThumbnailRail projects={projects} activeProjectId={activeProject?.projectId || null} onSelect={selectProject} />
          {mode === "dashboard" ? (
            <StreamsBuilderVisualEditorPanel project={activeProject} mappings={visibleMappings} onActivity={() => loadDashboard(activeProject?.projectId)} />
          ) : null}
          {mode !== "approval" ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {projects.map((project) => <ProjectPreviewCard key={project.projectId} project={project} selected={activeProject?.projectId === project.projectId} onSelect={selectProject} />)}
            </div>
          ) : null}
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <MiniReviewWindow project={activeProject} onActivity={() => loadDashboard(activeProject?.projectId)} />
            <BuilderNotificationPanel notifications={visibleNotifications} onToggleRead={toggleNotification} />
          </div>
          {mode !== "projects" ? <ApprovalCenterPanel projects={projects} onSelectProject={selectProject} /> : null}
          <ComponentMappingPanel mappings={visibleMappings} onSelectProject={selectProject} />
        </>
      ) : null}
    </section>
  );
}
