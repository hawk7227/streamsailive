"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, BookOpen, Bot, Boxes, CalendarDays, Check, ChevronRight,
  Code2, FileCode2, FileText, FolderOpen, Image as ImageIcon, Layers3,
  Layout, Megaphone, MessageSquareText, MonitorSmartphone, Palette,
  Play, Plus, Rocket, Search, Send, Settings2, Share2, Sparkles,
  Upload, Video, WandSparkles, Workflow,
} from "lucide-react";

const IMG = {
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1500&q=84",
  research: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1500&q=84",
  city: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1500&q=84",
  brand: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1500&q=84",
  app: "https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=1500&q=84",
  document: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1500&q=84",
  campaign: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1500&q=84",
  website: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1500&q=84",
  person: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=82",
};

const TYPES = {
  default: {
    title: "Acme Growth Project", kind: "Strategic Plan", image: IMG.mountain,
    left: ["Overview", "Pages", "Files", "Memory", "Structure"],
    tools: ["Project brief", "Market opportunity", "Product advantage", "Growth engine"],
    inspector: ["Properties", "Generate", "A.S.K. AI"],
    bottom: ["Assets", "Outputs", "Tasks", "Versions", "Activity"],
  },
  research: {
    title: "Market Research Report", kind: "Research", image: IMG.research,
    left: ["Questions", "Sources", "Files", "Notes", "Findings", "Decisions"],
    tools: ["Executive summary", "Competitor A", "Competitor B", "Our position"],
    inspector: ["Source Details", "Evidence", "A.S.K. AI"],
    bottom: ["Sources", "Extracted Facts", "Charts", "Drafts"],
  },
  video: {
    title: "Launch Promo Video", kind: "Video", image: IMG.city,
    left: ["Script", "Scenes", "Characters", "Uploaded Media", "Audio", "References"],
    tools: ["Scene 03", "Timeline", "Overlay", "Audio", "Subtitles"],
    inspector: ["Scene Properties", "Motion", "Voice"],
    bottom: ["Clips", "Audio", "Generated Scenes", "Versions", "Exports"],
  },
  brand: {
    title: "Lumèa Brand Identity", kind: "Brand", image: IMG.brand,
    left: ["Brand Direction", "References", "Uploaded Images", "Generated Assets", "Style Decisions"],
    tools: ["Logo direction", "Color palette", "Typography", "Variations"],
    inspector: ["Prompt Controls", "Edit Tools", "A.S.K. AI"],
    bottom: ["Generated Images", "Logos", "Palettes", "References", "Exports"],
  },
  app: {
    title: "Mobile App Builder", kind: "App", image: IMG.app,
    left: ["Files", "Routes", "Components", "Data", "APIs", "Requirements"],
    tools: ["Preview", "Code", "Structure", "Versions"],
    inspector: ["Component Properties", "State", "A.S.K. AI"],
    bottom: ["Console", "Logs", "Versions", "Assets", "Tasks"],
  },
  document: {
    title: "Quarterly Strategy Report", kind: "Document", image: IMG.document,
    left: ["Outline", "Sources", "Uploads", "Research", "Sections"],
    tools: ["Executive summary", "Revenue growth", "Key highlights", "Recommendations"],
    inspector: ["Formatting", "Citations", "A.S.K. AI"],
    bottom: ["Source Excerpts", "Photo Drafts", "Charts", "Attachments", "Comments"],
  },
  campaign: {
    title: "Spring Product Campaign", kind: "Campaign", image: IMG.campaign,
    left: ["Product", "Audience", "Messaging", "Channels", "Campaign Assets", "Schedule"],
    tools: ["Overview", "Calendar", "Flow", "Performance"],
    inspector: ["Creative Properties", "Copy Variations", "A.S.K. AI"],
    bottom: ["Ads", "Emails", "Social Graphics", "Landing Pages", "Campaign Tasks"],
  },
  website: {
    title: "Elevate Website Redesign", kind: "Website", image: IMG.website,
    left: ["Pages", "Sections", "Files", "Brand", "Content", "SEO"],
    tools: ["Desktop", "Tablet", "Mobile", "Responsive"],
    inspector: ["Element Properties", "Content Editing", "A.S.K. AI"],
    bottom: ["Images", "Components", "Page Variations", "Code", "Tasks"],
  },
};

const DESTINATION_TYPE = {
  projects: "default", portfolio: "default", files: "default", calendar: "default", assets: "default", tasks: "default", history: "default", templates: "default", integrations: "default", search: "default",
  "social-research": "research", revenue: "research", ideas: "research",
  "video-studio": "video", "creator-studio": "video", "voice-studio": "video",
  "image-studio": "brand", "visual-concepts": "brand", "turn-this-into-you": "brand",
  "app-builder": "app", automation: "app",
  content: "document", captions: "document",
  "business-builder": "campaign",
  "website-builder": "website", "preview-launch": "website",
};

function IconFor({ label }) {
  const p = { size: 15, strokeWidth: 1.8 };
  if (/video|scene|clip/i.test(label)) return <Video {...p} />;
  if (/image|brand|palette|logo|visual/i.test(label)) return <Palette {...p} />;
  if (/code|component|route|api/i.test(label)) return <Code2 {...p} />;
  if (/file|source|document|outline|section/i.test(label)) return <FileText {...p} />;
  if (/campaign|audience|channel|message/i.test(label)) return <Megaphone {...p} />;
  if (/calendar|schedule/i.test(label)) return <CalendarDays {...p} />;
  if (/task|decision|finding/i.test(label)) return <Check {...p} />;
  return <Layers3 {...p} />;
}

function WorkspaceTopbar({ page, onAction }) {
  return <header className="uwTopbar">
    <div className="uwBrand"><span className="uwLogo">S</span><strong>StreamsAI</strong></div>
    <button className="uwProjectName">{page.title}<ChevronRight size={13} /></button>
    <span className="uwKind">{page.kind}</span><span className="uwSaved">● Saved</span>
    <div className="uwTopActions">
      <button>Preview</button><button><Share2 size={13} /> Share</button><button>Export</button>
      <button className="uwPrimary" onClick={onAction}>{page.kind === "Website" || page.kind === "App" || page.kind === "Campaign" || page.kind === "Video" ? "Publish" : "Complete"}</button>
    </div>
  </header>;
}

function LeftRail({ page, active, setActive }) {
  return <aside className="uwLeftRail">
    {page.left.map((item, index) => <button key={item} className={active === index ? "active" : ""} onClick={() => setActive(index)}><IconFor label={item} /><span>{item}</span><small>{index ? `${index * 4 + 2} items` : "Open"}</small></button>)}
  </aside>;
}

function Inspector({ page, active, setActive }) {
  return <aside className="uwInspector">
    <nav>{page.inspector.map((tab, index) => <button key={tab} className={active === index ? "active" : ""} onClick={() => setActive(index)}>{tab}</button>)}</nav>
    <div className="uwInspectorBody">
      <label><span>Project title</span><input defaultValue={page.title} /></label>
      <label><span>Type</span><select defaultValue={page.kind}><option>{page.kind}</option><option>Custom</option></select></label>
      <label><span>Status</span><select defaultValue="In progress"><option>In progress</option><option>Ready for review</option><option>Complete</option></select></label>
      <label><span>Owner</span><select defaultValue="Alex Morgan"><option>Alex Morgan</option><option>Workspace team</option></select></label>
      <label><span>Summary</span><textarea defaultValue={`A production workspace for ${page.title.toLowerCase()}, with connected assets, decisions, and execution history.`} /></label>
      <button className="uwAiButton"><Bot size={15} /> Improve with A.S.K. AI</button>
    </div>
  </aside>;
}

function DefaultCanvas({ page }) {
  return <div className="uwDefaultCanvas">
    <img src={page.image} alt="Project cover" />
    <div className="uwCoverText"><span>{page.kind}</span><h1>{page.title}</h1><p>Transform insight into sustainable growth with one connected Streams workspace.</p></div>
    <div className="uwMetricGrid">{page.tools.slice(1).map((item, index) => <article key={item}><IconFor label={item} /><strong>{item}</strong><span>{index === 0 ? "+24%" : index === 1 ? "18.4K" : "3.6%"}</span></article>)}</div>
  </div>;
}

function ResearchCanvas() {
  return <div className="uwResearchCanvas"><h2>Executive Summary</h2><div className="uwResearchCards">{["Competitor A", "Competitor B", "Our position"].map((x, i) => <article key={x}><strong>{x}</strong><BarChart3 /><span>{i === 2 ? "Differentiated pricing" : "Strong but narrow"}</span></article>)}</div><section><h3>Top Findings</h3><ul><li>Price sensitivity remains high among SMB buyers.</li><li>Localized onboarding improves conversion.</li><li>Current gap: clearer differentiation.</li></ul></section><section className="uwRecommendation"><h3>Recommendation</h3><p>Lead with streamlined onboarding and transparent pricing. Target the most underserved segment first.</p></section></div>;
}

function VideoCanvas({ page }) {
  const [scene, setScene] = useState(2);
  return <div className="uwVideoCanvas"><div className="uwVideoStage"><img src={page.image} alt="Video scene" /><button><Play fill="currentColor" /></button><span>00:11 / 00:15</span></div><div className="uwTimeline">{[0,1,2,3,4].map((n) => <button key={n} className={scene === n ? "active" : ""} onClick={() => setScene(n)}><img src={page.image} alt={`Scene ${n + 1}`} /><span>Scene {n + 1}</span></button>)}</div><div className="uwTracks"><span>Video</span><i /><span>Text</span><i /><span>Audio</span><i /></div></div>;
}

function BrandCanvas() {
  return <div className="uwBrandCanvas"><div className="uwLogoPreview"><Sparkles /><h1>Lumèa</h1><span>LIGHTING THE FUTURE</span></div><section><h3>Color Palette</h3><div className="uwSwatches"><i /><i /><i /><i /><i /></div></section><section><h3>Typography</h3><strong className="uwTypeSample">Aa</strong><span>Poppins — ABCDEFGHIJKLMNOPQRSTUVWXYZ</span></section></div>;
}

function AppCanvas({ page }) {
  return <div className="uwAppCanvas"><div className="uwPhone"><div className="uwPhoneTop">9:36</div><h4>Good morning, Alex</h4><div className="uwBalance"><span>Your balance</span><strong>$4,280.50</strong></div><div className="uwAppActions"><button>Send</button><button>Request</button><button>Top up</button></div><ul><li>Shopify <span>-$4.30</span></li><li>Uber <span>-$18.40</span></li><li>Amazon <span>-$69.99</span></li></ul></div><pre>{`export function Button({ label }) {\n  return (\n    <button className="primary">\n      {label}\n    </button>\n  );\n}`}</pre></div>;
}

function DocumentCanvas() {
  return <article className="uwDocumentCanvas"><div className="uwDocTools">B &nbsp; I &nbsp; U &nbsp; • &nbsp; H1 &nbsp; H2</div><h1>Q2 2024 Strategy Report</h1><h2>1. Executive Summary</h2><p>Strong performance across key markets shows our growth strategy is working. Our focus on product innovation and customer experience is paying off.</p><div className="uwChart"><BarChart3 /><span>Revenue Growth (YoY)</span><b>+24%</b></div><h2>2. Key Highlights</h2><ul><li>Revenue up 24% year over year</li><li>Customer acquisition up 18%</li><li>Retention reached 94%</li></ul></article>;
}

function CampaignCanvas({ page }) {
  return <div className="uwCampaignCanvas"><div className="uwCampaignHero"><img src={page.image} alt="Campaign product" /><div><span>New launch</span><h1>Spring Refresh</h1><p>New look. More power.</p><button>Shop now</button></div></div><div className="uwCampaignGrid">{["Email Promo", "Social Ad", "Landing Page"].map((x) => <article key={x}><img src={page.image} alt={x} /><strong>{x}</strong></article>)}</div><section><h3>Content Calendar</h3><div className="uwCalendarRow"><span>May 12<br/><b>Post</b></span><span>May 13<br/><b>Instagram</b></span><span>May 14<br/><b>Blog Post</b></span><span>May 15<br/><b>Facebook Ad</b></span></div></section></div>;
}

function WebsiteCanvas({ page }) {
  return <div className="uwWebsiteCanvas"><div className="uwDeviceTabs"><MonitorSmartphone /><span>Desktop</span><span>Tablet</span><span>Mobile</span></div><div className="uwWebsitePreview"><img src={page.image} alt="Website preview" /><div><span>Elevate</span><h1>Elevate<br/>Your Business</h1><p>Smart solutions that drive growth, efficiency, and impact.</p><button>Get Started</button></div><footer><strong>2.5K+</strong><span>Customers</span><strong>98%</strong><span>Satisfaction</span><strong>24/7</strong><span>Support</span></footer></div></div>;
}

function MainCanvas({ type, page }) {
  if (type === "research") return <ResearchCanvas />;
  if (type === "video") return <VideoCanvas page={page} />;
  if (type === "brand") return <BrandCanvas />;
  if (type === "app") return <AppCanvas page={page} />;
  if (type === "document") return <DocumentCanvas />;
  if (type === "campaign") return <CampaignCanvas page={page} />;
  if (type === "website") return <WebsiteCanvas page={page} />;
  return <DefaultCanvas page={page} />;
}

function BottomDock({ page, active, setActive }) {
  return <footer className="uwBottomDock"><nav>{page.bottom.map((tab, i) => <button key={tab} className={active === i ? "active" : ""} onClick={() => setActive(i)}>{tab}</button>)}</nav><div className="uwAssetStrip">{page.bottom.slice(0,4).map((item, i) => <article key={item}><span>{i % 2 ? <ImageIcon /> : <FolderOpen />}</span><strong>{item}</strong><small>{i * 5 + 3} items</small></article>)}</div></footer>;
}

export default function StreamsDestinationWorkspace({ destination, onNewProject }) {
  const router = useRouter();
  const type = DESTINATION_TYPE[destination] || "default";
  const page = TYPES[type];
  const [leftActive, setLeftActive] = useState(0);
  const [inspectorActive, setInspectorActive] = useState(0);
  const [bottomActive, setBottomActive] = useState(0);

  const action = () => {
    if (type === "video") return router.push("/streams-ai/streams-builder/gen-video");
    if (type === "app" || type === "website" || type === "campaign") return router.push("/streams-ai/streams-builder/workspace");
    onNewProject?.();
  };

  return <main className={`universalWorkspace type-${type}`}>
    <WorkspaceTopbar page={page} onAction={action} />
    <div className="uwBody">
      <LeftRail page={page} active={leftActive} setActive={setLeftActive} />
      <section className="uwCanvas"><div className="uwCanvasTabs">{page.tools.map((tab, i) => <button key={tab} className={i === 0 ? "active" : ""}>{tab}</button>)}</div><MainCanvas type={type} page={page} /></section>
      <Inspector page={page} active={inspectorActive} setActive={setInspectorActive} />
    </div>
    <BottomDock page={page} active={bottomActive} setActive={setBottomActive} />
    <style jsx global>{`
      .universalWorkspace{height:100dvh;display:grid;grid-template-rows:52px minmax(0,1fr) 132px;background:#f7f9fc;color:#12203a;font-family:Inter,ui-sans-serif,system-ui;overflow:hidden}.uwTopbar{display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid #dbe2ec;background:#fff}.uwBrand{display:flex;align-items:center;gap:7px}.uwLogo{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:linear-gradient(135deg,#24b7ff,#3448ff);color:#fff;font-weight:900}.uwBrand strong{font-size:12px}.uwProjectName,.uwTopActions button,.uwCanvasTabs button,.uwInspector nav button,.uwBottomDock nav button{border:0;background:transparent;color:#45546c;cursor:pointer}.uwProjectName{display:flex;align-items:center;font-weight:800}.uwKind{font-size:10px;color:#3265d8}.uwSaved{font-size:9px;color:#21a66c}.uwTopActions{margin-left:auto;display:flex;gap:5px}.uwTopActions button{min-height:28px;padding:0 9px;border:1px solid #dbe2ec;border-radius:5px;font-size:9px;font-weight:700;display:flex;align-items:center;gap:4px}.uwTopActions .uwPrimary{background:#2463eb;border-color:#2463eb;color:#fff}.uwBody{min-height:0;display:grid;grid-template-columns:150px minmax(0,1fr) 236px}.uwLeftRail{min-height:0;overflow:auto;border-right:1px solid #dbe2ec;background:#fff;padding:8px 6px}.uwLeftRail button{width:100%;display:grid;grid-template-columns:18px 1fr;gap:2px 6px;align-items:center;padding:8px;border:0;border-radius:6px;background:transparent;color:#526078;text-align:left;cursor:pointer}.uwLeftRail button.active{background:#eaf1ff;color:#1755d6}.uwLeftRail button span{font-size:10px;font-weight:750}.uwLeftRail button small{grid-column:2;font-size:7px;color:#98a3b4}.uwCanvas{min-width:0;min-height:0;overflow:auto;padding:10px;background:#f8fafc}.uwCanvasTabs{height:30px;display:flex;gap:12px;align-items:center;border-bottom:1px solid #dfe5ee}.uwCanvasTabs button{font-size:9px}.uwCanvasTabs button.active{color:#1755d6;font-weight:800;border-bottom:2px solid #1755d6;height:30px}.uwInspector{min-height:0;overflow:auto;border-left:1px solid #dbe2ec;background:#fff}.uwInspector nav{display:flex;border-bottom:1px solid #dbe2ec;padding:0 8px}.uwInspector nav button{height:36px;font-size:8px}.uwInspector nav button.active{color:#1755d6;border-bottom:2px solid #1755d6}.uwInspectorBody{padding:10px;display:grid;gap:9px}.uwInspectorBody label{display:grid;gap:4px}.uwInspectorBody label span{font-size:8px;font-weight:750}.uwInspectorBody input,.uwInspectorBody select,.uwInspectorBody textarea{width:100%;box-sizing:border-box;border:1px solid #dbe2ec;border-radius:5px;background:#fff;padding:7px;font-size:9px}.uwInspectorBody textarea{min-height:72px;resize:vertical}.uwAiButton{border:0;border-radius:5px;background:#2463eb;color:#fff;padding:9px;font-size:9px;font-weight:800;display:flex;justify-content:center;gap:5px}.uwBottomDock{border-top:1px solid #dbe2ec;background:#fff;overflow:hidden}.uwBottomDock nav{height:34px;display:flex;gap:12px;padding:0 12px;border-bottom:1px solid #e5e9f0}.uwBottomDock nav button{font-size:8px}.uwBottomDock nav button.active{color:#1755d6;border-bottom:2px solid #1755d6}.uwAssetStrip{height:98px;display:flex;gap:10px;padding:10px;overflow:auto}.uwAssetStrip article{min-width:150px;display:grid;grid-template-columns:32px 1fr;gap:2px 7px;align-items:center}.uwAssetStrip article span{grid-row:1/3;width:30px;height:30px;border-radius:6px;background:#edf3ff;color:#2463eb;display:grid;place-items:center}.uwAssetStrip svg{width:16px}.uwAssetStrip strong{font-size:9px}.uwAssetStrip small{font-size:7px;color:#8b97aa}.uwDefaultCanvas,.uwResearchCanvas,.uwVideoCanvas,.uwBrandCanvas,.uwAppCanvas,.uwDocumentCanvas,.uwCampaignCanvas,.uwWebsiteCanvas{min-height:calc(100% - 40px);margin-top:10px;background:#fff;border:1px solid #e0e6ef;border-radius:8px;overflow:hidden}.uwDefaultCanvas{display:grid;grid-template-columns:1.2fr .8fr;position:relative}.uwDefaultCanvas>img{width:100%;height:250px;object-fit:cover}.uwCoverText{padding:25px}.uwCoverText h1{font-size:27px;margin:8px 0}.uwCoverText p{font-size:12px;line-height:1.5;color:#66748a}.uwMetricGrid{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px}.uwMetricGrid article{padding:14px;border-top:1px solid #e4e9f1;display:grid;gap:6px}.uwMetricGrid strong{font-size:11px}.uwMetricGrid span{color:#20a66a;font-weight:800}.uwResearchCanvas{padding:18px}.uwResearchCards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.uwResearchCards article{padding:12px;background:#f7f9fc;border-radius:7px;display:grid;gap:8px}.uwResearchCards svg{color:#6c63ff}.uwResearchCanvas section{margin-top:14px}.uwRecommendation{background:#e9f9ef;padding:12px;border-radius:7px}.uwVideoCanvas{padding:10px}.uwVideoStage{height:270px;position:relative;background:#080f1f}.uwVideoStage img{width:100%;height:100%;object-fit:cover}.uwVideoStage button{position:absolute;left:12px;bottom:12px;border:0;border-radius:50%;width:34px;height:34px}.uwVideoStage span{position:absolute;left:55px;bottom:20px;color:#fff;font-size:9px}.uwTimeline{display:flex;gap:6px;padding:10px;overflow:auto}.uwTimeline button{min-width:112px;border:2px solid transparent;border-radius:5px;background:#fff;padding:3px}.uwTimeline button.active{border-color:#7654ff}.uwTimeline img{width:100%;height:54px;object-fit:cover}.uwTimeline span{font-size:8px}.uwTracks{display:grid;grid-template-columns:45px 1fr;gap:4px;padding:8px}.uwTracks span{font-size:8px}.uwTracks i{height:12px;background:linear-gradient(90deg,#6d5dfc,#e86bcf);border-radius:3px}.uwBrandCanvas{padding:18px}.uwLogoPreview{height:230px;display:grid;place-items:center;align-content:center}.uwLogoPreview svg{color:#f0ad2c}.uwLogoPreview h1{font-size:42px;margin:8px 0 0}.uwLogoPreview span{font-size:8px;letter-spacing:.25em}.uwBrandCanvas section{border-top:1px solid #e5e9f0;padding:12px}.uwSwatches{display:flex;gap:10px}.uwSwatches i{width:38px;height:38px;border-radius:6px;background:#071a46}.uwSwatches i:nth-child(2){background:#2563eb}.uwSwatches i:nth-child(3){background:#20c4a8}.uwSwatches i:nth-child(4){background:#f3b51b}.uwSwatches i:nth-child(5){background:#f1f5f9}.uwTypeSample{font-size:44px;margin-right:14px}.uwAppCanvas{display:grid;grid-template-columns:280px 1fr;gap:16px;padding:18px}.uwPhone{width:210px;margin:auto;border:7px solid #111827;border-radius:28px;padding:15px;background:#fff;box-shadow:0 16px 40px #cbd5e1}.uwPhoneTop{text-align:center;font-size:8px}.uwBalance{background:linear-gradient(135deg,#1265ee,#12c8d7);color:#fff;border-radius:10px;padding:12px;display:grid}.uwBalance strong{font-size:19px}.uwAppActions{display:flex;gap:5px;margin:10px 0}.uwAppActions button{border:0;background:#edf4ff;color:#2563eb;font-size:8px;padding:7px}.uwPhone ul{padding:0;list-style:none}.uwPhone li{display:flex;justify-content:space-between;border-top:1px solid #eef1f5;padding:8px 0;font-size:9px}.uwAppCanvas pre{background:#f8fafc;border-left:1px solid #e3e8ef;padding:20px;color:#334155;font-size:11px;overflow:auto}.uwDocumentCanvas{padding:22px 40px;font-family:Georgia,serif}.uwDocTools{font-family:Inter,sans-serif;color:#64748b;border-bottom:1px solid #e5e9f0;padding-bottom:10px}.uwDocumentCanvas h1{font-size:26px}.uwDocumentCanvas h2{font-size:15px;margin-top:22px}.uwDocumentCanvas p,.uwDocumentCanvas li{font-size:11px;line-height:1.6}.uwChart{height:100px;display:flex;align-items:center;gap:15px;background:#f7f9fc;padding:12px}.uwChart svg{width:50px;height:50px;color:#2463eb}.uwChart b{margin-left:auto;color:#20a66a}.uwCampaignCanvas{padding:16px}.uwCampaignHero{height:180px;position:relative;overflow:hidden;border-radius:8px;background:#fff3e8}.uwCampaignHero img{width:100%;height:100%;object-fit:cover;opacity:.55}.uwCampaignHero div{position:absolute;inset:0;display:grid;align-content:center;padding:25px;width:45%}.uwCampaignHero h1{margin:5px 0}.uwCampaignHero button,.uwWebsitePreview button{width:max-content;border:0;border-radius:4px;background:#2463eb;color:#fff;padding:8px 12px}.uwCampaignGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.uwCampaignGrid img{width:100%;height:72px;object-fit:cover}.uwCampaignGrid strong{font-size:9px}.uwCalendarRow{display:flex;gap:8px}.uwCalendarRow span{background:#f7f9fc;padding:8px;font-size:8px}.uwWebsiteCanvas{padding:10px}.uwDeviceTabs{height:28px;display:flex;gap:12px;align-items:center;font-size:8px}.uwWebsitePreview{height:360px;position:relative;overflow:hidden}.uwWebsitePreview>img{width:100%;height:100%;object-fit:cover}.uwWebsitePreview>div{position:absolute;inset:0 auto 0 0;width:45%;padding:45px 28px;background:linear-gradient(90deg,rgba(255,255,255,.98),rgba(255,255,255,.72),transparent)}.uwWebsitePreview h1{font-size:34px;margin:12px 0}.uwWebsitePreview p{font-size:10px;line-height:1.5}.uwWebsitePreview footer{position:absolute;inset:auto 0 0;display:flex;justify-content:center;gap:10px;background:#06122e;color:#fff;padding:15px}.uwWebsitePreview footer span{font-size:8px;color:#cbd5e1}.uwWebsitePreview footer strong{font-size:16px}
      @media(max-width:1050px){.uwBody{grid-template-columns:126px minmax(0,1fr) 205px}.uwTopActions button:nth-child(-n+3){display:none}}
      @media(max-width:760px){.universalWorkspace{height:auto;min-height:100dvh;grid-template-rows:auto auto auto;overflow:visible}.uwTopbar{position:sticky;top:0;z-index:20;min-height:52px}.uwBrand strong,.uwKind,.uwSaved,.uwProjectName{display:none}.uwTopActions{width:100%;justify-content:flex-end}.uwBody{display:block}.uwLeftRail{display:flex;gap:4px;overflow-x:auto;border-right:0;border-bottom:1px solid #dbe2ec;padding:7px}.uwLeftRail button{min-width:max-content;grid-template-columns:16px 1fr;padding:7px}.uwLeftRail button small{display:none}.uwCanvas{min-height:620px;padding:8px}.uwCanvasTabs{overflow-x:auto}.uwInspector{border-left:0;border-top:1px solid #dbe2ec}.uwInspectorBody{grid-template-columns:1fr 1fr}.uwInspectorBody label:last-of-type{grid-column:1/-1}.uwBottomDock{height:auto}.uwAssetStrip{height:auto}.uwDefaultCanvas,.uwAppCanvas{display:block}.uwDefaultCanvas>img{height:180px}.uwMetricGrid{grid-template-columns:1fr}.uwResearchCards,.uwCampaignGrid{grid-template-columns:1fr}.uwVideoStage{height:220px}.uwAppCanvas pre{margin-top:15px;min-height:180px}.uwDocumentCanvas{padding:18px}.uwWebsitePreview{height:420px}.uwWebsitePreview>div{width:70%;padding:30px 20px}.uwWebsitePreview h1{font-size:28px}.uwWebsitePreview footer{flex-wrap:wrap}.uwInspector{display:none}}
    `}</style>
  </main>;
}
