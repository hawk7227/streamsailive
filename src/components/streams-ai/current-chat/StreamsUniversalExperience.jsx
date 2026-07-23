"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import StreamsClientShell from "./StreamsClientShell";
import NewChatNavigationVisualSample from "./NewChatNavigationVisualSample";

const ACTIVE_PROJECT_KEY = "streams-ai:active-project-id";
const ACTIVE_PROJECT_NAME_KEY = "streams-ai:active-project-name";

function detectProjectType(goal = "", finishedResult = "") {
  const text = `${goal} ${finishedResult}`.toLowerCase();
  if (/website|landing page|web app|frontend|react|next\.js|code|software|application|api|github|repository/.test(text)) return "Coding / Application";
  if (/campaign|advertis|marketing|social media|email campaign|promotion/.test(text)) return "Marketing Campaign";
  if (/document|report|proposal|paper|guide|ebook|book/.test(text)) return "Document / Report";
  if (/brand|logo|image|visual|graphic|photo/.test(text)) return "Image / Brand";
  if (/video|film|movie|animation|storyboard/.test(text)) return "Video";
  if (/research|compare|analysis|study|investigate/.test(text)) return "Research";
  if (/presentation|slide|pitch deck/.test(text)) return "Presentation";
  return "Generic Project";
}

function routeForProjectType(projectType) {
  if (projectType === "Research") return "/streams-ai/streams-builder/research";
  if (projectType === "Video") return "/streams-ai/streams-builder/gen-video";
  return "/streams-ai/streams-builder/workspace";
}

function ProjectCreationDialog({ open, onClose, onCreated }) {
  const [goal, setGoal] = useState("");
  const [references, setReferences] = useState("");
  const [finishedResult, setFinishedResult] = useState("");
  const [constraints, setConstraints] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const projectType = useMemo(() => detectProjectType(goal, finishedResult), [goal, finishedResult]);
  if (!open) return null;

  async function createProject(event) {
    event.preventDefault();
    if (!goal.trim()) {
      setError("Describe what you want to create or complete.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const name = goal.trim().slice(0, 90);
      const instructions = [
        `Goal: ${goal.trim()}`,
        references.trim() ? `Files, notes, or references: ${references.trim()}` : "",
        finishedResult.trim() ? `Finished result: ${finishedResult.trim()}` : "",
        constraints.trim() ? `Requirements and constraints: ${constraints.trim()}` : "",
      ].filter(Boolean).join("\n\n");
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `project-${Date.now()}` },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          instructions,
          metadata: {
            projectType,
            goal: goal.trim(),
            references: references.trim(),
            finishedResult: finishedResult.trim(),
            constraints: constraints.trim(),
            currentStage: "Planning",
            progress: 5,
            nextRecommendedAction: projectType === "Coding / Application" ? "Open the builder workspace" : "Open the dedicated project workspace",
            originalPrompt: goal.trim(),
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.project?.id) throw new Error(data?.error || "Project creation failed.");
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, data.project.id);
      window.localStorage.setItem(ACTIVE_PROJECT_NAME_KEY, data.project.name || name);
      window.dispatchEvent(new CustomEvent("streams-ai:active-project-changed", { detail: data.project }));
      onCreated(data.project, projectType);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Project creation failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="projectCreationBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="projectCreationDialog" role="dialog" aria-modal="true" aria-labelledby="project-creation-title" onSubmit={createProject}>
        <header><div><strong id="project-creation-title">Create a StreamsAI project</strong><span>Streams will select the correct project workspace automatically.</span></div><button type="button" onClick={onClose} aria-label="Close project creation">×</button></header>
        <label><span>1. What do you want to create or complete?</span><textarea value={goal} onChange={(event) => setGoal(event.target.value)} autoFocus required /></label>
        <label><span>2. Do you have files, images, notes, or references?</span><textarea value={references} onChange={(event) => setReferences(event.target.value)} /></label>
        <label><span>3. What should the finished result look like?</span><textarea value={finishedResult} onChange={(event) => setFinishedResult(event.target.value)} /></label>
        <label><span>4. Are there requirements or constraints?</span><textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} /></label>
        <div className="detectedProjectType"><span>Detected workspace</span><strong>{projectType}</strong></div>
        {error ? <p role="alert">{error}</p> : null}
        <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Creating…" : "Create and open project"}</button></footer>
      </form>
    </div>
  );
}

export default function StreamsUniversalExperience() {
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeProjectName, setActiveProjectName] = useState("");

  useEffect(() => {
    setActiveProjectName(window.localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "");
    setReady(true);
  }, []);

  useEffect(() => {
    function openProjectCreation() { setCreating(true); }
    window.addEventListener("streams-ai:open-project-creation", openProjectCreation);
    return () => window.removeEventListener("streams-ai:open-project-creation", openProjectCreation);
  }, []);

  if (!ready) return <main aria-label="Streams loading" style={{ minHeight: "100svh", background: "#080b18" }} />;

  const showNewChatSample = pathname === "/streams-ai";

  return (
    <div className={showNewChatSample ? "streamsUniversalExperience withNewChatVisualSample" : "streamsUniversalExperience"} data-active-view="chat">
      {showNewChatSample ? <NewChatNavigationVisualSample onNewProject={() => setCreating(true)} /> : null}
      <StreamsClientShell />
      <nav className="experienceSwitcher" aria-label="Streams experience">
        <div className="experienceIdentity"><strong>StreamsAI</strong><span>{activeProjectName || "General assistant"}</span></div>
        <div className="experienceModes">
          <button type="button" className="active">Chat</button>
          <button type="button" onClick={() => router.push("/streams-ai/streams-builder/workspace")}>Workspace</button>
          <button type="button" onClick={() => router.push("/streams-ai/streams-builder/research")}>Research</button>
          <button type="button" onClick={() => router.push("/streams-ai/streams-builder/gen-video")}>Generate</button>
        </div>
        <button type="button" className="createProjectAction" onClick={() => setCreating(true)}>New project</button>
      </nav>
      <ProjectCreationDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(project, projectType) => {
          setActiveProjectName(project.name || "Project");
          setCreating(false);
          router.push(routeForProjectType(projectType));
        }}
      />
      <style jsx global>{`
        .streamsUniversalExperience{min-height:100svh;background:#020713}
        .streamsUniversalExperience.withNewChatVisualSample .experienceSwitcher{left:244px}
        .experienceSwitcher{position:fixed;top:8px;left:84px;right:12px;z-index:50000;height:42px;display:grid;grid-template-columns:minmax(150px,1fr) auto auto;align-items:center;gap:10px;padding:0 8px 0 12px;border:1px solid rgba(148,163,184,.2);border-radius:11px;background:rgba(7,16,31,.96);box-shadow:0 10px 30px rgba(0,0,0,.28);backdrop-filter:blur(14px);transition:left .8s ease}
        .experienceIdentity{min-width:0;display:grid;gap:1px}.experienceIdentity strong{font-size:12px;color:#f8fafc}.experienceIdentity span{font-size:9px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .experienceModes{display:flex;align-items:center;gap:4px}.experienceSwitcher button{min-height:30px;max-width:220px;padding:0 11px;border:1px solid transparent;border-radius:8px;background:transparent;color:#aebed4;font-size:10px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.experienceSwitcher button:hover{background:#111c31;color:#e2e8f0}.experienceSwitcher button.active{background:#1d4ed8;border-color:#3b82f6;color:#fff}.experienceSwitcher .createProjectAction{background:#065f46;border-color:#047857;color:#d1fae5}
        .projectCreationBackdrop{position:fixed;inset:0;z-index:70000;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.82);backdrop-filter:blur(8px)}
        .projectCreationDialog{width:min(680px,100%);max-height:calc(100svh - 36px);overflow:auto;display:grid;gap:14px;padding:18px;border:1px solid rgba(96,165,250,.35);border-radius:18px;background:#07101f;color:#f8fafc;box-shadow:0 24px 80px rgba(0,0,0,.55)}
        .projectCreationDialog header,.projectCreationDialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.projectCreationDialog header div{display:grid;gap:3px}.projectCreationDialog header strong{font-size:17px}.projectCreationDialog header span{font-size:11px;color:#94a3b8}.projectCreationDialog header button{width:34px;height:34px;border:1px solid rgba(148,163,184,.3);border-radius:9px;background:#111827;color:#fff;font-size:20px}
        .projectCreationDialog label{display:grid;gap:6px}.projectCreationDialog label span{font-size:11px;font-weight:800;color:#bfdbfe}.projectCreationDialog textarea{min-height:72px;resize:vertical;border:1px solid rgba(148,163,184,.28);border-radius:10px;background:#0b1424;color:#f8fafc;padding:10px;font:inherit;line-height:1.45}.projectCreationDialog textarea:focus{outline:2px solid #3b82f6;outline-offset:1px}
        .detectedProjectType{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border-radius:10px;background:#0f1a2d}.detectedProjectType span{font-size:10px;color:#94a3b8}.detectedProjectType strong{font-size:12px;color:#6ee7b7}.projectCreationDialog p{margin:0;color:#fca5a5;font-size:12px}.projectCreationDialog footer{justify-content:flex-end}.projectCreationDialog footer button{min-height:38px;padding:0 14px;border:1px solid rgba(148,163,184,.3);border-radius:9px;background:#111827;color:#e2e8f0;font-weight:800}.projectCreationDialog footer button[type=submit]{background:#1d4ed8;border-color:#3b82f6;color:#fff}.projectCreationDialog footer button:disabled{opacity:.6}
        @media(max-width:900px){.experienceSwitcher,.streamsUniversalExperience.withNewChatVisualSample .experienceSwitcher{top:7px;left:202px;right:8px;height:42px;grid-template-columns:minmax(0,1fr) auto;padding-left:10px}.experienceModes{display:none}.experienceSwitcher .createProjectAction{min-width:96px}.experienceIdentity strong{font-size:11px}.experienceIdentity span{font-size:8px}}
        @media(max-width:560px){.experienceSwitcher,.streamsUniversalExperience.withNewChatVisualSample .experienceSwitcher{left:198px}.experienceSwitcher .createProjectAction{min-width:84px;padding:0 8px}.projectCreationBackdrop{padding:10px}.projectCreationDialog{max-height:calc(100svh - 20px);border-radius:14px;padding:14px}}
      `}</style>
    </div>
  );
}
