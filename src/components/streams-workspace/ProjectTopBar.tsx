"use client";

import { useProjectWorkspace } from "./ProjectWorkspaceController";

export default function ProjectTopBar() {
  const { state, setGlobalNav, setTrayTab, toggleFullscreenCanvas, toggleTray } = useProjectWorkspace();

  function returnToChat() {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "chat");
    window.localStorage.setItem("streams-ai:experience-view", "chat");
    window.location.assign(url.toString());
  }

  function openPreview() {
    toggleFullscreenCanvas();
    window.setTimeout(() => document.querySelector<HTMLElement>(".stationViewport iframe,.stationViewport")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  async function shareProject() {
    const data = { title: state.projectName, text: `${state.projectName} · ${state.projectType}`, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else await navigator.clipboard?.writeText(window.location.href).catch(() => {});
  }

  function exportProject() {
    const payload = {
      projectId: state.projectId,
      projectName: state.projectName,
      projectType: state.projectType,
      projectStatus: state.projectStatus,
      currentStage: state.currentStage,
      progress: state.progress,
      nextAction: state.nextAction,
      exportedAt: new Date().toISOString(),
    };
    const href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${state.projectName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "streams-project"}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function openCompletionReview() {
    setTrayTab("Verification");
  }

  return (
    <header className="projectTopBar">
      <div className="projectIdentity">
        <button type="button" className="brandButton" aria-label="Return to StreamsAI chat" onClick={returnToChat}>S</button>
        <div className="projectTitleBlock">
          <strong>{state.projectName}</strong>
          <span>{state.projectType} · {state.projectStatus} · {state.saveStatus}</span>
        </div>
      </div>
      <nav aria-label="Project actions" className="projectActions">
        <button type="button" onClick={() => setTrayTab("Versions")}>Version history</button>
        <button type="button" onClick={openPreview}>Preview</button>
        <button type="button" onClick={() => void shareProject()}>Share</button>
        <button type="button" onClick={exportProject}>Export</button>
        <button type="button" className="primaryAction" onClick={openCompletionReview}>Publish / Complete</button>
        <button type="button" aria-label="User profile" className="profileButton" onClick={() => setGlobalNav("Settings")}>MH</button>
        <button type="button" className="trayControl" onClick={toggleTray} aria-label="Toggle bottom tray">Tray</button>
      </nav>
    </header>
  );
}
