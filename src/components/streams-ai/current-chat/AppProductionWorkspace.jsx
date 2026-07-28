"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ArrowUp, Bot, Boxes, CalendarDays, Check,
  Cloud, Code2, Database, FileCode2, LayoutDashboard, LoaderCircle,
  Paperclip, Rocket, ShieldCheck, ShoppingCart, Smartphone, Store,
  Upload, UsersRound, WandSparkles, Wrench, X,
} from "lucide-react";

const QUICK = [
  ["SaaS Application", Cloud], ["CRM", UsersRound], ["Marketplace", ShoppingCart], ["Mobile App", Smartphone],
  ["Dashboard", LayoutDashboard], ["AI Assistant", Bot], ["Business Tool", Wrench], ["Automation", Boxes],
];

const APPS = [
  { title:"SaaS Dashboard", action:"Build SaaS", description:"Subscriptions, analytics, team accounts, and reporting.", prompt:"Build a polished SaaS application with authentication, subscriptions, analytics, team accounts, an admin dashboard, and responsive web and mobile views.", image:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=90" },
  { title:"Mobile Banking", action:"Build Mobile App", description:"Accounts, cards, payments, alerts, and secure access.", prompt:"Build a secure mobile finance application with accounts, transactions, cards, payments, notifications, biometric access, and an admin portal.", image:"https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1400&q=90" },
  { title:"Restaurant Ordering", action:"Build Restaurant System", description:"Menu, ordering, kitchen workflow, payments, and reports.", prompt:"Build a restaurant ordering and POS system with menus, online ordering, kitchen workflow, inventory, payments, delivery, and reporting.", image:"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=90" },
  { title:"AI Assistant", action:"Build AI Product", description:"Chat, knowledge, files, workflows, and administration.", prompt:"Build an AI assistant product with chat, file analysis, knowledge retrieval, account history, usage controls, and an administration console.", image:"https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=90" },
  { title:"Marketplace", action:"Build Marketplace", description:"Products, sellers, search, checkout, orders, and commissions.", prompt:"Build a multi-vendor marketplace with seller onboarding, product catalogs, search, checkout, commissions, reviews, orders, and dashboards.", image:"https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&w=1400&q=90" },
  { title:"CRM", action:"Build CRM", description:"Contacts, companies, deals, activities, and automation.", prompt:"Build a CRM with leads, contacts, companies, pipeline stages, tasks, email activity, reporting, roles, and automation.", image:"https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=90" },
  { title:"Inventory System", action:"Build Inventory App", description:"Products, stock, suppliers, scanning, alerts, and orders.", prompt:"Build an inventory and warehouse application with products, SKUs, stock levels, purchase orders, suppliers, scanning, alerts, and reports.", image:"https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=90" },
  { title:"Booking Platform", action:"Build Booking App", description:"Availability, appointments, payments, staff, and reminders.", prompt:"Build an appointment booking platform with availability, calendars, services, customers, payments, reminders, and staff management.", image:"https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1400&q=90" },
  { title:"Business Tool", action:"Build Business Tool", description:"Projects, tasks, documents, permissions, and team operations.", prompt:"Build an internal business operations tool with projects, tasks, documents, teams, permissions, dashboards, notifications, and audit history.", image:"https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=90" },
];

const FLOW = ["Describe your idea", "Get your blueprint", "Review & approve", "We build everything", "Launch with confidence"];

function inferBlueprint(prompt, selected) {
  const lower = `${selected} ${prompt}`.toLowerCase();
  const productName = selected || (lower.includes("crm") ? "Customer Relationship Platform" : lower.includes("booking") ? "Booking Platform" : lower.includes("marketplace") ? "Marketplace" : lower.includes("inventory") ? "Inventory System" : lower.includes("mobile") ? "Mobile Application" : "Custom Application");
  const features = lower.includes("crm")
    ? ["Lead and contact management", "Sales pipeline", "Tasks and follow-ups", "Reporting and analytics", "Team roles"]
    : lower.includes("booking")
      ? ["Availability calendar", "Appointments", "Payments", "Automated reminders", "Staff management"]
      : lower.includes("marketplace")
        ? ["Seller onboarding", "Product catalog", "Search and checkout", "Orders and commissions", "Reviews"]
        : ["Responsive dashboard", "User accounts", "Core workflow", "Notifications", "Administration"];
  return {
    productName,
    summary: prompt.trim(),
    features,
    surfaces: lower.includes("mobile") ? ["Mobile app", "Admin portal", "API"] : ["Web application", "Mobile-ready experience", "Admin portal"],
    foundation: ["Secure authentication", "Structured database", "Versioned API", "Role-based permissions"],
    integrations: lower.includes("payment") || lower.includes("marketplace") || lower.includes("booking") ? ["Payments", "Email", "Calendar"] : ["Email", "File storage", "Analytics"],
  };
}

function Workflow({ phase }) {
  return <div className="appFlow" aria-label="App project workflow">{FLOW.map((title, i) => {
    const active = phase === "discover" ? i === 0 : i <= 2;
    return <div key={title} className={active ? "active" : ""}><span>{active ? <Check/> : i + 1}</span><b>{title}</b>{i < FLOW.length - 1 ? <ArrowRight/> : null}</div>;
  })}</div>;
}

export default function AppProductionWorkspace() {
  const router = useRouter();
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [phase, setPhase] = useState("discover");
  const [blueprint, setBlueprint] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const canStart = useMemo(() => prompt.trim().length > 3 || attachments.length > 0, [prompt, attachments]);

  function resize(el) { if (!el) return; el.style.height = "0px"; el.style.height = `${Math.min(170, Math.max(44, el.scrollHeight))}px`; }
  function choose(title, text = "") { setSelected(title); setPrompt(text || `Build a production-ready ${title.toLowerCase()} with a complete product blueprint, responsive experience, backend, testing, and deployment plan.`); requestAnimationFrame(() => { textareaRef.current?.focus(); resize(textareaRef.current); }); }
  function addFiles(event) { const files = Array.from(event.target.files || []).slice(0, 8 - attachments.length).map(file => ({ id:`${file.name}-${file.lastModified}`, name:file.name, size:file.size, type:file.type, url:file.type.startsWith("image/") ? URL.createObjectURL(file) : "" })); setAttachments(current => [...current, ...files]); event.target.value = ""; }
  function removeFile(id) { setAttachments(current => { const item = current.find(x => x.id === id); if (item?.url) URL.revokeObjectURL(item.url); return current.filter(x => x.id !== id); }); }
  function createBlueprint(event) { event?.preventDefault?.(); if (!canStart) return; setPreparing(true); const brief = { prompt:prompt.trim(), mode:selected || "Custom app", attachments:attachments.map(({name,size,type}) => ({name,size,type})) }; localStorage.setItem("streams-app-project:creative-brief", JSON.stringify(brief)); window.dispatchEvent(new CustomEvent("streams-app-project:brief-started", { detail:brief })); window.setTimeout(() => { setBlueprint(inferBlueprint(prompt, selected)); setPhase("blueprint"); setPreparing(false); }, 420); }
  function approveBlueprint() { const payload = { ...blueprint, sourcePrompt:prompt.trim(), attachments:attachments.map(({name,size,type}) => ({name,size,type})) }; localStorage.setItem("streams-app-project:approved-blueprint", JSON.stringify(payload)); window.dispatchEvent(new CustomEvent("streams-app-project:blueprint-approved", { detail:payload })); router.push("/streams-ai/streams-builder"); }

  return <main className={`appStart phase-${phase}`} aria-label="Streams App Project">
    <div className="appCircuit appCircuitLeft"/><div className="appCircuit appCircuitRight"/>
    <section className="appInner">
      <header className="appHero"><h1>STREAMS <span>APP PROJECT</span></h1><p><Code2/> Hosted by <strong>A.S.K. Product Architect</strong></p></header>

      {phase === "discover" ? <>
        <form className={attachments.length || prompt.includes("\n") ? "appComposer expanded" : "appComposer"} onSubmit={createBlueprint}>
          {attachments.length ? <div className="appFiles">{attachments.map(item => <div key={item.id}>{item.url ? <img src={item.url} alt=""/> : <Paperclip/>}<small>{item.name}</small><button type="button" onClick={() => removeFile(item.id)} aria-label={`Remove ${item.name}`}><X/></button></div>)}</div> : null}
          <div className="appPrompt"><Code2/><textarea ref={textareaRef} rows={1} value={prompt} onChange={e => { setPrompt(e.target.value); resize(e.target); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); createBlueprint(e); } }} placeholder="What would you like to build?\nDescribe your application, website, automation, or software idea..." aria-label="Describe the app you want to build"/></div>
          <div className="appActions"><button type="button" onClick={() => fileRef.current?.click()}><Upload/>Attach files or documents</button><span>Enter to begin · Shift + Enter for a new line</span><button className="appSubmit" type="submit" disabled={!canStart || preparing}>{preparing ? <LoaderCircle className="spin"/> : <ArrowUp/>}</button></div>
          <input ref={fileRef} hidden type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,.zip" onChange={addFiles}/>
        </form>
        <Workflow phase={phase}/>
        <div className="appQuick" aria-label="Popular application types">{QUICK.map(([label, Icon]) => <button type="button" key={label} className={selected === label ? "active" : ""} onClick={() => choose(label)}><Icon/>{label}</button>)}</div>
        <section className="appGrid" aria-label="Application ideas">{APPS.map(item => <button type="button" key={item.title} className={selected === item.title ? "appCard active" : "appCard"} onClick={() => choose(item.title, item.prompt)}><span className="appVisual"><img src={item.image} alt=""/><span className="appVisualShade"/></span><span className="appCopy"><strong>{item.title}</strong><small>{item.description}</small><b>{item.action}<ArrowRight/></b></span></button>)}</section>
      </> : <>
        <Workflow phase={phase}/>
        <section className="blueprintStage" aria-live="polite">
          <div className="blueprintIntro"><span><WandSparkles/></span><div><small>A.S.K. Product Architect</small><h2>I created your product blueprint.</h2><p>Review the proposed product structure before Streams begins implementation.</p></div></div>
          <div className="blueprintLayout">
            <article className="blueprintPreview"><header><span><FileCode2/></span><div><small>PRODUCT BLUEPRINT</small><h3>{blueprint.productName}</h3></div><i>Ready for review</i></header><p>{blueprint.summary}</p><div className="previewWindow"><div className="previewTop"><i/><i/><i/><span>{blueprint.productName}</span></div><div className="previewBody"><aside>{blueprint.features.slice(0,4).map(feature => <span key={feature}><Check/>{feature}</span>)}</aside><section><div className="metricRow"><b>Product overview</b><b>Active workflow</b><b>Team access</b></div><div className="chartMock"><span/><span/><span/><span/><span/></div></section></div></div></article>
            <div className="blueprintDetails"><article><h4><LayoutDashboard/>Core features</h4>{blueprint.features.map(item => <p key={item}><Check/>{item}</p>)}</article><article><h4><Smartphone/>Product surfaces</h4>{blueprint.surfaces.map(item => <p key={item}><Check/>{item}</p>)}</article><article><h4><ShieldCheck/>Technical foundation</h4>{blueprint.foundation.map(item => <p key={item}><Check/>{item}</p>)}</article><article><h4><Boxes/>Connections</h4>{blueprint.integrations.map(item => <p key={item}><Check/>{item}</p>)}</article></div>
          </div>
          <div className="blueprintActions"><button type="button" onClick={() => setPhase("discover")}><ArrowLeft/>Edit idea</button><button type="button" className="approveButton" onClick={approveBlueprint}>Approve blueprint<Rocket/></button></div>
        </section>
      </>}
    </section>

    <style jsx global>{`
      .appStart{height:100dvh;min-height:690px;overflow:hidden;position:relative;background:radial-gradient(circle at 50% -8%,rgba(0,229,255,.15),transparent 30%),radial-gradient(circle at 8% 70%,rgba(20,184,166,.08),transparent 28%),linear-gradient(180deg,#02090f,#02070c 70%,#031018);color:#edfefe;font-family:Inter,ui-sans-serif,system-ui}.appStart *{box-sizing:border-box}.appStart button,.appStart textarea{font:inherit}.appCircuit{position:absolute;top:74px;width:220px;height:110px;opacity:.32;background:repeating-linear-gradient(90deg,transparent 0 32px,rgba(8,221,236,.45) 33px 34px,transparent 35px 64px);mask-image:linear-gradient(to bottom,black,transparent)}.appCircuitLeft{left:0}.appCircuitRight{right:0;transform:scaleX(-1)}
      .appInner{height:100%;width:min(1580px,100%);margin:auto;padding:14px 20px 12px;display:grid;grid-template-rows:auto auto auto auto minmax(0,1fr);gap:9px;position:relative;z-index:1}.appHero{display:grid;justify-items:center;gap:3px}.appHero h1{margin:0;font-size:clamp(31px,3vw,50px);line-height:1}.appHero h1 span{background:linear-gradient(90deg,#06d9eb,#2af3cf);-webkit-background-clip:text;color:transparent}.appHero>p{margin:0;display:flex;align-items:center;gap:8px;color:#c1d0d8;font-size:15px}.appHero>p svg{width:20px;color:#08ddec}.appHero strong{color:#08ddec}
      .appComposer{width:min(1190px,94vw);min-height:116px;justify-self:center;border:1px solid rgba(8,221,236,.9);border-radius:24px;padding:13px 18px;background:linear-gradient(135deg,rgba(5,22,33,.96),rgba(3,14,24,.92));box-shadow:0 0 0 1px rgba(8,221,236,.06),0 18px 70px rgba(0,205,226,.12);display:grid;gap:8px}.appComposer:focus-within{box-shadow:0 0 0 1px rgba(8,221,236,.28),0 0 45px rgba(0,221,236,.22),0 24px 80px rgba(0,0,0,.32)}.appPrompt{display:grid;grid-template-columns:auto 1fr;gap:12px}.appPrompt>svg{width:30px;color:#08ddec;margin-top:5px}.appComposer textarea{width:100%;min-height:52px;max-height:170px;resize:none;border:0;outline:0;background:transparent;color:#effcff;font-size:17px;line-height:1.45}.appComposer textarea::placeholder{color:#aebac3}.appActions{display:flex;align-items:center;gap:12px}.appActions>button:first-child{min-height:38px;padding:0 14px;border:1px solid rgba(0,221,236,.55);border-radius:8px;background:rgba(0,221,236,.04);color:#15e9f5;display:flex;align-items:center;gap:8px;font-weight:700}.appActions span{margin-left:auto;color:#91a2ad;font-size:11px}.appSubmit{width:50px;height:50px;border:0;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#1af0f7,#08bfe3);color:#00212a}.appSubmit:disabled{opacity:.38}.appFiles{display:flex;gap:8px;overflow:auto}.appFiles>div{position:relative;width:96px;height:64px;border:1px solid #164459;border-radius:10px;overflow:hidden;display:grid;place-items:center}.appFiles img{width:100%;height:100%;object-fit:cover}.appFiles small{position:absolute;left:3px;right:3px;bottom:3px;background:#03131ddd;padding:3px;font-size:8px}.appFiles button{position:absolute;right:3px;top:3px;width:21px;height:21px;border:0;border-radius:50%;background:#001017;color:white}
      .appFlow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;width:100%;padding:1px 2px}.appFlow>div{display:flex;align-items:center;gap:9px;min-width:0;color:#536975}.appFlow>div>span{width:31px;height:31px;border:1px solid #245365;border-radius:50%;display:grid;place-items:center;font-size:10px;flex:0 0 auto}.appFlow>div>b{font-size:11px;white-space:nowrap}.appFlow>div>svg{margin-left:auto;width:17px}.appFlow>div.active{color:#08ddec}.appFlow>div.active>span{border-color:#08ddec;background:rgba(0,221,236,.08);box-shadow:0 0 18px rgba(0,221,236,.14)}.appFlow>div.active>span svg{width:14px}
      .appQuick{width:100%;display:flex;justify-content:center;gap:10px;overflow:auto;scrollbar-width:none}.appQuick button{flex:0 0 auto;min-height:40px;padding:0 18px;border:1px solid rgba(93,143,164,.32);border-radius:999px;background:rgba(4,17,27,.55);color:#dff9fc;display:flex;align-items:center;gap:8px}.appQuick button:hover,.appQuick button.active{border-color:#08ddec;color:#08ddec;background:rgba(0,221,236,.09)}.appQuick svg{width:17px;color:#08ddec}
      .appGrid{min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:10px}.appCard{position:relative;overflow:hidden;border:0;border-radius:13px;background:#06131c;color:white;text-align:left;padding:0;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.24)}.appVisual{position:absolute;inset:0 38% 0 0}.appVisual img{width:100%;height:100%;object-fit:cover;transition:transform .35s}.appVisualShade{position:absolute;inset:0;background:linear-gradient(90deg,transparent 50%,rgba(3,12,19,.9))}.appCopy{position:absolute;inset:0 12px 0 63%;display:grid;align-content:center;gap:7px}.appCopy strong{font-size:15px}.appCopy small{color:#b7c6ce;font-size:10px;line-height:1.43}.appCopy b{display:flex;align-items:center;justify-content:space-between;color:#11e0ed;font-size:10px}.appCard:hover,.appCard.active{transform:translateY(-3px);box-shadow:0 18px 44px rgba(0,214,235,.13)}.appCard:hover img,.appCard.active img{transform:scale(1.045)}.appCard.active{outline:1px solid #08ddec}
      .blueprintStage{grid-row:3/6;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:14px;width:min(1320px,100%);justify-self:center}.blueprintIntro{display:flex;align-items:center;justify-content:center;gap:14px}.blueprintIntro>span{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:rgba(0,221,236,.1);color:#08ddec}.blueprintIntro small{color:#08ddec;font-weight:800}.blueprintIntro h2{margin:2px 0 0;font-size:clamp(25px,2.4vw,38px)}.blueprintIntro p{margin:3px 0 0;color:#99acb7;font-size:12px}.blueprintLayout{min-height:0;display:grid;grid-template-columns:1.45fr 1fr;gap:14px}.blueprintPreview,.blueprintDetails article{background:linear-gradient(145deg,rgba(7,25,37,.92),rgba(3,14,22,.94));border:1px solid rgba(63,130,153,.22);border-radius:16px}.blueprintPreview{padding:16px;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:11px}.blueprintPreview header{display:flex;align-items:center;gap:10px}.blueprintPreview header>span{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:rgba(0,221,236,.1);color:#08ddec}.blueprintPreview header h3{margin:1px 0 0;font-size:22px}.blueprintPreview header small{color:#6e8793;font-size:9px}.blueprintPreview header i{margin-left:auto;color:#4ade80;font-size:10px;font-style:normal}.blueprintPreview>p{margin:0;color:#b8c8d0;font-size:12px}.previewWindow{min-height:0;border-radius:12px;overflow:hidden;background:#edf5f7;color:#17313c}.previewTop{height:34px;background:#dce9ed;display:flex;align-items:center;gap:6px;padding:0 10px}.previewTop i{width:7px;height:7px;border-radius:50%;background:#8ca7b0}.previewTop span{margin-left:6px;font-size:9px;font-weight:800}.previewBody{height:calc(100% - 34px);display:grid;grid-template-columns:150px 1fr}.previewBody aside{padding:12px;background:#153744;color:#e8fbff;display:grid;align-content:start;gap:9px}.previewBody aside span{display:flex;gap:6px;font-size:9px}.previewBody aside svg{width:12px;color:#2dd4bf}.previewBody section{padding:14px;display:grid;grid-template-rows:auto 1fr;gap:14px}.metricRow{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.metricRow b{padding:10px;background:white;border-radius:8px;font-size:9px}.chartMock{display:flex;align-items:end;gap:8px;padding:12px;background:white;border-radius:9px}.chartMock span{flex:1;border-radius:5px 5px 0 0;background:linear-gradient(#08ddec,#0f7e9b)}.chartMock span:nth-child(1){height:30%}.chartMock span:nth-child(2){height:48%}.chartMock span:nth-child(3){height:42%}.chartMock span:nth-child(4){height:70%}.chartMock span:nth-child(5){height:86%}.blueprintDetails{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.blueprintDetails article{padding:14px}.blueprintDetails h4{margin:0 0 10px;display:flex;gap:7px;color:#11e0ed;font-size:12px}.blueprintDetails p{margin:7px 0;display:flex;gap:6px;color:#c5d3d9;font-size:10px}.blueprintDetails p svg{width:13px;color:#4ade80}.blueprintActions{display:flex;justify-content:flex-end;gap:10px}.blueprintActions button{min-height:42px;padding:0 16px;border:1px solid rgba(96,145,162,.32);border-radius:9px;background:rgba(6,21,31,.8);color:#dff9fc;display:flex;align-items:center;gap:8px}.approveButton{border:0!important;background:linear-gradient(135deg,#0fd6e5,#14b8a6)!important;color:#00272c!important;font-weight:800}.spin{animation:appSpin .8s linear infinite}@keyframes appSpin{to{transform:rotate(360deg)}}
      @media(max-width:1080px){.appStart{overflow:auto}.appInner{height:auto;min-height:100%}.appGrid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:220px}.appFlow{overflow-x:auto}.blueprintLayout{grid-template-columns:1fr}}
      @media(max-width:720px){.appStart{height:100dvh;min-height:100dvh;overflow:hidden}.appCircuit{display:none}.appInner{height:100%;padding:11px 12px;grid-template-rows:auto auto auto auto minmax(0,1fr);gap:8px}.appHero h1{font-size:27px}.appHero>p{font-size:11px}.appComposer{width:100%;min-height:114px;border-radius:18px;padding:11px}.appComposer textarea{font-size:14px}.appActions span{display:none}.appFlow{display:flex;overflow-x:auto;gap:14px}.appFlow>div{flex:0 0 auto}.appFlow>div>svg{display:none}.appQuick{justify-content:flex-start}.appQuick button{min-height:36px;padding:0 13px;font-size:11px}.appGrid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px}.appCard{flex:0 0 88vw;height:100%;scroll-snap-align:start}.appVisual{inset:0 0 38% 0}.appVisualShade{background:linear-gradient(180deg,transparent 42%,rgba(3,12,19,.92))}.appCopy{inset:auto 14px 13px 14px}.blueprintStage{grid-row:3/6}.blueprintLayout{display:block;overflow:auto}.blueprintDetails{margin-top:10px;grid-template-columns:1fr}.blueprintActions button{flex:1;justify-content:center}}
    `}</style>
  </main>;
}
