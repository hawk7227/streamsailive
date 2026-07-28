"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProjectWorkspaceShell from "@/components/streams-workspace/ProjectWorkspaceShell";
import StreamsClientShell from "./StreamsClientShell";
import NewChatNavigationVisualSample from "./NewChatNavigationVisualSample";
import StreamsDestinationWorkspace from "./StreamsDestinationWorkspace";
import VideoProductionWorkspace from "./VideoProductionWorkspace";
import ImageProductionWorkspace from "./ImageProductionWorkspace";
import ResearchMarketingWorkspace from "./ResearchMarketingWorkspace";
import AppProductionWorkspace from "./AppProductionWorkspace";
import ProductCampaignWorkspace from "./ProductCampaignWorkspace";

const ACTIVE_PROJECT_KEY = "streams-ai:active-project-id";
const ACTIVE_PROJECT_NAME_KEY = "streams-ai:active-project-name";
const EXPERIENCE_VIEW_KEY = "streams-ai:experience-view";

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

function ProjectCreationDialog({ open, onClose, onCreated }) {
  const supabase = useMemo(() => createClient(), []);
  const [goal, setGoal] = useState("");
  const [references, setReferences] = useState("");
  const [finishedResult, setFinishedResult] = useState("");
  const [constraints, setConstraints] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const projectType = useMemo(() => detectProjectType(goal, finishedResult), [goal, finishedResult]);
  if (!open) return null;

  async function resolveAuthHeaders() {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token?.trim();
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }

  async function createProject(event) {
    event.preventDefault();
    if (!goal.trim()) return setError("Describe what you want to create or complete.");
    setSaving(true); setError("");
    try {
      const authHeaders = await resolveAuthHeaders();
      const name = goal.trim().slice(0, 90);
      const instructions = [`Goal: ${goal.trim()}`, references.trim() ? `Files, notes, or references: ${references.trim()}` : "", finishedResult.trim() ? `Finished result: ${finishedResult.trim()}` : "", constraints.trim() ? `Requirements and constraints: ${constraints.trim()}` : ""].filter(Boolean).join("\n\n");
      const response = await fetch("/api/v1/projects", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `project-${Date.now()}`, ...authHeaders }, credentials: "include", body: JSON.stringify({ name, instructions, metadata: { projectType, goal: goal.trim(), references: references.trim(), finishedResult: finishedResult.trim(), constraints: constraints.trim(), currentStage: "Planning", progress: 5, nextRecommendedAction: "Continue in the StreamsAI workspace", originalPrompt: goal.trim() } }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.project?.id) throw new Error(data?.error || "Project creation failed.");
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, data.project.id);
      window.localStorage.setItem(ACTIVE_PROJECT_NAME_KEY, data.project.name || name);
      window.dispatchEvent(new CustomEvent("streams-ai:active-project-changed", { detail: data.project }));
      onCreated(data.project);
    } catch (creationError) { setError(creationError instanceof Error ? creationError.message : "Project creation failed."); }
    finally { setSaving(false); }
  }

  return <div className="projectCreationBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="projectCreationDialog" role="dialog" aria-modal="true" onSubmit={createProject}><header><div><strong>Create a StreamsAI project</strong><span>Streams will select the correct workspace automatically.</span></div><button type="button" onClick={onClose}>×</button></header><label><span>1. What do you want to create or complete?</span><textarea value={goal} onChange={(e) => setGoal(e.target.value)} autoFocus required /></label><label><span>2. Do you have files, images, notes, or references?</span><textarea value={references} onChange={(e) => setReferences(e.target.value)} /></label><label><span>3. What should the finished result look like?</span><textarea value={finishedResult} onChange={(e) => setFinishedResult(e.target.value)} /></label><label><span>4. Are there requirements or constraints?</span><textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} /></label><div className="detectedProjectType"><span>Detected workspace</span><strong>{projectType}</strong></div>{error ? <p role="alert">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Creating…" : "Create and open project"}</button></footer></form></div>;
}

function readDestination() { if (typeof window === "undefined") return ""; return new URL(window.location.href).searchParams.get("destination") || ""; }

export default function StreamsUniversalExperience() {
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [destination, setDestination] = useState("");

  function changeView(nextView) {
    const safeView = nextView === "workspace" ? "workspace" : "chat";
    setActiveView(safeView);
    window.localStorage.setItem(EXPERIENCE_VIEW_KEY, safeView);
    const url = new URL(window.location.href);
    url.searchParams.set("view", safeView);
    if (safeView === "workspace") url.searchParams.delete("destination");
    window.history.replaceState(window.history.state, "", url.toString());
    window.dispatchEvent(new CustomEvent("streams-ai:experience-view-changed", { detail: { view: safeView } }));
  }

  useEffect(() => {
    const urlView = new URL(window.location.href).searchParams.get("view");
    const storedView = window.localStorage.getItem(EXPERIENCE_VIEW_KEY);
    setDestination(readDestination());
    setActiveView(urlView === "workspace" || storedView === "workspace" ? "workspace" : "chat");
    setReady(true);
  }, []);

  useEffect(() => {
    function syncDestination(event) { const explicit = event?.detail?.destination; setDestination(explicit && explicit !== "home" && explicit !== "workspace" ? explicit : readDestination()); if (explicit && explicit !== "workspace") setActiveView("chat"); }
    function openProjectCreation() { setCreating(true); }
    function setExperienceView(event) { changeView(event?.detail?.view); }
    window.addEventListener("popstate", syncDestination);
    window.addEventListener("streams-ai:destination-changed", syncDestination);
    window.addEventListener("streams-ai:open-project-creation", openProjectCreation);
    window.addEventListener("streams-ai:set-experience-view", setExperienceView);
    return () => { window.removeEventListener("popstate", syncDestination); window.removeEventListener("streams-ai:destination-changed", syncDestination); window.removeEventListener("streams-ai:open-project-creation", openProjectCreation); window.removeEventListener("streams-ai:set-experience-view", setExperienceView); };
  }, []);

  if (!ready) return <main aria-label="Streams loading" style={{ minHeight: "100svh", background: "#080b18" }} />;
  const isStandaloneVideo = destination === "video-studio";
  const isStandaloneImage = destination === "image-studio";
  const isStandaloneResearch = destination === "social-research";
  const isStandaloneApp = destination === "app-builder";
  const isStandaloneCampaign = destination === "business-builder";
  const isStandaloneCreative = isStandaloneVideo || isStandaloneImage || isStandaloneResearch || isStandaloneApp || isStandaloneCampaign;
  const showWorkspaceNavigation = pathname === "/streams-ai" && activeView === "chat" && !isStandaloneCreative;
  const destinationView = isStandaloneCampaign ? <ProductCampaignWorkspace /> : isStandaloneVideo ? <VideoProductionWorkspace /> : isStandaloneImage ? <ImageProductionWorkspace /> : isStandaloneResearch ? <ResearchMarketingWorkspace /> : isStandaloneApp ? <AppProductionWorkspace /> : <StreamsDestinationWorkspace destination={destination} onNewProject={() => setCreating(true)} />;

  return <div className={showWorkspaceNavigation ? "streamsUniversalExperience withNewChatVisualSample" : "streamsUniversalExperience"} data-active-view={activeView} data-one-streams-app="true">{activeView === "chat" ? <>{showWorkspaceNavigation ? <NewChatNavigationVisualSample onNewProject={() => setCreating(true)} /> : null}{destination ? <div className={isStandaloneCreative ? "streamsDestinationFrame standaloneCreativeFrame" : "streamsDestinationFrame"}>{destinationView}</div> : <StreamsClientShell />}</> : <ProjectWorkspaceShell />}<ProjectCreationDialog open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); changeView("workspace"); }} /><style jsx global>{`
    .streamsUniversalExperience{min-height:100svh;background:#020713}.streamsDestinationFrame{min-width:0;min-height:100dvh;background:#fff}.standaloneCreativeFrame{width:100%;margin:0}@media(min-width:901px){.withNewChatVisualSample>.streamsDestinationFrame{margin-left:224px;width:calc(100% - 224px)}}@media(max-width:900px){.streamsDestinationFrame{width:100%;margin-left:0}}.projectCreationBackdrop{position:fixed;inset:0;z-index:70000;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.82);backdrop-filter:blur(8px)}.projectCreationDialog{width:min(680px,100%);max-height:calc(100svh - 36px);overflow:auto;display:grid;gap:14px;padding:18px;border:1px solid rgba(96,165,250,.35);border-radius:18px;background:#07101f;color:#f8fafc}.projectCreationDialog header,.projectCreationDialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.projectCreationDialog header div{display:grid}.projectCreationDialog label{display:grid;gap:6px}.projectCreationDialog textarea{min-height:72px;resize:vertical;border:1px solid rgba(148,163,184,.28);border-radius:10px;background:#0b1424;color:#f8fafc;padding:10px}.detectedProjectType{display:flex;justify-content:space-between;padding:10px;background:#0f1a2d}.projectCreationDialog p{color:#fca5a5}.projectCreationDialog footer{justify-content:flex-end}.projectCreationDialog footer button{min-height:38px;padding:0 14px;border:1px solid rgba(148,163,184,.3);border-radius:9px;background:#111827;color:#e2e8f0}.projectCreationDialog footer button[type=submit]{background:#1d4ed8;color:#fff}@media(max-width:560px){.projectCreationBackdrop{padding:10px}.projectCreationDialog{max-height:calc(100svh - 20px);padding:14px}}
  `}</style></div>;
}
