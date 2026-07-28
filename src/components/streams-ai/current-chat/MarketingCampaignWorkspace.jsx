"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileImage,
  LoaderCircle,
  Megaphone,
  Menu,
  RefreshCw,
  Rocket,
  Share2,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

const ACTIVE_PROJECT_KEY = "streams-ai:active-project-id";
const CAMPAIGN_IMAGE = "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1800&q=84";
const OWNER_IMAGE = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=84";
const CREATIVE_IMAGES = [
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=82",
];

const DEFAULT_CAMPAIGN = {
  objective: "Launch a coordinated spring product campaign that increases qualified traffic and converts first-time buyers.",
  audience: "Growth-minded customers ages 24–44 who value premium design, convenience, and clear product benefits.",
  offer: "Spring Refresh — discover the new collection with an introductory launch offer.",
  budget: 12500,
  startDate: "2026-08-10",
  endDate: "2026-09-07",
  status: "Planning",
  channels: ["Email", "Social", "Landing page"],
  assets: [
    { name: "Launch hero", type: "Landing page", status: "Ready" },
    { name: "Product reveal", type: "Social ad", status: "In review" },
    { name: "Welcome sequence", type: "Email", status: "Draft" },
  ],
  schedule: [
    { date: "Aug 10", label: "Teaser", channel: "Social" },
    { date: "Aug 14", label: "Launch", channel: "Email" },
    { date: "Aug 18", label: "Proof", channel: "Landing page" },
    { date: "Aug 25", label: "Retarget", channel: "Social" },
  ],
};

function mergeCampaign(project) {
  const saved = project?.metadata?.campaign && typeof project.metadata.campaign === "object" ? project.metadata.campaign : {};
  return { ...DEFAULT_CAMPAIGN, ...saved };
}

export default function MarketingCampaignWorkspace({ onNewProject }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, profile, membershipRole, workspaceLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [campaign, setCampaign] = useState(DEFAULT_CAMPAIGN);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [activeTop, setActiveTop] = useState("Overview");
  const [activeLeft, setActiveLeft] = useState("Product");
  const [activeBottom, setActiveBottom] = useState("Ads");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const ownerName = profile?.full_name || user?.email || "Workspace owner";
  const canEdit = membershipRole === "owner" || membershipRole === "admin" || membershipRole === "member";

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [supabase]);

  const loadProject = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const headers = await authHeaders();
      const activeId = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
      const url = activeId ? `/api/v1/projects?projectId=${encodeURIComponent(activeId)}` : "/api/v1/projects?limit=1";
      const response = await fetch(url, { credentials: "include", headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Unable to load the campaign project.");
      const nextProject = payload.project || payload.projects?.[0] || null;
      setProject(nextProject);
      setCampaign(mergeCampaign(nextProject));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load the campaign project.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, user]);

  useEffect(() => { loadProject(); }, [loadProject]);

  function updateCampaign(key, value) {
    setCampaign((current) => ({ ...current, [key]: value }));
    setSaveState("unsaved");
  }

  async function saveCampaign() {
    if (!project?.id || !canEdit) return;
    setSaveState("saving");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/v1/projects", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          projectId: project.id,
          metadata: {
            campaign,
            projectType: "Marketing Campaign",
            currentStage: campaign.status,
            nextRecommendedAction: "Review launch readiness and publish approved campaign assets",
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Campaign save failed.");
      setProject(payload.project);
      setSaveState("saved");
    } catch (error) {
      setSaveState("failed");
      setLoadError(error instanceof Error ? error.message : "Campaign save failed.");
    }
  }

  async function shareCampaign() {
    const shareData = { title: project?.name || "Streams campaign", text: campaign.objective, url: window.location.href };
    if (navigator.share) await navigator.share(shareData).catch(() => {});
    else await navigator.clipboard?.writeText(window.location.href);
  }

  if (workspaceLoading || loading) {
    return <main className="campaignWorkspace campaignState"><LoaderCircle className="spin"/><strong>Loading campaign workspace…</strong></main>;
  }

  if (!user) {
    return <main className="campaignWorkspace campaignState"><AlertTriangle/><strong>Sign in to open this campaign.</strong><button onClick={() => router.push("/login")}>Sign in</button></main>;
  }

  if (loadError && !project) {
    return <main className="campaignWorkspace campaignState"><AlertTriangle/><strong>Campaign unavailable</strong><p>{loadError}</p><button onClick={loadProject}><RefreshCw size={15}/>Retry</button></main>;
  }

  if (!project) {
    return <main className="campaignWorkspace campaignState"><Megaphone/><strong>No campaign project is active.</strong><p>Create a project, then Streams will connect this workspace to its real data.</p><button onClick={onNewProject}>Create project</button></main>;
  }

  const topContent = {
    Overview: "Campaign command center",
    Calendar: "Schedule and release plan",
    Flow: "Audience journey and channel sequence",
    Performance: "Measurement and conversion goals",
  }[activeTop];

  return (
    <main className="campaignWorkspace">
      <header className="campaignHeader">
        <div className="campaignTitle"><strong>{project.name}</strong><span>Campaign</span><em className={`save-${saveState}`}>{saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "failed" ? "Save failed" : "Saved"}</em></div>
        <div className="campaignHeaderActions">
          <button onClick={() => setPreviewOpen(true)}><Eye size={14}/>Preview</button>
          <button onClick={shareCampaign}><Share2 size={14}/>Share</button>
          <button onClick={() => window.print()}><Download size={14}/>Export</button>
          <button className="primary" disabled={!canEdit} onClick={() => router.push("/streams-ai/streams-builder/workspace?project=campaign")}><Rocket size={14}/>Launch review</button>
          <button className="mobileInspectorButton" onClick={() => setInspectorOpen(true)} aria-label="Open campaign controls"><Menu size={18}/></button>
        </div>
      </header>

      <nav className="campaignTopTabs" aria-label="Campaign workspace views">
        {["Overview", "Calendar", "Flow", "Performance"].map((tab) => <button key={tab} className={activeTop === tab ? "active" : ""} onClick={() => setActiveTop(tab)}>{tab}</button>)}
      </nav>

      <div className="campaignBody">
        <aside className="campaignRail" aria-label="Campaign sections">
          {["Product", "Audience", "Messaging", "Channels", "Campaign Assets", "Schedule"].map((item) => <button key={item} className={activeLeft === item ? "active" : ""} onClick={() => setActiveLeft(item)}>{item === "Audience" ? <Users size={15}/> : item === "Schedule" ? <CalendarDays size={15}/> : item === "Product" ? <Target size={15}/> : <Megaphone size={15}/>}<span>{item}</span></button>)}
        </aside>

        <section className="campaignCanvas">
          <div className="campaignContext"><span>{topContent}</span><strong>{activeLeft}</strong></div>
          <div className="campaignHero">
            <img src={CAMPAIGN_IMAGE} alt="Spring product campaign creative"/>
            <div><small>New launch</small><h1>Spring Refresh</h1><p>New look. More power.</p><button onClick={() => setActiveBottom("Landing Pages")}>Open launch page</button></div>
          </div>

          <div className="campaignCommandBar">
            <label><span>Goal</span><input value={campaign.objective} onChange={(event) => updateCampaign("objective", event.target.value)}/></label>
            <label><span>Budget</span><input type="number" value={campaign.budget} onChange={(event) => updateCampaign("budget", Number(event.target.value))}/></label>
            <label><span>Start</span><input type="date" value={campaign.startDate} onChange={(event) => updateCampaign("startDate", event.target.value)}/></label>
            <label><span>End</span><input type="date" value={campaign.endDate} onChange={(event) => updateCampaign("endDate", event.target.value)}/></label>
            <button disabled={saveState === "saving" || !canEdit} onClick={saveCampaign}>{saveState === "saving" ? "Saving…" : "Save campaign"}</button>
          </div>

          {activeTop === "Overview" ? <>
            <div className="campaignOwner"><img src={profile?.avatar_url || OWNER_IMAGE} alt={`${ownerName}, campaign owner`}/><span><strong>{ownerName}</strong><small>Campaign owner · {membershipRole || "member"}</small></span></div>
            <div className="campaignCreativeGrid">{campaign.assets.map((asset, index) => <button key={asset.name} onClick={() => setActiveBottom(asset.type === "Email" ? "Emails" : asset.type === "Social ad" ? "Social Graphics" : "Landing Pages")}><img src={CREATIVE_IMAGES[index % CREATIVE_IMAGES.length]} alt={`${asset.name} creative`}/><span><strong>{asset.name}</strong><small>{asset.type} · {asset.status}</small></span></button>)}</div>
          </> : null}

          {activeTop === "Calendar" ? <div className="campaignSchedule">{campaign.schedule.map((item) => <button key={`${item.date}-${item.label}`}><span>{item.date}</span><strong>{item.label}</strong><small>{item.channel}</small></button>)}</div> : null}

          {activeTop === "Flow" ? <div className="campaignFlow">{["Awareness", "Consideration", "Conversion", "Retention"].map((stage, index) => <div key={stage}><span>{index + 1}</span><strong>{stage}</strong><small>{campaign.channels[index % campaign.channels.length]}</small></div>)}</div> : null}

          {activeTop === "Performance" ? <div className="campaignMetrics">{[["Planned spend", `$${campaign.budget.toLocaleString("en-US")}`], ["Target leads", "1,250"], ["Target conversion", "4.2%"], ["Target ROAS", "3.5×"]].map(([label, value]) => <div key={label}><BarChart3/><span>{label}</span><strong>{value}</strong></div>)}</div> : null}
        </section>

        <aside className={`campaignInspector ${inspectorOpen ? "open" : ""}`} aria-label="Campaign controls">
          <div className="inspectorMobileHeader"><strong>Campaign controls</strong><button onClick={() => setInspectorOpen(false)} aria-label="Close campaign controls"><X size={18}/></button></div>
          <nav>{["Properties", "Copy", "A.S.K. AI"].map((tab) => <button key={tab} className={activeBottom === `inspector:${tab}` ? "active" : ""} onClick={() => setActiveBottom(`inspector:${tab}`)}>{tab}</button>)}</nav>
          <div className="campaignInspectorFields">
            <label><span>Project title</span><input value={project.name} readOnly/></label>
            <label><span>Status</span><select value={campaign.status} onChange={(event) => updateCampaign("status", event.target.value)}><option>Planning</option><option>In production</option><option>Ready for review</option><option>Published</option></select></label>
            <label><span>Audience</span><textarea value={campaign.audience} onChange={(event) => updateCampaign("audience", event.target.value)}/></label>
            <label><span>Offer</span><textarea value={campaign.offer} onChange={(event) => updateCampaign("offer", event.target.value)}/></label>
            <button className="askButton" onClick={() => window.dispatchEvent(new CustomEvent("streams-ai:destination-action", { detail: { destination: "business-builder", action: "improve-campaign", projectId: project.id } }))}><Sparkles size={15}/>Improve with A.S.K. AI</button>
          </div>
        </aside>
      </div>

      <footer className="campaignBottom">
        <nav>{["Ads", "Emails", "Social Graphics", "Landing Pages", "Campaign Tasks"].map((tab) => <button key={tab} className={activeBottom === tab ? "active" : ""} onClick={() => setActiveBottom(tab)}>{tab}</button>)}</nav>
        <div className="campaignAssetStrip">{campaign.assets.map((asset, index) => <button key={asset.name}><FileImage size={18}/><span><strong>{asset.name}</strong><small>{asset.status}</small></span><em>{index + 1}</em></button>)}</div>
      </footer>

      {previewOpen ? <div className="campaignPreviewBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><section className="campaignPreview" role="dialog" aria-modal="true" aria-label="Campaign preview"><button className="closePreview" onClick={() => setPreviewOpen(false)}><X/></button><img src={CAMPAIGN_IMAGE} alt="Campaign preview"/><div><small>{campaign.offer}</small><h1>Spring Refresh</h1><p>{campaign.objective}</p><button>Shop now</button></div></section></div> : null}

      <style jsx global>{`
        .campaignWorkspace{height:100dvh;display:grid;grid-template-rows:52px 38px minmax(0,1fr) 118px;background:#fff;color:#12203a;font-family:Inter,ui-sans-serif,system-ui;overflow:hidden;min-width:0}.campaignWorkspace button,.campaignWorkspace input,.campaignWorkspace textarea,.campaignWorkspace select{font:inherit}.campaignHeader{display:flex;align-items:center;gap:12px;padding:0 14px;border-bottom:1px solid #dbe2ec}.campaignTitle{display:flex;align-items:center;gap:8px;min-width:0}.campaignTitle strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.campaignTitle span{font-size:9px;color:#2563eb}.campaignTitle em{font-size:8px;font-style:normal}.save-saved{color:#169b62}.save-saving,.save-unsaved{color:#b7791f}.save-failed{color:#dc2626}.campaignHeaderActions{margin-left:auto;display:flex;gap:6px}.campaignHeaderActions button{min-height:30px;border:1px solid #dbe2ec;border-radius:5px;background:#fff;color:#334155;padding:0 9px;display:flex;align-items:center;gap:5px;font-size:9px;font-weight:750}.campaignHeaderActions .primary,.campaignCommandBar>button,.askButton{background:#2463eb;color:#fff;border-color:#2463eb}.mobileInspectorButton{display:none!important}.campaignTopTabs{display:flex;gap:16px;align-items:center;padding:0 14px;border-bottom:1px solid #e5e9f0;overflow:auto}.campaignTopTabs button,.campaignInspector nav button,.campaignBottom nav button{height:100%;border:0;background:transparent;color:#526078;font-size:9px;white-space:nowrap}.campaignTopTabs button.active,.campaignInspector nav button.active,.campaignBottom nav button.active{color:#1d4ed8;border-bottom:2px solid #1d4ed8}.campaignBody{min-height:0;display:grid;grid-template-columns:142px minmax(0,1fr) 250px}.campaignRail{overflow:auto;border-right:1px solid #e5e9f0;padding:8px 6px;scrollbar-width:none}.campaignRail::-webkit-scrollbar,.campaignCanvas::-webkit-scrollbar,.campaignInspector::-webkit-scrollbar{display:none}.campaignRail button{width:100%;display:flex;align-items:center;gap:8px;border:0;border-radius:6px;background:transparent;color:#526078;padding:9px 8px;font-size:10px;text-align:left}.campaignRail button.active{background:#eaf1ff;color:#174fc7}.campaignCanvas{min-width:0;overflow:auto;padding:12px 16px 20px;scrollbar-width:none}.campaignContext{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.campaignContext span{font-size:9px;color:#64748b}.campaignContext strong{font-size:11px}.campaignHero{height:210px;position:relative;overflow:hidden;background:#f8efe9}.campaignHero img{width:100%;height:100%;object-fit:cover}.campaignHero>div{position:absolute;inset:0 auto 0 0;width:min(46%,520px);display:grid;align-content:center;padding:28px;background:linear-gradient(90deg,rgba(255,255,255,.97),rgba(255,255,255,.68),transparent)}.campaignHero h1{font-size:30px;margin:5px 0}.campaignHero p{font-size:12px}.campaignHero button{width:max-content;border:0;border-radius:4px;background:#2463eb;color:#fff;padding:9px 13px}.campaignCommandBar{display:grid;grid-template-columns:minmax(220px,1fr) 110px 125px 125px auto;gap:10px;align-items:end;padding:14px 0;border-bottom:1px solid #e5e9f0}.campaignCommandBar label{display:grid;gap:4px}.campaignCommandBar label span,.campaignInspectorFields label span{font-size:8px;font-weight:750}.campaignCommandBar input,.campaignInspectorFields input,.campaignInspectorFields textarea,.campaignInspectorFields select{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #dbe2ec;background:#fff;padding:7px 2px;font-size:9px}.campaignCommandBar>button{height:32px;border:0;border-radius:5px;padding:0 12px;font-size:9px;font-weight:800}.campaignOwner{display:flex;align-items:center;gap:9px;padding:13px 0;border-bottom:1px solid #e5e9f0}.campaignOwner img{width:42px;height:42px;border-radius:50%;object-fit:cover}.campaignOwner span{display:grid}.campaignOwner small{font-size:8px;color:#64748b}.campaignCreativeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px 0}.campaignCreativeGrid button{border:0;background:transparent;text-align:left;padding:0}.campaignCreativeGrid img{width:100%;height:110px;object-fit:cover}.campaignCreativeGrid span{display:grid;padding-top:6px}.campaignCreativeGrid small{font-size:8px;color:#64748b}.campaignSchedule,.campaignFlow,.campaignMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:22px 0}.campaignSchedule button{border:0;border-top:2px solid #dbe2ec;background:transparent;text-align:left;padding:10px 0;display:grid}.campaignSchedule span,.campaignSchedule small,.campaignFlow small,.campaignMetrics span{font-size:8px;color:#64748b}.campaignFlow>div,.campaignMetrics>div{display:grid;gap:7px;padding:14px 0;border-top:1px solid #dbe2ec}.campaignFlow>div>span{width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:#eaf1ff;color:#1d4ed8}.campaignMetrics svg{color:#2563eb}.campaignMetrics strong{font-size:18px}.campaignInspector{min-height:0;overflow:auto;border-left:1px solid #dbe2ec;scrollbar-width:none;background:#fff}.campaignInspector nav{height:38px;display:flex;overflow:auto;border-bottom:1px solid #e5e9f0;padding:0 9px}.campaignInspectorFields{display:grid;gap:11px;padding:11px}.campaignInspectorFields label{display:grid;gap:5px}.campaignInspectorFields textarea{min-height:70px;resize:vertical}.askButton{border:0;border-radius:5px;padding:10px;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:5px}.inspectorMobileHeader{display:none}.campaignBottom{border-top:1px solid #dbe2ec;overflow:hidden}.campaignBottom nav{height:34px;display:flex;gap:14px;padding:0 12px;border-bottom:1px solid #e5e9f0;overflow:auto}.campaignAssetStrip{height:84px;display:flex;gap:10px;padding:9px;overflow:auto}.campaignAssetStrip button{min-width:170px;border:0;background:transparent;display:flex;align-items:center;gap:9px;text-align:left}.campaignAssetStrip button>span{display:grid}.campaignAssetStrip small{font-size:8px;color:#64748b}.campaignAssetStrip em{margin-left:auto;font-style:normal;color:#94a3b8}.campaignPreviewBackdrop{position:fixed;inset:0;z-index:80000;background:rgba(2,6,23,.75);display:grid;place-items:center;padding:20px}.campaignPreview{width:min(920px,100%);height:min(580px,90dvh);position:relative;overflow:hidden;background:#fff}.campaignPreview>img{width:100%;height:100%;object-fit:cover}.campaignPreview>div{position:absolute;inset:0 auto 0 0;width:48%;display:grid;align-content:center;padding:42px;background:linear-gradient(90deg,#fff,rgba(255,255,255,.84),transparent)}.campaignPreview h1{font-size:42px}.campaignPreview>div>button{width:max-content;border:0;background:#2463eb;color:#fff;padding:10px 15px}.closePreview{position:absolute;z-index:2;right:12px;top:12px;border:0;border-radius:50%;width:36px;height:36px}.campaignState{place-items:center;align-content:center;gap:12px;text-align:center}.campaignState button{border:0;border-radius:6px;background:#2463eb;color:#fff;padding:10px 15px;display:flex;gap:6px;align-items:center}.spin{animation:campaign-spin 1s linear infinite}@keyframes campaign-spin{to{transform:rotate(360deg)}}
        @media(min-width:901px){.withNewChatVisualSample>.streamsDestinationFrame{margin-left:224px;width:calc(100% - 224px);min-width:0}.campaignWorkspace{width:100%}}
        @media(max-width:1050px){.campaignBody{grid-template-columns:118px minmax(0,1fr) 210px}.campaignHeaderActions button:not(.primary):not(.mobileInspectorButton){display:none}.campaignCommandBar{grid-template-columns:1fr 95px 110px 110px}.campaignCommandBar>button{grid-column:1/-1}.campaignCreativeGrid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:760px){.campaignWorkspace{height:auto;min-height:100dvh;grid-template-rows:auto auto auto auto;overflow:visible}.campaignHeader{position:sticky;top:0;z-index:30;min-height:54px;background:#fff}.campaignTitle span{display:none}.campaignHeaderActions .primary{display:none}.mobileInspectorButton{display:flex!important}.campaignBody{display:block}.campaignRail{display:flex;gap:4px;overflow-x:auto;border-right:0;border-bottom:1px solid #e5e9f0;padding:7px}.campaignRail button{min-width:max-content}.campaignCanvas{overflow:visible;padding:10px}.campaignHero{height:260px}.campaignHero>div{width:76%;padding:20px}.campaignHero h1{font-size:26px}.campaignCommandBar{grid-template-columns:1fr 1fr}.campaignCommandBar label:first-child{grid-column:1/-1}.campaignCreativeGrid,.campaignSchedule,.campaignFlow,.campaignMetrics{grid-template-columns:1fr 1fr}.campaignInspector{position:fixed;inset:0 0 0 auto;z-index:70000;width:min(360px,92vw);transform:translateX(105%);transition:transform .2s ease;box-shadow:-18px 0 50px rgba(15,23,42,.2)}.campaignInspector.open{transform:translateX(0)}.inspectorMobileHeader{height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #e5e9f0}.inspectorMobileHeader button{border:0;background:transparent}.campaignBottom{height:auto}.campaignAssetStrip{height:auto}.campaignPreview>div{width:74%;padding:24px}.campaignPreview h1{font-size:30px}}
        @media(max-width:480px){.campaignCreativeGrid,.campaignSchedule,.campaignFlow,.campaignMetrics{grid-template-columns:1fr}.campaignCommandBar{grid-template-columns:1fr}.campaignCommandBar label{grid-column:1!important}.campaignHero{height:300px}.campaignHero>div{width:88%}}
        @media print{.newChatNavigationVisualSample,.campaignRail,.campaignInspector,.campaignBottom,.campaignHeaderActions,.campaignTopTabs{display:none!important}.withNewChatVisualSample>.streamsDestinationFrame{margin:0!important;width:100%!important}.campaignWorkspace{display:block;height:auto}.campaignCanvas{overflow:visible}.campaignHero{height:360px}}
      `}</style>
    </main>
  );
}
