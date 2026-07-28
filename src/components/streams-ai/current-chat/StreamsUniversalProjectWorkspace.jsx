"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Bot, CalendarDays, Check, ChevronDown, ChevronRight, Code2,
  Download, FileText, FolderOpen, Image as ImageIcon, Layers3, Megaphone,
  MonitorSmartphone, Palette, Play, Plus, Search, Share2, Sparkles,
  Upload, Video,
} from "lucide-react";

const PHOTO = {
  leader: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1400&q=84",
  analyst: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=84",
  filmmaker: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1600&q=84",
  designer: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=84",
  developer: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1400&q=84",
  writer: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=84",
  marketer: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1400&q=84",
  architect: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1400&q=84",
  city: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=84",
  building: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=84",
  product: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1400&q=84",
};

const WORKSPACES = {
  default: {
    title: "Acme Growth Project", kind: "Strategic Plan", person: PHOTO.leader,
    left: ["Overview", "Pages", "Files", "Memory", "Goals", "Risks", "Decisions"],
    top: ["Overview", "Strategy", "Metrics", "Roadmap"],
    inspector: ["Properties", "Generate", "A.S.K. AI"],
    bottom: ["Assets", "Outputs", "Tasks", "Versions", "Activity"],
  },
  research: {
    title: "Market Research Report", kind: "Research", person: PHOTO.analyst,
    left: ["Questions", "Sources", "Files", "Notes", "Findings", "Decisions"],
    top: ["Executive Summary", "Competitors", "Evidence", "Recommendations"],
    inspector: ["Source Details", "Evidence", "A.S.K. AI"],
    bottom: ["Sources", "Extracted Facts", "Charts", "Drafts", "Comments"],
  },
  video: {
    title: "Launch Promo Video", kind: "Video", person: PHOTO.filmmaker,
    left: ["Script", "Scenes", "Characters", "Uploaded Media", "Audio", "References"],
    top: ["Prompt", "Scene Plan", "Generate", "Edit"],
    inspector: ["Scene Properties", "Motion", "Voice", "Effects"],
    bottom: ["Clips", "Audio", "Generated Scenes", "Versions", "Exports"],
  },
  brand: {
    title: "Lumèa Brand Identity", kind: "Brand", person: PHOTO.designer,
    left: ["Brand Direction", "References", "Uploaded Images", "Generated Assets", "Style Decisions"],
    top: ["Direction", "Identity", "Generate", "Refine"],
    inspector: ["Prompt Controls", "Edit Tools", "A.S.K. AI"],
    bottom: ["Generated Images", "Logos", "Palettes", "References", "Exports"],
  },
  app: {
    title: "Mobile App Builder", kind: "App", person: PHOTO.developer,
    left: ["Files", "Routes", "Components", "Data", "APIs", "Requirements"],
    top: ["Preview", "Code", "Structure", "Versions"],
    inspector: ["Component Properties", "State", "A.S.K. AI"],
    bottom: ["Console", "Logs", "Versions", "Assets", "Tasks"],
  },
  document: {
    title: "Quarterly Strategy Report", kind: "Document", person: PHOTO.writer,
    left: ["Outline", "Sources", "Uploads", "Research", "Sections"],
    top: ["Write", "Review", "Citations", "Layout"],
    inspector: ["Formatting", "Citations", "A.S.K. AI"],
    bottom: ["Source Excerpts", "Photo Drafts", "Charts", "Attachments", "Comments"],
  },
  campaign: {
    title: "Spring Product Campaign", kind: "Campaign", person: PHOTO.marketer,
    left: ["Product", "Audience", "Messaging", "Channels", "Campaign Assets", "Schedule"],
    top: ["Overview", "Calendar", "Flow", "Performance"],
    inspector: ["Creative Properties", "Copy Variations", "A.S.K. AI"],
    bottom: ["Ads", "Emails", "Social Graphics", "Landing Pages", "Campaign Tasks"],
  },
  website: {
    title: "Elevate Website Redesign", kind: "Website", person: PHOTO.architect,
    left: ["Pages", "Sections", "Files", "Brand", "Content", "SEO"],
    top: ["Preview", "Structure", "Responsive", "Code"],
    inspector: ["Element Properties", "Content Editing", "A.S.K. AI"],
    bottom: ["Images", "Components", "Page Variations", "Code", "Tasks"],
  },
};

const TYPE_BY_DESTINATION = {
  projects: "default", portfolio: "default", files: "default", calendar: "default", assets: "default", tasks: "default", history: "default", templates: "default", integrations: "default", search: "default",
  "social-research": "research", revenue: "research", ideas: "research",
  "video-studio": "video", "creator-studio": "video", "voice-studio": "video",
  "image-studio": "brand", "visual-concepts": "brand", "turn-this-into-you": "brand",
  "app-builder": "app", automation: "app", content: "document", captions: "document",
  "business-builder": "campaign", "website-builder": "website", "preview-launch": "website",
};

function ToolIcon({ label }) {
  const p = { size: 15, strokeWidth: 1.8 };
  if (/video|scene|clip|audio/i.test(label)) return <Video {...p} />;
  if (/image|brand|palette|logo|visual/i.test(label)) return <Palette {...p} />;
  if (/code|component|route|api/i.test(label)) return <Code2 {...p} />;
  if (/file|source|document|outline|section/i.test(label)) return <FileText {...p} />;
  if (/campaign|audience|channel|message/i.test(label)) return <Megaphone {...p} />;
  if (/calendar|schedule/i.test(label)) return <CalendarDays {...p} />;
  if (/task|decision|finding|risk/i.test(label)) return <Check {...p} />;
  return <Layers3 {...p} />;
}

function ProjectHeader({ page, onPublish }) {
  const share = async () => {
    const payload = { title: page.title, text: `${page.title} in Streams Workspace`, url: window.location.href };
    if (navigator.share) await navigator.share(payload).catch(() => {});
    else await navigator.clipboard?.writeText(window.location.href);
  };
  const exportView = () => window.print();
  return <header className="upwHeader">
    <div className="upwBrand"><span>S</span><strong>StreamsAI</strong></div>
    <button className="upwProject">{page.title}<ChevronDown size={13} /></button>
    <span className="upwKind">{page.kind}</span><span className="upwSaved">● Saved</span>
    <div className="upwActions"><button onClick={() => document.querySelector(".upwCanvas")?.scrollIntoView()}>Preview</button><button onClick={share}><Share2 size={13}/>Share</button><button onClick={exportView}><Download size={13}/>Export</button><button className="primary" onClick={onPublish}>{/Website|App|Campaign|Video/.test(page.kind) ? "Publish" : "Complete"}</button></div>
  </header>;
}

function LeftRail({ page, active, onChange }) {
  return <aside className="upwLeft" aria-label={`${page.kind} tools`}>{page.left.map((item, index) => <button key={item} className={active === index ? "active" : ""} onClick={() => onChange(index)}><ToolIcon label={item}/><span>{item}</span><small>{index ? `${index * 3 + 2} items` : "Open"}</small></button>)}</aside>;
}

function Inspector({ page, tab, setTab }) {
  return <aside className="upwInspector"><nav>{page.inspector.map((name, index) => <button key={name} className={tab === index ? "active" : ""} onClick={() => setTab(index)}>{name}</button>)}</nav><div className="upwFields">
    {tab === page.inspector.length - 1 ? <><div className="upwPerson"><img src={page.person} alt="Workspace collaborator"/><span><strong>A.S.K. AI</strong><small>Project-aware assistance</small></span></div><textarea defaultValue={`Help me improve the current ${page.kind.toLowerCase()} while preserving the approved direction.`}/><button className="upwAi"><Bot size={15}/>Ask A.S.K. AI</button></> : <><label><span>Project title</span><input defaultValue={page.title}/></label><label><span>Status</span><select defaultValue="In progress"><option>In progress</option><option>Ready for review</option><option>Complete</option></select></label><label><span>Owner</span><select defaultValue="Alex Morgan"><option>Alex Morgan</option><option>Workspace team</option></select></label><label><span>Summary</span><textarea defaultValue={`Production ${page.kind.toLowerCase()} workspace with connected assets, decisions, and execution history.`}/></label><button className="upwAi"><Sparkles size={15}/>Improve selection</button></>}
  </div></aside>;
}

function DefaultCanvas({ page }) { return <div className="upwDefault"><div className="upwHeroImage"><img src={page.person} alt="Project owner working"/><span>Acme growth strategy</span></div><div className="upwIntro"><small>{page.kind}</small><h1>{page.title}</h1><p>Transform insight into sustainable growth through one connected workspace.</p></div><div className="upwMetrics">{[["Market opportunity","+24%"],["Product advantage","18.4K"],["Growth engine","3.6%"]].map(([a,b])=><div key={a}><ToolIcon label={a}/><strong>{a}</strong><span>{b}</span></div>)}</div></div>; }
function ResearchCanvas({ page }) { return <div className="upwResearch"><div className="upwPersonBanner"><img src={page.person} alt="Market researcher"/><span><strong>Executive summary</strong><small>Evidence-backed analysis</small></span></div><div className="upwCompare">{["Competitor A","Competitor B","Our position"].map((x,i)=><div key={x}><strong>{x}</strong><BarChart3/><small>{i===2?"Differentiated pricing":"Strong but narrow"}</small></div>)}</div><section><h3>Top findings</h3><ul><li>Price sensitivity remains high among SMB buyers.</li><li>Localized onboarding improves conversion.</li><li>Clearer differentiation is the largest opportunity.</li></ul></section><section className="recommend"><h3>Recommendation</h3><p>Lead with streamlined onboarding and transparent pricing.</p></section></div>; }
function VideoCanvas({ page }) { const [scene,setScene]=useState(2); return <div className="upwVideo"><div className="upwStage"><img src={PHOTO.city} alt="Neon city video scene"/><button aria-label="Play preview"><Play fill="currentColor"/></button><span>00:11 / 00:15</span></div><div className="upwScenes">{[0,1,2,3,4,5].map(n=><button key={n} className={scene===n?"active":""} onClick={()=>setScene(n)}><img src={n%2?PHOTO.filmmaker:PHOTO.city} alt={`Scene ${n+1}`}/><span>Scene {n+1}</span></button>)}</div><div className="upwTracks"><span>Video</span><i/><span>Text</span><i/><span>Audio</span><i/></div></div>; }
function BrandCanvas({ page }) { return <div className="upwBrandCanvas"><div className="upwBrandPerson"><img src={page.person} alt="Brand designer"/><span>Creative director reference</span></div><div className="upwLogo"><Sparkles/><h1>Lumèa</h1><small>LIGHTING THE FUTURE</small></div><section><h3>Color palette</h3><div className="upwSwatches"><i/><i/><i/><i/><i/></div></section><section><h3>Typography</h3><b>Aa</b><span>Poppins — ABCDEFGHIJKLMNOPQRSTUVWXYZ</span></section></div>; }
function AppCanvas({ page }) { return <div className="upwApp"><div className="upwDeveloper"><img src={page.person} alt="Application developer"/><span>Live implementation</span></div><div className="upwPhone"><small>9:36</small><h4>Good morning, Alex</h4><div className="balance"><span>Your balance</span><strong>$4,280.50</strong></div><div className="phoneActions"><button>Send</button><button>Request</button><button>Top up</button></div><ul><li>Shopify <span>-$4.30</span></li><li>Uber <span>-$18.40</span></li><li>Amazon <span>-$69.99</span></li></ul></div><pre>{`export function Button({ label }) {\n  return <button className="primary">{label}</button>;\n}`}</pre></div>; }
function DocumentCanvas({ page }) { return <article className="upwDocument"><div className="upwAuthor"><img src={page.person} alt="Report author"/><span><strong>Quarterly strategy report</strong><small>Edited moments ago</small></span></div><div className="docTools">B &nbsp; I &nbsp; U &nbsp; • &nbsp; H1 &nbsp; H2</div><h1>Q2 2024 Strategy Report</h1><h2>1. Executive Summary</h2><p>Strong performance across key markets shows our growth strategy is working. Product innovation and customer experience continue to drive results.</p><div className="upwChart"><BarChart3/><span>Revenue Growth (YoY)</span><b>+24%</b></div><h2>2. Key Highlights</h2><ul><li>Revenue up 24% year over year</li><li>Customer acquisition up 18%</li><li>Retention reached 94%</li></ul></article>; }
function CampaignCanvas({ page }) { return <div className="upwCampaign"><div className="campaignHero"><img src={PHOTO.product} alt="Spring product campaign"/><div><small>New launch</small><h1>Spring Refresh</h1><p>New look. More power.</p><button>Shop now</button></div></div><div className="campaignOwner"><img src={page.person} alt="Campaign manager"/><span><strong>Campaign owner</strong><small>Creative and channel coordination</small></span></div><div className="campaignGrid">{["Email Promo","Social Ad","Landing Page"].map((x,i)=><div key={x}><img src={i===1?page.person:PHOTO.product} alt={x}/><strong>{x}</strong></div>)}</div><section><h3>Content calendar</h3><div className="calendarRow">{["Post","Instagram","Blog Post","Facebook Ad"].map((x,i)=><span key={x}>May {12+i}<b>{x}</b></span>)}</div></section></div>; }
function WebsiteCanvas({ page }) { return <div className="upwWebsite"><div className="deviceTabs"><MonitorSmartphone/><button>Desktop</button><button>Tablet</button><button>Mobile</button></div><div className="websitePreview"><img src={PHOTO.building} alt="Modern business building"/><div><small>Elevate</small><h1>Elevate<br/>Your Business</h1><p>Smart solutions that drive growth, efficiency, and impact.</p><button>Get Started</button></div><aside><img src={page.person} alt="Website project owner"/><span>Project owner</span></aside><footer><strong>2.5K+</strong><span>Customers</span><strong>98%</strong><span>Satisfaction</span><strong>24/7</strong><span>Support</span></footer></div></div>; }

function Canvas({ type, page }) { if(type==="research")return <ResearchCanvas page={page}/>; if(type==="video")return <VideoCanvas page={page}/>; if(type==="brand")return <BrandCanvas page={page}/>; if(type==="app")return <AppCanvas page={page}/>; if(type==="document")return <DocumentCanvas page={page}/>; if(type==="campaign")return <CampaignCanvas page={page}/>; if(type==="website")return <WebsiteCanvas page={page}/>; return <DefaultCanvas page={page}/>; }

function BottomDock({ page, active, setActive }) { return <footer className="upwBottom"><nav>{page.bottom.map((tab,index)=><button key={tab} className={active===index?"active":""} onClick={()=>setActive(index)}>{tab}</button>)}</nav><div className="upwAssets">{page.bottom.slice(0,4).map((item,index)=><button key={item}><span>{index%2?<ImageIcon/>:<FolderOpen/>}</span><strong>{item}</strong><small>{index*5+3} items</small></button>)}</div></footer>; }

export default function StreamsUniversalProjectWorkspace({ destination, onNewProject }) {
  const router = useRouter();
  const type = TYPE_BY_DESTINATION[destination] || "default";
  const page = useMemo(() => WORKSPACES[type], [type]);
  const [leftTab,setLeftTab]=useState(0), [topTab,setTopTab]=useState(0), [inspectorTab,setInspectorTab]=useState(0), [bottomTab,setBottomTab]=useState(0);
  const publish = () => { if(type==="video") router.push("/streams-ai/streams-builder/gen-video"); else if(["app","website","campaign"].includes(type)) router.push("/streams-ai/streams-builder/workspace"); else onNewProject?.(); };
  return <main className={`upw type-${type}`}><ProjectHeader page={page} onPublish={publish}/><div className="upwBody"><LeftRail page={page} active={leftTab} onChange={setLeftTab}/><section className="upwCanvas"><nav className="upwTopTabs">{page.top.map((tab,index)=><button key={tab} className={topTab===index?"active":""} onClick={()=>setTopTab(index)}>{tab}</button>)}</nav><Canvas type={type} page={page}/></section><Inspector page={page} tab={inspectorTab} setTab={setInspectorTab}/></div><BottomDock page={page} active={bottomTab} setActive={setBottomTab}/><style jsx global>{`
    .upw{height:100dvh;display:grid;grid-template-rows:52px minmax(0,1fr) 124px;background:#f7f9fc;color:#12203a;font-family:Inter,ui-sans-serif,system-ui;overflow:hidden}.upw button{font:inherit}.upwHeader{display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid #dbe2ec;background:#fff}.upwBrand{display:flex;align-items:center;gap:7px}.upwBrand>span{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:linear-gradient(135deg,#24b7ff,#3448ff);color:#fff;font-weight:900}.upwBrand strong{font-size:12px}.upwProject,.upwActions button,.upwTopTabs button,.upwInspector nav button,.upwBottom nav button{border:0;background:transparent;color:#45546c;cursor:pointer}.upwProject{display:flex;align-items:center;font-weight:800}.upwKind{font-size:10px;color:#3265d8}.upwSaved{font-size:9px;color:#21a66c}.upwActions{margin-left:auto;display:flex;gap:5px}.upwActions button{min-height:28px;padding:0 9px;border:1px solid #dbe2ec;border-radius:5px;font-size:9px;font-weight:700;display:flex;align-items:center;gap:4px}.upwActions .primary{background:#2463eb;border-color:#2463eb;color:#fff}.upwBody{min-height:0;display:grid;grid-template-columns:150px minmax(0,1fr) 236px}.upwLeft{min-height:0;overflow:auto;border-right:1px solid #dbe2ec;background:#fff;padding:8px 6px;scrollbar-width:none}.upwLeft::-webkit-scrollbar{display:none}.upwLeft button{width:100%;display:grid;grid-template-columns:18px 1fr;gap:2px 6px;align-items:center;padding:8px;border:0;border-radius:6px;background:transparent;color:#526078;text-align:left;cursor:pointer}.upwLeft button.active{background:#eaf1ff;color:#1755d6}.upwLeft span{font-size:10px;font-weight:750}.upwLeft small{grid-column:2;font-size:7px;color:#98a3b4}.upwCanvas{min-width:0;min-height:0;overflow:auto;padding:0 14px 14px;background:#fff;scrollbar-width:none}.upwCanvas::-webkit-scrollbar{display:none}.upwTopTabs{height:38px;display:flex;gap:16px;align-items:center;position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #e5e9f0}.upwTopTabs button{height:38px;font-size:9px;white-space:nowrap}.upwTopTabs button.active{color:#1755d6;font-weight:800;border-bottom:2px solid #1755d6}.upwInspector{min-height:0;overflow:auto;border-left:1px solid #dbe2ec;background:#fff;scrollbar-width:none}.upwInspector::-webkit-scrollbar{display:none}.upwInspector nav{display:flex;overflow:auto;border-bottom:1px solid #dbe2ec;padding:0 8px}.upwInspector nav button{height:36px;font-size:8px;white-space:nowrap}.upwInspector nav button.active{color:#1755d6;border-bottom:2px solid #1755d6}.upwFields{padding:10px;display:grid;gap:9px}.upwFields label{display:grid;gap:4px}.upwFields label span{font-size:8px;font-weight:750}.upwFields input,.upwFields select,.upwFields textarea{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #dbe2ec;background:#fff;padding:7px 2px;font-size:9px}.upwFields textarea{min-height:72px;resize:vertical}.upwAi{border:0;border-radius:5px;background:#2463eb;color:#fff;padding:9px;font-size:9px;font-weight:800;display:flex;justify-content:center;gap:5px}.upwPerson,.upwPersonBanner,.upwAuthor,.campaignOwner{display:flex;align-items:center;gap:9px}.upwPerson img,.upwPersonBanner img,.upwAuthor img,.campaignOwner img{width:40px;height:40px;border-radius:50%;object-fit:cover}.upwPerson span,.upwPersonBanner span,.upwAuthor span,.campaignOwner span{display:grid}.upwPerson small,.upwPersonBanner small,.upwAuthor small,.campaignOwner small{font-size:8px;color:#7b8799}.upwBottom{border-top:1px solid #dbe2ec;background:#fff;overflow:hidden}.upwBottom nav{height:34px;display:flex;gap:14px;padding:0 12px;border-bottom:1px solid #e5e9f0;overflow:auto}.upwBottom nav button{font-size:8px;white-space:nowrap}.upwBottom nav button.active{color:#1755d6;border-bottom:2px solid #1755d6}.upwAssets{height:90px;display:flex;gap:10px;padding:9px;overflow:auto}.upwAssets button{min-width:145px;display:grid;grid-template-columns:32px 1fr;gap:2px 7px;align-items:center;border:0;background:transparent;text-align:left}.upwAssets button>span{grid-row:1/3;width:30px;height:30px;border-radius:6px;background:#edf3ff;color:#2463eb;display:grid;place-items:center}.upwAssets svg{width:16px}.upwAssets strong{font-size:9px}.upwAssets small{font-size:7px;color:#8b97aa}.upwDefault,.upwResearch,.upwVideo,.upwBrandCanvas,.upwApp,.upwDocument,.upwCampaign,.upwWebsite{min-height:calc(100% - 50px);padding-top:14px}.upwHeroImage{height:220px;position:relative;overflow:hidden}.upwHeroImage img{width:100%;height:100%;object-fit:cover}.upwHeroImage span{position:absolute;left:18px;bottom:16px;color:#fff;font-weight:800}.upwIntro{padding:18px 0}.upwIntro h1{margin:5px 0;font-size:26px}.upwIntro p{font-size:12px;color:#66748a}.upwMetrics{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #e5e9f0}.upwMetrics>div{display:grid;gap:5px;padding:15px;border-right:1px solid #e5e9f0}.upwMetrics span{color:#20a66a;font-weight:800}.upwPersonBanner{padding-bottom:14px;border-bottom:1px solid #e5e9f0}.upwCompare{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:18px 0;border-bottom:1px solid #e5e9f0}.upwCompare>div{display:grid;gap:8px}.upwCompare svg{color:#6c63ff}.upwResearch section{padding:12px 0}.upwResearch .recommend{border-top:1px solid #dceee2}.upwStage{height:min(42vh,360px);position:relative;background:#080f1f}.upwStage img{width:100%;height:100%;object-fit:cover}.upwStage button{position:absolute;left:12px;bottom:12px;border:0;border-radius:50%;width:34px;height:34px}.upwStage>span{position:absolute;left:55px;bottom:20px;color:#fff;font-size:9px}.upwScenes{display:flex;gap:6px;padding:10px 0;overflow:auto}.upwScenes button{min-width:112px;border:0;border-bottom:2px solid transparent;background:#fff;padding:3px}.upwScenes button.active{border-color:#7654ff}.upwScenes img{width:100%;height:54px;object-fit:cover}.upwScenes span{font-size:8px}.upwTracks{display:grid;grid-template-columns:45px 1fr;gap:4px;padding:8px 0}.upwTracks span{font-size:8px}.upwTracks i{height:12px;background:linear-gradient(90deg,#6d5dfc,#e86bcf);border-radius:3px}.upwBrandCanvas{display:grid;grid-template-columns:180px 1fr;gap:20px}.upwBrandPerson img{width:100%;height:240px;object-fit:cover}.upwBrandPerson span{font-size:9px}.upwLogo{min-height:220px;display:grid;place-items:center;align-content:center}.upwLogo svg{color:#f0ad2c}.upwLogo h1{font-size:42px;margin:8px 0 0}.upwBrandCanvas section{grid-column:2;border-top:1px solid #e5e9f0;padding:12px 0}.upwSwatches{display:flex;gap:10px}.upwSwatches i{width:38px;height:38px;border-radius:6px;background:#071a46}.upwSwatches i:nth-child(2){background:#2563eb}.upwSwatches i:nth-child(3){background:#20c4a8}.upwSwatches i:nth-child(4){background:#f3b51b}.upwSwatches i:nth-child(5){background:#f1f5f9}.upwBrandCanvas section b{font-size:44px;margin-right:14px}.upwApp{display:grid;grid-template-columns:120px 250px 1fr;gap:16px}.upwDeveloper img{width:100%;height:220px;object-fit:cover}.upwDeveloper span{font-size:9px}.upwPhone{border:7px solid #111827;border-radius:28px;padding:15px;background:#fff;box-shadow:0 12px 28px #dbe3ee}.upwPhone>small{display:block;text-align:center}.balance{background:linear-gradient(135deg,#1265ee,#12c8d7);color:#fff;border-radius:10px;padding:12px;display:grid}.balance strong{font-size:19px}.phoneActions{display:flex;gap:5px;margin:10px 0}.phoneActions button{border:0;background:#edf4ff;color:#2563eb;font-size:8px;padding:7px}.upwPhone ul{padding:0;list-style:none}.upwPhone li{display:flex;justify-content:space-between;border-top:1px solid #eef1f5;padding:8px 0;font-size:9px}.upwApp pre{margin:0;border-left:1px solid #e3e8ef;padding:20px;color:#334155;font-size:11px;overflow:auto}.upwAuthor{padding-bottom:12px;border-bottom:1px solid #e5e9f0}.upwDocument{max-width:760px;margin:auto;font-family:Georgia,serif}.docTools{font-family:Inter,sans-serif;color:#64748b;padding:12px 0}.upwDocument h1{font-size:26px}.upwDocument h2{font-size:15px;margin-top:22px}.upwDocument p,.upwDocument li{font-size:11px;line-height:1.6}.upwChart{height:100px;display:flex;align-items:center;gap:15px;border-top:1px solid #e5e9f0;border-bottom:1px solid #e5e9f0;padding:12px 0}.upwChart svg{width:50px;height:50px;color:#2463eb}.upwChart b{margin-left:auto;color:#20a66a}.campaignHero{height:190px;position:relative;overflow:hidden;background:#fff3e8}.campaignHero img{width:100%;height:100%;object-fit:cover}.campaignHero>div{position:absolute;inset:0;display:grid;align-content:center;padding:25px;width:45%;background:linear-gradient(90deg,rgba(255,255,255,.95),transparent)}.campaignHero button,.websitePreview button{width:max-content;border:0;border-radius:4px;background:#2463eb;color:#fff;padding:8px 12px}.campaignOwner{padding:12px 0;border-bottom:1px solid #e5e9f0}.campaignGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px 0}.campaignGrid img{width:100%;height:90px;object-fit:cover}.campaignGrid strong{font-size:9px}.calendarRow{display:flex;gap:8px;overflow:auto}.calendarRow span{min-width:80px;padding:8px;border-top:2px solid #dbe2ec;font-size:8px}.calendarRow b{display:block}.deviceTabs{height:32px;display:flex;gap:12px;align-items:center;font-size:8px}.deviceTabs button{border:0;background:transparent}.websitePreview{height:min(52vh,420px);position:relative;overflow:hidden}.websitePreview>img{width:100%;height:100%;object-fit:cover}.websitePreview>div{position:absolute;inset:0 auto 0 0;width:45%;padding:45px 28px;background:linear-gradient(90deg,rgba(255,255,255,.98),rgba(255,255,255,.72),transparent)}.websitePreview h1{font-size:34px;margin:12px 0}.websitePreview p{font-size:10px}.websitePreview aside{position:absolute;top:12px;right:12px;display:flex;align-items:center;gap:6px;color:#fff;font-size:8px}.websitePreview aside img{width:30px;height:30px;border-radius:50%;object-fit:cover}.websitePreview footer{position:absolute;inset:auto 0 0;display:flex;justify-content:center;gap:10px;background:#06122e;color:#fff;padding:15px}.websitePreview footer span{font-size:8px;color:#cbd5e1}.websitePreview footer strong{font-size:16px}
    @media(max-width:1050px){.upwBody{grid-template-columns:126px minmax(0,1fr) 205px}.upwActions button:nth-child(-n+3){display:none}.upwApp{grid-template-columns:90px 220px 1fr}}
    @media(max-width:760px){.upw{height:auto;min-height:100dvh;grid-template-rows:auto auto auto;overflow:visible}.upwHeader{position:sticky;top:0;z-index:20;min-height:52px}.upwBrand strong,.upwKind,.upwSaved,.upwProject{display:none}.upwActions{width:100%;justify-content:flex-end}.upwBody{display:flex;flex-direction:column}.upwLeft{display:flex;gap:4px;overflow-x:auto;border-right:0;border-bottom:1px solid #dbe2ec;padding:7px;order:0}.upwLeft button{min-width:max-content;grid-template-columns:16px 1fr;padding:7px}.upwLeft small{display:none}.upwCanvas{min-height:540px;padding:0 10px 14px;order:1}.upwTopTabs{overflow-x:auto}.upwInspector{order:2;border-left:0;border-top:1px solid #dbe2ec;max-height:none;overflow:visible}.upwFields{grid-template-columns:1fr 1fr}.upwFields label:last-of-type,.upwPerson,.upwFields>textarea,.upwAi{grid-column:1/-1}.upwBottom{height:auto}.upwAssets{height:auto}.upwMetrics,.upwCompare,.campaignGrid{grid-template-columns:1fr}.upwBrandCanvas,.upwApp{display:block}.upwBrandPerson{display:flex;align-items:center;gap:10px}.upwBrandPerson img,.upwDeveloper img{width:72px;height:72px;border-radius:50%}.upwBrandCanvas section{grid-column:auto}.upwApp pre{margin-top:15px;min-height:160px;border-left:0;border-top:1px solid #e3e8ef}.upwPhone{max-width:240px;margin:14px auto}.upwDocument{padding-inline:4px}.upwStage{height:240px}.websitePreview{height:430px}.websitePreview>div{width:72%;padding:30px 20px}.websitePreview h1{font-size:28px}.websitePreview footer{flex-wrap:wrap}.campaignHero>div{width:70%}}
    @media(max-width:430px){.upwActions button:not(.primary){display:none}.upwFields{grid-template-columns:1fr}.upwIntro h1{font-size:22px}.upwHeroImage{height:190px}.upwStage{height:210px}.websitePreview>div{width:82%}.upwAssets button{min-width:125px}}
    @media print{.upwLeft,.upwInspector,.upwBottom,.upwActions{display:none!important}.upw{height:auto;display:block}.upwCanvas{overflow:visible}}
  `}</style></main>;
}
