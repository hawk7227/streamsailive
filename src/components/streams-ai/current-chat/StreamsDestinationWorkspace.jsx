"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlay,
  Download,
  FileText,
  Image as ImageIcon,
  Layers3,
  Mic2,
  Plus,
  Search,
  Send,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
  Workflow,
  Wrench,
} from "lucide-react";

const PEOPLE = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=82",
];

const WORK = [
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=82",
];

const VISUALS = [
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1400&q=82",
];

const PAGE = {
  portfolio: { title: "Portfolio", eyebrow: "Present completed work", pitch: "Turn finished projects into a polished body of work that wins trust, clients, and opportunities.", variant: "showcase", action: "Create portfolio", images: [PEOPLE[0], VISUALS[3], WORK[0]], tools: ["Publish collection", "Share private link", "Export case study"] },
  projects: { title: "Projects", eyebrow: "One goal. Every connected asset.", pitch: "Keep conversations, files, tasks, generations, builds, and approvals together from first idea to finished result.", variant: "manage", action: "New project", images: [WORK[1], PEOPLE[1], VISUALS[0]], tools: ["Project brief", "Milestones", "Connected files"] },
  files: { title: "Files", eyebrow: "Your source material, ready for work", pitch: "Upload documents, images, video, audio, and code so A.S.K. AI can understand and use the right context.", variant: "manage", action: "Upload files", images: [WORK[2], PEOPLE[2], VISUALS[1]], tools: ["Upload", "Extract", "Organize"] },
  "creator-studio": { title: "Creator Studio", eyebrow: "Create across every medium", pitch: "Start with the outcome. Streams coordinates imagery, motion, voice, captions, and content into one connected production flow.", variant: "studio", action: "Start creating", images: [PEOPLE[3], VISUALS[4], VISUALS[2]], tools: ["Creative brief", "Media plan", "Production queue"] },
  "image-studio": { title: "Image Studio", eyebrow: "From prompt to campaign-ready visual", pitch: "Generate, refine, and organize original imagery for products, brands, campaigns, and stories.", variant: "studio", action: "Create image", images: [VISUALS[0], PEOPLE[0], VISUALS[3]], tools: ["Prompt", "Reference image", "Style controls"] },
  "video-studio": { title: "Video Studio", eyebrow: "Ideas in motion", pitch: "Plan scenes, generate clips, add voice and captions, then export platform-ready video from one workspace.", variant: "studio", action: "Create video", images: [VISUALS[1], PEOPLE[4], VISUALS[2]], tools: ["Scene plan", "Generate", "Edit"] },
  "voice-studio": { title: "Voice Studio", eyebrow: "Clear voices for every story", pitch: "Create narration, dubbing, spoken content, and campaign audio while keeping scripts and versions organized.", variant: "studio", action: "Create voice", images: [PEOPLE[5], WORK[3], PEOPLE[1]], tools: ["Script", "Voice direction", "Audio versions"] },
  "business-builder": { title: "Business Builder", eyebrow: "Build the business, not just the idea", pitch: "Shape your offer, audience, revenue model, launch plan, and connected assets in one execution workspace.", variant: "launch", action: "Build my business", images: [WORK[0], PEOPLE[1], WORK[4]], tools: ["Offer", "Market", "Launch"] },
  "website-builder": { title: "Website Builder", eyebrow: "A website designed around results", pitch: "Move from business goal to responsive pages, working forms, verified behavior, and launch-ready code.", variant: "launch", action: "Build website", images: [WORK[2], PEOPLE[0], VISUALS[4]], tools: ["Brief", "Design", "Build"] },
  "app-builder": { title: "App Builder", eyebrow: "Build software people can actually use", pitch: "Plan flows, create interfaces, connect data, test behavior, and prepare a working application for release.", variant: "launch", action: "Build application", images: [WORK[4], PEOPLE[4], WORK[1]], tools: ["Product map", "Implementation", "Verification"] },
  "visual-concepts": { title: "Visual Concepts", eyebrow: "Find the direction before production", pitch: "Explore mood, color, layout, photography, and brand systems before committing time and credits.", variant: "showcase", action: "Create concept", images: [VISUALS[4], PEOPLE[2], VISUALS[0]], tools: ["Moodboard", "Direction", "Approval"] },
  revenue: { title: "Revenue", eyebrow: "Design the path to profitable growth", pitch: "Model offers, packages, pricing, funnels, and margins while connecting strategy to launch execution.", variant: "insight", action: "Build revenue plan", images: [PEOPLE[1], WORK[3], PEOPLE[3]], tools: ["Offer model", "Margin view", "Sales path"] },
  "preview-launch": { title: "Preview + Launch", eyebrow: "Release only when the work is ready", pitch: "Review live previews, approvals, verification evidence, and launch requirements before publishing.", variant: "launch", action: "Open launch review", images: [WORK[4], VISUALS[2], PEOPLE[5]], tools: ["Preview", "Verify", "Publish"] },
  content: { title: "Content", eyebrow: "Write once. Adapt everywhere.", pitch: "Create useful articles, emails, scripts, product copy, and campaigns with an organized editorial workflow.", variant: "editorial", action: "Create content", images: [PEOPLE[0], WORK[2], PEOPLE[4]], tools: ["Brief", "Draft", "Distribute"] },
  captions: { title: "Captions", eyebrow: "Make every post earn attention", pitch: "Turn media and campaign goals into platform-ready hooks, captions, calls to action, and variants.", variant: "editorial", action: "Write captions", images: [PEOPLE[3], VISUALS[3], PEOPLE[5]], tools: ["Hook", "Caption", "Platform variants"] },
  ideas: { title: "Ideas", eyebrow: "Capture possibility. Choose what matters.", pitch: "Explore, score, and develop product, content, campaign, and business ideas before turning them into projects.", variant: "insight", action: "Start an idea", images: [PEOPLE[2], WORK[1], VISUALS[1]], tools: ["Explore", "Evaluate", "Promote to project"] },
  "turn-this-into-you": { title: "Turn This Into You", eyebrow: "Adapt inspiration to your identity", pitch: "Transform a reference into an original direction shaped around your brand, voice, audience, and goals.", variant: "showcase", action: "Personalize concept", images: [PEOPLE[5], VISUALS[4], PEOPLE[0]], tools: ["Reference", "Identity", "Original result"] },
  "social-research": { title: "Social Research", eyebrow: "Understand what audiences respond to", pitch: "Collect public signals, compare formats, study competitors, and turn findings into an actionable content plan.", variant: "insight", action: "Start research", images: [PEOPLE[4], WORK[0], VISUALS[2]], tools: ["Research set", "Patterns", "Content brief"] },
  calendar: { title: "Calendar", eyebrow: "See the work before it becomes urgent", pitch: "Coordinate launches, content, milestones, reviews, and deadlines across every active project.", variant: "manage", action: "Schedule work", images: [WORK[3], PEOPLE[2], WORK[1]], tools: ["Schedule", "Campaigns", "Milestones"] },
  assets: { title: "Assets", eyebrow: "Every reusable output in one place", pitch: "Find generated media, approved deliverables, source files, and exports by project, type, and status.", variant: "showcase", action: "Add asset", images: [VISUALS[3], VISUALS[1], PEOPLE[3]], tools: ["Library", "Collections", "Versions"] },
  tasks: { title: "Tasks", eyebrow: "Keep execution moving", pitch: "Turn plans into owned, prioritized work connected to the exact project, file, or deliverable it advances.", variant: "manage", action: "Add task", images: [WORK[4], PEOPLE[1], WORK[2]], tools: ["My work", "Priorities", "Approvals"] },
  history: { title: "History", eyebrow: "Know what changed and why", pitch: "Review conversations, generations, builds, launches, failures, and decisions across your workspace.", variant: "manage", action: "Search history", images: [WORK[1], PEOPLE[4], WORK[0]], tools: ["Timeline", "Activity", "Restore"] },
  automation: { title: "Automation", eyebrow: "Make repeatable work run itself", pitch: "Connect triggers, actions, approvals, and notifications into reliable workflows with visible run history.", variant: "launch", action: "Create automation", images: [WORK[2], PEOPLE[5], WORK[4]], tools: ["Trigger", "Workflow", "Run history"] },
  templates: { title: "Templates", eyebrow: "Start with a proven structure", pitch: "Launch projects, campaigns, builds, and creative workflows from reusable systems you can customize.", variant: "showcase", action: "Use template", images: [VISUALS[2], WORK[3], PEOPLE[0]], tools: ["Browse", "Customize", "Save"] },
  integrations: { title: "Integrations", eyebrow: "Connect the tools your work depends on", pitch: "Manage secure connections, permissions, and workspace access without exposing Streams infrastructure.", variant: "manage", action: "Connect app", images: [WORK[0], PEOPLE[3], WORK[2]], tools: ["Connections", "Permissions", "Health"] },
  search: { title: "Workspace Search", eyebrow: "Find anything across your work", pitch: "Search conversations, projects, files, assets, tasks, and history from one intelligent index.", variant: "insight", action: "Search workspace", images: [PEOPLE[2], WORK[1], VISUALS[0]], tools: ["All results", "Filters", "Recent"] },
};

const DEFAULT_PAGE = PAGE.projects;

function Hero({ page, onPrimary }) {
  return (
    <header className="destinationHero">
      <div className="destinationHeroCopy">
        <span className="destinationEyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.pitch}</p>
        <div className="destinationActions">
          <button type="button" className="destinationPrimary" onClick={onPrimary}>{page.action}<ArrowRight size={16} /></button>
          <button type="button" className="destinationSecondary" onClick={() => document.getElementById("destination-workspace")?.scrollIntoView({ behavior: "smooth" })}>Explore workspace</button>
        </div>
      </div>
      <div className="destinationHeroVisual" aria-label={`${page.title} example`}>
        <img src={page.images[0]} alt="Professional using Streams Workspace" />
        <span>{page.tools[0]}</span>
      </div>
    </header>
  );
}

function StudioWorkspace({ page, onPrimary }) {
  const [prompt, setPrompt] = useState("Create a polished campaign concept with cinematic lighting, modern styling, and a clear focal point.");
  const [active, setActive] = useState(0);
  return <div className="studioWorkspace workspaceVariant">
    <div className="workspaceControls">
      <div className="workspaceHeading"><span>Creative direction</span><strong>Describe the result</strong></div>
      <label className="lineField"><span>Prompt</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
      <div className="controlRow"><label><span>Format</span><select defaultValue="Campaign"><option>Campaign</option><option>Editorial</option><option>Product</option></select></label><label><span>Style</span><select defaultValue="Cinematic"><option>Cinematic</option><option>Natural</option><option>Graphic</option></select></label></div>
      <button type="button" className="destinationPrimary fullAction" onClick={onPrimary}><WandSparkles size={16} />{page.action}</button>
    </div>
    <div className="workspacePreview">
      <img src={page.images[active]} alt={`${page.title} preview`} />
      <div className="previewRail">{page.images.map((image, index) => <button type="button" className={active === index ? "active" : ""} key={image} onClick={() => setActive(index)}><img src={image} alt={`Preview ${index + 1}`} /></button>)}</div>
    </div>
  </div>;
}

function LaunchWorkspace({ page, onPrimary }) {
  const [step, setStep] = useState(1);
  return <div className="launchWorkspace workspaceVariant">
    <div className="launchFlow">
      {page.tools.map((tool, index) => <button type="button" key={tool} className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""} onClick={() => setStep(index + 1)}><span>{step > index + 1 ? <Check size={14} /> : index + 1}</span><strong>{tool}</strong></button>)}
    </div>
    <div className="launchPreview"><img src={page.images[Math.min(step - 1, page.images.length - 1)]} alt={`${page.title} working preview`} /><div className="launchStatus"><span>Stage {step} of {page.tools.length}</span><strong>{page.tools[step - 1]}</strong><p>Review the current direction, continue execution, or return to an earlier stage without losing project context.</p><button type="button" className="destinationPrimary" onClick={step < page.tools.length ? () => setStep(step + 1) : onPrimary}>{step < page.tools.length ? "Continue" : page.action}<ChevronRight size={16} /></button></div></div>
  </div>;
}

function EditorialWorkspace({ page, onPrimary }) {
  const [channel, setChannel] = useState("Campaign");
  return <div className="editorialWorkspace workspaceVariant">
    <div className="editorialBrief"><span>Content brief</span><h2>A practical story built around one clear audience outcome.</h2><p>Use this workspace to move from brief to draft, review, and channel-specific output without duplicating the work.</p><div className="tagLine">{["Campaign", "Email", "Social", "Article"].map((item) => <button type="button" className={channel === item ? "active" : ""} onClick={() => setChannel(item)} key={item}>{item}</button>)}</div><button type="button" className="destinationPrimary" onClick={onPrimary}><Sparkles size={16} />{page.action}</button></div>
    <div className="editorialCanvas"><img src={page.images[0]} alt="Content creator" /><div><span>{channel} draft</span><h3>Make the next step feel obvious.</h3><p>Lead with the audience’s real problem, show the useful change, and close with a specific action they can take now.</p></div></div>
  </div>;
}

function InsightWorkspace({ page, onPrimary }) {
  const [query, setQuery] = useState("");
  return <div className="insightWorkspace workspaceVariant">
    <div className="insightSearch"><span>Ask the workspace</span><div><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${page.title.toLowerCase()}…`} /><button type="button" onClick={onPrimary}><Send size={16} /></button></div><div className="insightSignals">{page.tools.map((tool, index) => <button type="button" key={tool}><span>{index + 1}</span><strong>{tool}</strong><small>{index === 0 ? "12 active signals" : index === 1 ? "Updated today" : "Ready to use"}</small></button>)}</div></div>
    <div className="insightStory"><img src={page.images[0]} alt="Professional reviewing insights" /><div><span>Recommended next move</span><h2>Focus the work where evidence and opportunity overlap.</h2><p>Streams keeps the findings connected to the project so research becomes an executable decision instead of another document.</p><button type="button" className="destinationPrimary" onClick={onPrimary}>{page.action}<ArrowRight size={16} /></button></div></div>
  </div>;
}

function ManageWorkspace({ page, onPrimary }) {
  const rows = page.tools.map((tool, index) => ({ tool, owner: ["You", "A.S.K. AI", "Team"][index % 3], state: ["In progress", "Ready", "Review"][index % 3] }));
  return <div className="manageWorkspace workspaceVariant"><div className="manageToolbar"><div><span>Workspace view</span><h2>{page.title}</h2></div><button type="button" className="destinationPrimary" onClick={onPrimary}><Plus size={16} />{page.action}</button></div><div className="manageTable"><div className="manageHead"><span>Item</span><span>Owner</span><span>Status</span><span /></div>{rows.map((row, index) => <button type="button" className="manageRow" key={row.tool}><span><i>{index + 1}</i><strong>{row.tool}</strong></span><span>{row.owner}</span><span>{row.state}</span><ChevronRight size={16} /></button>)}</div><div className="manageMedia">{page.images.slice(0, 3).map((image, index) => <img key={image} src={image} alt={`${page.title} reference ${index + 1}`} />)}</div></div>;
}

function ShowcaseWorkspace({ page, onPrimary }) {
  const [selected, setSelected] = useState(0);
  return <div className="showcaseWorkspace workspaceVariant"><div className="showcaseMain"><img src={page.images[selected]} alt={`${page.title} featured work`} /><div><span>Featured direction</span><h2>{page.tools[selected] || page.tools[0]}</h2><p>Select work, compare directions, and move the strongest result into production or presentation.</p><button type="button" className="destinationPrimary" onClick={onPrimary}>{page.action}<ArrowRight size={16} /></button></div></div><div className="showcaseStrip">{page.images.map((image, index) => <button type="button" key={image} className={selected === index ? "active" : ""} onClick={() => setSelected(index)}><img src={image} alt={`${page.title} option ${index + 1}`} /><span>{page.tools[index] || `Option ${index + 1}`}</span></button>)}</div></div>;
}

function Workspace({ page, onPrimary }) {
  if (page.variant === "studio") return <StudioWorkspace page={page} onPrimary={onPrimary} />;
  if (page.variant === "launch") return <LaunchWorkspace page={page} onPrimary={onPrimary} />;
  if (page.variant === "editorial") return <EditorialWorkspace page={page} onPrimary={onPrimary} />;
  if (page.variant === "insight") return <InsightWorkspace page={page} onPrimary={onPrimary} />;
  if (page.variant === "showcase") return <ShowcaseWorkspace page={page} onPrimary={onPrimary} />;
  return <ManageWorkspace page={page} onPrimary={onPrimary} />;
}

export default function StreamsDestinationWorkspace({ destination, onNewProject }) {
  const router = useRouter();
  const page = useMemo(() => PAGE[destination] || DEFAULT_PAGE, [destination]);

  function primaryAction() {
    if (destination === "image-studio") router.push("/streams-ai?destination=image-studio&mode=create");
    else if (destination === "video-studio") router.push("/streams-ai/streams-builder/gen-video");
    else if (["business-builder", "website-builder", "app-builder", "preview-launch", "automation"].includes(destination)) router.push("/streams-ai/streams-builder/workspace");
    else if (["projects", "ideas"].includes(destination)) onNewProject?.();
    else if (destination === "files") router.push("/dashboard/files");
    else if (destination === "tasks") router.push("/dashboard/tasks");
    else if (destination === "history") router.push("/dashboard/history");
    else window.dispatchEvent(new CustomEvent("streams-ai:destination-action", { detail: { destination } }));
  }

  return <main className="destinationPage" aria-label={`${page.title} workspace`}>
    <Hero page={page} onPrimary={primaryAction} />
    <section id="destination-workspace" className="destinationWorkspaceSection">
      <div className="destinationSectionHeading"><span>Streams Workspace</span><h2>Work directly inside {page.title}</h2><p>The marketing promise and the working environment live together, so users can understand the value and start immediately.</p></div>
      <Workspace page={page} onPrimary={primaryAction} />
    </section>
    <style jsx global>{`
      .destinationPage{height:100dvh;overflow-y:auto;overflow-x:hidden;background:#020713;color:#eef6ff;scrollbar-width:none}.destinationPage::-webkit-scrollbar{display:none}.destinationHero{min-height:64vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.9fr);align-items:center;gap:clamp(36px,6vw,96px);padding:clamp(70px,9vh,118px) clamp(28px,5vw,88px) clamp(54px,8vh,90px);max-width:1600px;margin:auto}.destinationHeroCopy{max-width:700px}.destinationEyebrow,.destinationSectionHeading>span,.workspaceHeading span,.editorialBrief>span,.insightSearch>span,.launchStatus>span,.editorialCanvas span,.insightStory span,.showcaseMain span,.manageToolbar span{display:block;color:#63d8ff;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.destinationHero h1{margin:14px 0 18px;font-size:clamp(46px,6vw,92px);line-height:.95;letter-spacing:-.055em}.destinationHero p{max-width:660px;margin:0;color:#aebbd0;font-size:clamp(16px,1.4vw,22px);line-height:1.55}.destinationActions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.destinationPrimary,.destinationSecondary{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:10px;padding:0 18px;font-weight:800;cursor:pointer}.destinationPrimary{border:0;background:linear-gradient(90deg,#16b9f5,#6b5cff,#ad36df);color:#fff;box-shadow:0 12px 30px rgba(82,82,255,.22)}.destinationSecondary{border:1px solid rgba(148,163,184,.28);background:transparent;color:#e2e8f0}.destinationHeroVisual{position:relative;min-height:clamp(360px,50vw,660px)}.destinationHeroVisual img{width:100%;height:100%;position:absolute;inset:0;object-fit:cover;object-position:center;border-radius:0;filter:saturate(.92) contrast(1.04)}.destinationHeroVisual:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(2,7,19,.88))}.destinationHeroVisual span{position:absolute;left:24px;bottom:22px;z-index:1;font-size:13px;font-weight:800;letter-spacing:.08em}.destinationWorkspaceSection{padding:clamp(60px,8vw,110px) clamp(24px,5vw,84px) 110px;background:linear-gradient(180deg,#050b19,#020713)}.destinationSectionHeading{max-width:760px;margin:0 auto 42px;text-align:center}.destinationSectionHeading h2{margin:10px 0 10px;font-size:clamp(30px,4vw,54px);letter-spacing:-.04em}.destinationSectionHeading p{margin:0;color:#91a0b7;line-height:1.6}.workspaceVariant{width:min(1320px,100%);margin:auto}.studioWorkspace{display:grid;grid-template-columns:minmax(300px,.7fr) minmax(0,1.3fr);gap:36px;align-items:start}.workspaceControls{display:grid;gap:22px}.workspaceHeading{display:grid;gap:7px}.workspaceHeading strong{font-size:27px}.lineField{display:grid;gap:8px}.lineField span,.controlRow span{font-size:11px;color:#8da0bc}.lineField textarea{min-height:150px;resize:vertical;padding:15px 0;border:0;border-bottom:1px solid rgba(148,163,184,.28);background:transparent;color:#fff;font:inherit;line-height:1.5;outline:none}.controlRow{display:grid;grid-template-columns:1fr 1fr;gap:16px}.controlRow label{display:grid;gap:8px}.controlRow select{height:43px;border:0;border-bottom:1px solid rgba(148,163,184,.28);background:#050b19;color:#fff}.fullAction{width:100%}.workspacePreview>img{width:100%;height:clamp(360px,52vw,700px);object-fit:cover}.previewRail{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:10px}.previewRail button,.showcaseStrip button{border:0;background:transparent;padding:0;cursor:pointer;opacity:.62}.previewRail button.active,.showcaseStrip button.active{opacity:1}.previewRail img{width:100%;height:96px;object-fit:cover}.launchFlow{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid rgba(148,163,184,.18)}.launchFlow button{display:flex;align-items:center;gap:10px;padding:14px 0;border:0;background:transparent;color:#8290a6;text-align:left}.launchFlow button>span{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;border:1px solid currentColor}.launchFlow button.active,.launchFlow button.complete{color:#67dcff}.launchPreview{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:32px;padding-top:24px}.launchPreview>img{width:100%;height:clamp(360px,48vw,650px);object-fit:cover}.launchStatus{align-self:center}.launchStatus strong{display:block;margin:10px 0;font-size:32px}.launchStatus p{color:#94a3b8;line-height:1.65;margin-bottom:22px}.editorialWorkspace{display:grid;grid-template-columns:minmax(300px,.75fr) minmax(0,1.25fr);gap:48px;align-items:center}.editorialBrief h2,.insightStory h2,.showcaseMain h2{font-size:clamp(30px,4vw,52px);line-height:1.05;letter-spacing:-.04em}.editorialBrief p,.insightStory p,.showcaseMain p{color:#94a3b8;line-height:1.65}.tagLine{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0}.tagLine button{border:0;border-bottom:1px solid rgba(148,163,184,.28);background:transparent;color:#94a3b8;padding:8px 2px}.tagLine button.active{color:#6ee7ff;border-color:#6ee7ff}.editorialCanvas>img{width:100%;height:440px;object-fit:cover}.editorialCanvas>div{padding:20px 0}.editorialCanvas h3{font-size:28px;margin:8px 0}.editorialCanvas p{color:#9aa8bb;line-height:1.6}.insightWorkspace{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(0,1.1fr);gap:42px}.insightSearch>div:first-of-type{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;border-bottom:1px solid rgba(148,163,184,.32);padding:13px 0}.insightSearch input{border:0;background:transparent;color:#fff;font-size:20px;outline:0}.insightSearch>div button{width:38px;height:38px;border:0;border-radius:50%;display:grid;place-items:center;background:#6d3df3;color:#fff}.insightSignals{display:grid!important;gap:0!important;margin-top:24px}.insightSignals>button{display:grid!important;grid-template-columns:32px 1fr!important;gap:2px 12px!important;padding:15px 0!important;border:0!important;border-bottom:1px solid rgba(148,163,184,.14)!important;border-radius:0!important;background:transparent!important;text-align:left!important;color:#fff!important;width:100%!important;height:auto!important}.insightSignals>button>span{grid-row:1/3;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#10203b;color:#67dcff}.insightSignals small{color:#7f8ca3}.insightStory img{width:100%;height:380px;object-fit:cover}.insightStory>div{padding-top:20px}.manageToolbar{display:flex;justify-content:space-between;align-items:end;gap:18px;padding-bottom:18px;border-bottom:1px solid rgba(148,163,184,.2)}.manageToolbar h2{font-size:32px;margin:5px 0 0}.manageTable{display:grid}.manageHead,.manageRow{display:grid;grid-template-columns:minmax(220px,1.5fr) .7fr .7fr 24px;gap:16px;align-items:center}.manageHead{padding:14px 0;color:#75849a;font-size:10px;text-transform:uppercase;letter-spacing:.12em}.manageRow{width:100%;padding:17px 0;border:0;border-top:1px solid rgba(148,163,184,.12);background:transparent;color:#dbe6f5;text-align:left}.manageRow>span:first-child{display:flex;align-items:center;gap:10px}.manageRow i{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:#0d1b31;color:#5fdcff;font-style:normal;font-size:10px}.manageMedia{display:grid;grid-template-columns:1.3fr .85fr .85fr;gap:10px;margin-top:30px}.manageMedia img{width:100%;height:220px;object-fit:cover}.showcaseMain{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(300px,.7fr);gap:38px;align-items:center}.showcaseMain>img{width:100%;height:560px;object-fit:cover}.showcaseStrip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.showcaseStrip button{text-align:left;color:#dbeafe}.showcaseStrip img{width:100%;height:150px;object-fit:cover}.showcaseStrip span{display:block;padding-top:8px;font-size:12px;font-weight:700}.showcaseStrip button.active span{color:#64dcff}
      @media(max-width:900px){.destinationPage{height:auto;min-height:100dvh}.destinationHero{grid-template-columns:1fr;min-height:auto;padding:76px 20px 48px;gap:34px}.destinationHero h1{font-size:clamp(44px,14vw,68px)}.destinationHeroVisual{min-height:430px}.destinationWorkspaceSection{padding:58px 18px 80px}.studioWorkspace,.launchPreview,.editorialWorkspace,.insightWorkspace,.showcaseMain{grid-template-columns:1fr}.workspaceControls{order:2}.workspacePreview{order:1}.launchFlow{grid-template-columns:1fr}.launchFlow button{border-bottom:1px solid rgba(148,163,184,.12)}.manageHead{display:none}.manageRow{grid-template-columns:minmax(0,1fr) auto}.manageRow>span:nth-child(2),.manageRow>span:nth-child(3){display:none}.manageMedia{grid-template-columns:1fr 1fr}.manageMedia img{height:180px}.manageMedia img:first-child{grid-column:1/-1;height:260px}.showcaseMain>img{height:430px}.showcaseStrip{grid-template-columns:repeat(3,minmax(120px,1fr));overflow-x:auto}.showcaseStrip img{height:120px}.destinationActions{display:grid}.destinationPrimary,.destinationSecondary{width:100%}.controlRow{grid-template-columns:1fr}.editorialCanvas>img,.insightStory img{height:360px}}
      @media(max-width:520px){.destinationHeroVisual{min-height:340px}.destinationHero p{font-size:16px}.destinationSectionHeading{text-align:left}.workspacePreview>img{height:420px}.previewRail img{height:72px}.manageToolbar{align-items:start;flex-direction:column}.manageToolbar .destinationPrimary{width:100%}.manageMedia{grid-template-columns:1fr}.manageMedia img,.manageMedia img:first-child{grid-column:auto;height:230px}.showcaseMain>img{height:380px}.showcaseStrip{grid-template-columns:repeat(3,132px)}.launchPreview>img{height:390px}.editorialCanvas>img,.insightStory img{height:320px}}
    `}</style>
  </main>;
}
