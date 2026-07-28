"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ArrowUp, Check, FileImage, Image as ImageIcon,
  LoaderCircle, Mail, Megaphone, Package, Paperclip, Rocket, Sparkles,
  Store, Upload, WandSparkles, X,
} from "lucide-react";

const CATEGORIES = [
  ["Beauty", "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=90"],
  ["Coffee", "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=90"],
  ["Technology", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=90"],
  ["Fashion", "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=90"],
  ["Food", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=90"],
  ["Fitness", "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1200&q=90"],
  ["Automotive", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=90"],
  ["Home", "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=90"],
];

const OUTPUTS = [
  { key:"landing", title:"Landing Page Hero", icon:Store, route:"/streams-ai?destination=website-builder" },
  { key:"social", title:"Social Ad", icon:Megaphone, route:"/streams-ai?destination=image-studio" },
  { key:"email", title:"Email Campaign", icon:Mail, route:"/streams-ai?destination=content" },
  { key:"product", title:"Product Card", icon:Package, route:"/streams-ai?destination=image-studio" },
  { key:"banner", title:"Display Banner", icon:ImageIcon, route:"/streams-ai?destination=image-studio" },
  { key:"launch", title:"Launch Plan", icon:Rocket, route:"/streams-ai?destination=business-builder" },
];

const FLOW = ["Describe your launch", "Campaign blueprint", "Review & approve", "Create assets", "Launch campaign"];

function inferBlueprint(prompt, category) {
  const selected = category || "Product";
  return {
    name: `${selected} Launch Campaign`,
    summary: prompt.trim(),
    audience: "High-intent customers who value a clear product benefit, premium presentation, and a confident reason to act now.",
    goal: "Launch the product with a coordinated campaign that builds awareness, captures interest, and converts buyers.",
    assets: OUTPUTS.map(item => item.title),
    voice: selected === "Beauty" ? "Clean, elevated, reassuring" : selected === "Coffee" ? "Warm, grounded, inviting" : selected === "Technology" ? "Confident, precise, performance-driven" : "Modern, clear, conversion-focused",
  };
}

function Workflow({ phase }) {
  const activeIndex = phase === "discover" ? 0 : phase === "blueprint" ? 2 : 3;
  return <div className="campaignFlowStrip" aria-label="Campaign workflow">{FLOW.map((title,index)=><div key={title} className={index<=activeIndex?"active":""}><span>{index<=activeIndex?<Check/>:index+1}</span><b>{title}</b>{index<FLOW.length-1?<ArrowRight/>:null}</div>)}</div>;
}

export default function ProductCampaignWorkspace(){
  const router = useRouter();
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const [prompt,setPrompt] = useState("");
  const [category,setCategory] = useState("");
  const [attachments,setAttachments] = useState([]);
  const [phase,setPhase] = useState("discover");
  const [blueprint,setBlueprint] = useState(null);
  const [preparing,setPreparing] = useState(false);
  const [activeOutput,setActiveOutput] = useState("landing");
  const canStart = useMemo(()=>prompt.trim().length>3 || attachments.length>0,[prompt,attachments]);

  function resize(el){ if(!el)return; el.style.height="0px"; el.style.height=`${Math.min(170,Math.max(46,el.scrollHeight))}px`; }
  function chooseCategory(name){ setCategory(name); setPrompt(`Launch a polished ${name.toLowerCase()} product campaign with premium visuals, conversion-focused messaging, social ads, email, a landing page, and a coordinated launch plan.`); requestAnimationFrame(()=>{textareaRef.current?.focus();resize(textareaRef.current);}); }
  function addFiles(event){ const files=Array.from(event.target.files||[]).slice(0,6-attachments.length).map(file=>({id:`${file.name}-${file.lastModified}`,name:file.name,size:file.size,type:file.type,url:file.type.startsWith("image/")?URL.createObjectURL(file):""})); setAttachments(current=>[...current,...files]); event.target.value=""; }
  function removeFile(id){ setAttachments(current=>{const item=current.find(x=>x.id===id);if(item?.url)URL.revokeObjectURL(item.url);return current.filter(x=>x.id!==id);}); }
  function createBlueprint(event){ event?.preventDefault?.(); if(!canStart)return; setPreparing(true); const brief={prompt:prompt.trim(),category:category||"Custom product",attachments:attachments.map(({name,size,type})=>({name,size,type}))}; localStorage.setItem("streams-campaign-project:creative-brief",JSON.stringify(brief)); window.dispatchEvent(new CustomEvent("streams-campaign-project:brief-started",{detail:brief})); window.setTimeout(()=>{setBlueprint(inferBlueprint(prompt,category));setPhase("blueprint");setPreparing(false);},420); }
  function approveBlueprint(){ const payload={...blueprint,sourcePrompt:prompt.trim(),category,attachments:attachments.map(({name,size,type})=>({name,size,type}))}; localStorage.setItem("streams-campaign-project:approved-blueprint",JSON.stringify(payload)); window.dispatchEvent(new CustomEvent("streams-campaign-project:blueprint-approved",{detail:payload})); setPhase("workspace"); }
  function openOutput(item){ setActiveOutput(item.key); router.push(item.route); }

  const heroImage = attachments.find(item=>item.url)?.url || CATEGORIES.find(([name])=>name===category)?.[1] || CATEGORIES[0][1];

  return <main className={`productCampaign phase-${phase}`} aria-label="Streams Product Campaign Project">
    <section className="campaignInner">
      <header className="campaignHeroHeader"><div className="campaignBrand"><Sparkles/><span>STREAMS PRODUCT CAMPAIGN PROJECT</span></div><h1>Product photo <em>→</em> full campaign.</h1><p>Hosted by <strong>A.S.K. Campaign Director</strong></p></header>

      {phase==="discover" ? <>
        <form className="campaignComposer" onSubmit={createBlueprint}>
          {attachments.length?<div className="campaignFiles">{attachments.map(item=><div key={item.id}>{item.url?<img src={item.url} alt=""/>:<Paperclip/>}<small>{item.name}</small><button type="button" onClick={()=>removeFile(item.id)} aria-label={`Remove ${item.name}`}><X/></button></div>)}</div>:null}
          <div className="campaignPrompt"><WandSparkles/><textarea ref={textareaRef} rows={1} value={prompt} onChange={e=>{setPrompt(e.target.value);resize(e.target)}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();createBlueprint(e)}}} placeholder={"What would you like to launch today?\nDescribe the product, offer, audience, or campaign you want to create."}/></div>
          <div className="campaignActions"><button type="button" onClick={()=>fileRef.current?.click()}><Upload/>Upload product photo or brand files</button><span>Enter to begin · Shift + Enter for a new line</span><button className="campaignSubmit" type="submit" disabled={!canStart||preparing}>{preparing?<LoaderCircle className="spin"/>:<ArrowUp/>}</button></div>
          <input ref={fileRef} hidden type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.md" onChange={addFiles}/>
        </form>
        <Workflow phase={phase}/>
        <div className="categoryRow" aria-label="Product categories">{CATEGORIES.map(([name])=><button type="button" key={name} className={category===name?"active":""} onClick={()=>chooseCategory(name)}>{name}</button>)}</div>
        <section className="categoryGrid">{CATEGORIES.map(([name,image])=><button type="button" key={name} className={category===name?"categoryCard active":"categoryCard"} onClick={()=>chooseCategory(name)}><img src={image} alt={`${name} product campaign inspiration`}/><span/><><strong>{name}</strong><small>Create a complete {name.toLowerCase()} launch campaign.</small><b>Start campaign <ArrowRight/></b></></button>)}</section>
      </> : null}

      {phase==="blueprint" ? <>
        <Workflow phase={phase}/>
        <section className="campaignBlueprint">
          <div className="blueprintHeading"><WandSparkles/><div><small>A.S.K. Campaign Director</small><h2>I built your campaign blueprint.</h2><p>Review the recommended launch system before Streams creates the campaign assets.</p></div></div>
          <div className="campaignBlueprintGrid">
            <article className="productInput"><small>INPUT PRODUCT</small><img src={heroImage} alt="Product campaign source"/><strong>{blueprint.name}</strong><p>{blueprint.summary}</p></article>
            <article className="blueprintPlan"><div><span>Goal</span><strong>{blueprint.goal}</strong></div><div><span>Audience</span><strong>{blueprint.audience}</strong></div><div><span>Voice</span><strong>{blueprint.voice}</strong></div><div className="assetList"><span>Recommended outputs</span>{blueprint.assets.map(item=><p key={item}><Check/>{item}</p>)}</div></article>
          </div>
          <div className="blueprintActions"><button type="button" onClick={()=>setPhase("discover")}><ArrowLeft/>Edit launch idea</button><button type="button" className="approveCampaign" onClick={approveBlueprint}>Approve campaign blueprint<Rocket/></button></div>
        </section>
      </> : null}

      {phase==="workspace" ? <>
        <Workflow phase={phase}/>
        <section className="campaignWorkspaceStage">
          <div className="workspaceIntro"><div><small>COMPLETE CAMPAIGN WORKSPACE</small><h2>{blueprint.name}</h2><p>One product image transformed into a coordinated launch system.</p></div><button onClick={()=>setPhase("discover")}>Start another campaign</button></div>
          <div className="campaignOutputBoard">
            <article className="sourceProduct"><small>INPUT PRODUCT PHOTO</small><img src={heroImage} alt="Uploaded campaign product"/><strong>{category||"Product"}</strong></article>
            <ArrowRight className="sourceArrow"/>
            <div className="outputGrid">{OUTPUTS.map((item,index)=>{const Icon=item.icon;return <button type="button" key={item.key} className={activeOutput===item.key?"outputTile active":"outputTile"} onClick={()=>openOutput(item)}><div className={`outputMock mock-${item.key}`}><span className="mockBrand">STREAMS</span><img src={heroImage} alt=""/><strong>{index===0?"Built to launch.":index===1?"Make them stop.":index===2?"Your launch starts here.":index===3?"Ready to buy.":index===4?"See the difference.":"Launch with confidence."}</strong><small>{item.title}</small></div><span><Icon/>{item.title}<ArrowRight/></span></button>})}</div>
          </div>
        </section>
      </> : null}
    </section>

    <style jsx global>{`
      .productCampaign{height:100dvh;min-height:700px;overflow:hidden;background:radial-gradient(circle at 92% 0,rgba(37,99,235,.16),transparent 24%),linear-gradient(180deg,#f8fbff,#eef5ff);color:#09133d;font-family:Inter,ui-sans-serif,system-ui}.productCampaign *{box-sizing:border-box}.productCampaign button,.productCampaign textarea{font:inherit}.campaignInner{height:100%;width:min(1580px,100%);margin:auto;padding:14px 22px;display:grid;grid-template-rows:auto auto auto auto minmax(0,1fr);gap:9px}.campaignHeroHeader{text-align:center}.campaignBrand{display:flex;align-items:center;justify-content:center;gap:8px;color:#1d4ed8;font-size:12px;font-weight:900;letter-spacing:.1em}.campaignBrand svg{width:17px}.campaignHeroHeader h1{margin:2px 0 0;font-family:Georgia,serif;font-size:clamp(34px,4.1vw,68px);line-height:.98;font-weight:500}.campaignHeroHeader h1 em{font-style:normal;color:#2563eb}.campaignHeroHeader p{margin:4px 0 0;color:#667085}.campaignHeroHeader strong{color:#1d4ed8}.campaignComposer{width:min(1200px,95vw);min-height:116px;justify-self:center;border:1px solid #8bb4ff;border-radius:25px;padding:13px 18px;background:rgba(255,255,255,.92);box-shadow:0 20px 65px rgba(37,99,235,.14);display:grid;gap:8px}.campaignComposer:focus-within{box-shadow:0 0 0 2px rgba(37,99,235,.12),0 24px 75px rgba(37,99,235,.2)}.campaignPrompt{display:grid;grid-template-columns:auto 1fr;gap:12px}.campaignPrompt>svg{width:29px;color:#2563eb;margin-top:5px}.campaignPrompt textarea{width:100%;min-height:52px;max-height:170px;resize:none;border:0;outline:0;background:transparent;color:#0f172a;font-size:17px;line-height:1.45}.campaignPrompt textarea::placeholder{color:#63708a}.campaignActions{display:flex;align-items:center;gap:12px}.campaignActions>button:first-child{min-height:39px;padding:0 14px;border:1px solid #7ca7f8;border-radius:9px;background:#edf4ff;color:#174ecb;display:flex;align-items:center;gap:8px;font-weight:800}.campaignActions span{margin-left:auto;color:#74819a;font-size:11px}.campaignSubmit{width:50px;height:50px;border:0;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#2f80ff,#1d4ed8);color:white;box-shadow:0 10px 30px rgba(37,99,235,.28)}.campaignSubmit:disabled{opacity:.38}.campaignFiles{display:flex;gap:8px;overflow:auto}.campaignFiles>div{position:relative;width:96px;height:64px;border:1px solid #b8cdf8;border-radius:10px;overflow:hidden;background:white;display:grid;place-items:center}.campaignFiles img{width:100%;height:100%;object-fit:cover}.campaignFiles small{position:absolute;left:3px;right:3px;bottom:3px;background:#ffffffdd;padding:3px;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.campaignFiles button{position:absolute;right:3px;top:3px;width:21px;height:21px;border:0;border-radius:50%;background:#172554;color:white}.campaignFiles button svg{width:11px}.campaignFlowStrip{width:min(1200px,95vw);justify-self:center;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.campaignFlowStrip>div{display:flex;align-items:center;gap:7px;color:#8290a8;min-width:0}.campaignFlowStrip span{width:29px;height:29px;border:1px solid #b8c8e4;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;font-size:10px}.campaignFlowStrip b{font-size:10px;white-space:nowrap}.campaignFlowStrip>div>svg{margin-left:auto;width:15px}.campaignFlowStrip .active{color:#1d4ed8}.campaignFlowStrip .active span{border-color:#2563eb;background:#eaf1ff}.campaignFlowStrip .active span svg{width:14px}.categoryRow{display:flex;justify-content:center;gap:8px;overflow:auto;scrollbar-width:none}.categoryRow button{flex:0 0 auto;min-height:37px;padding:0 17px;border:1px solid #c5d5ef;border-radius:999px;background:#ffffffbb;color:#334155}.categoryRow button:hover,.categoryRow button.active{border-color:#2563eb;background:#eaf1ff;color:#1d4ed8}.categoryGrid{min-height:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:10px}.categoryCard{position:relative;overflow:hidden;border:0;border-radius:15px;padding:0;text-align:left;color:white;background:#13213f;box-shadow:0 12px 30px rgba(30,64,175,.14);cursor:pointer}.categoryCard img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .3s ease}.categoryCard>span{position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(5,15,42,.92))}.categoryCard>strong,.categoryCard>small,.categoryCard>b{position:absolute;left:16px;right:16px}.categoryCard>strong{bottom:53px;font-size:18px}.categoryCard>small{bottom:33px;color:#dbeafe;font-size:10px}.categoryCard>b{bottom:11px;display:flex;align-items:center;justify-content:space-between;color:#93c5fd;font-size:10px}.categoryCard b svg{width:15px}.categoryCard:hover img,.categoryCard.active img{transform:scale(1.05)}.categoryCard.active{outline:2px solid #2563eb}.campaignBlueprint{grid-row:2/6;width:min(1300px,100%);justify-self:center;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:14px}.blueprintHeading{display:flex;justify-content:center;align-items:center;gap:13px}.blueprintHeading>svg{width:42px;height:42px;padding:10px;border-radius:50%;background:#eaf1ff;color:#2563eb}.blueprintHeading small{color:#2563eb;font-weight:900;letter-spacing:.12em}.blueprintHeading h2{margin:2px 0 0;font-size:clamp(25px,2.6vw,40px)}.blueprintHeading p{margin:3px 0 0;color:#667085}.campaignBlueprintGrid{min-height:0;display:grid;grid-template-columns:.82fr 1.18fr;gap:16px}.productInput,.blueprintPlan{background:white;border:1px solid #d7e3f7;border-radius:18px;box-shadow:0 15px 42px rgba(30,64,175,.09)}.productInput{padding:16px;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:8px}.productInput>small,.blueprintPlan span{color:#2563eb;font-size:9px;font-weight:900;letter-spacing:.12em}.productInput img{width:100%;height:100%;min-height:0;object-fit:cover;border-radius:12px}.productInput strong{font-size:20px}.productInput p{margin:0;color:#667085;font-size:11px}.blueprintPlan{padding:17px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.blueprintPlan>div{padding:12px;border-radius:12px;background:#f6f9ff}.blueprintPlan strong{display:block;margin-top:5px;font-size:12px;line-height:1.45}.assetList p{display:flex;align-items:center;gap:6px;margin:6px 0;font-size:10px}.assetList p svg{width:13px;color:#16a34a}.blueprintActions{display:flex;justify-content:flex-end;gap:10px}.blueprintActions button,.workspaceIntro button{min-height:42px;padding:0 16px;border:1px solid #b8c8e4;border-radius:9px;background:white;color:#334155;display:flex;align-items:center;gap:8px}.blueprintActions .approveCampaign{border:0;background:#2563eb;color:white;font-weight:800}.campaignWorkspaceStage{grid-row:2/6;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px}.workspaceIntro{display:flex;align-items:end;justify-content:space-between}.workspaceIntro small{color:#2563eb;font-weight:900;letter-spacing:.12em}.workspaceIntro h2{margin:2px 0;font-size:28px}.workspaceIntro p{margin:0;color:#667085}.campaignOutputBoard{min-height:0;display:grid;grid-template-columns:230px 42px minmax(0,1fr);align-items:center;gap:10px}.sourceProduct{height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:8px;background:white;border:1px solid #d7e3f7;border-radius:16px;padding:12px}.sourceProduct small{color:#2563eb;font-size:9px;font-weight:900}.sourceProduct img{width:100%;height:100%;object-fit:cover;border-radius:11px}.sourceArrow{color:#2563eb}.outputGrid{min-height:0;height:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:10px}.outputTile{min-width:0;min-height:0;border:0;background:transparent;text-align:left;padding:0;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:5px;cursor:pointer}.outputMock{position:relative;min-height:0;border-radius:14px;overflow:hidden;background:#dbeafe;box-shadow:0 10px 28px rgba(30,64,175,.14)}.outputMock img{position:absolute;right:0;bottom:0;width:56%;height:82%;object-fit:cover}.outputMock strong{position:absolute;left:13px;top:42%;width:45%;font-family:Georgia,serif;font-size:clamp(15px,1.3vw,24px);line-height:1.05}.outputMock small{position:absolute;left:13px;bottom:12px;color:#1d4ed8;font-weight:800}.mockBrand{position:absolute;left:13px;top:12px;font-size:9px;font-weight:900;letter-spacing:.13em}.mock-social{background:#f4e8ff}.mock-email{background:#fff4dd}.mock-product{background:#e8f5ff}.mock-banner{background:#e9eefc}.mock-launch{background:#e7f8ef}.outputTile>span{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;color:#334155}.outputTile>span svg{width:14px;color:#2563eb}.outputTile>span svg:last-child{margin-left:auto}.outputTile:hover .outputMock,.outputTile.active .outputMock{outline:2px solid #2563eb;transform:translateY(-2px)}.spin{animation:campaignSpin .8s linear infinite}@keyframes campaignSpin{to{transform:rotate(360deg)}}
      @media(max-width:1050px){.productCampaign{overflow:auto}.campaignInner{height:auto;min-height:100%}.categoryGrid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:220px}.campaignBlueprintGrid{grid-template-columns:1fr}.campaignOutputBoard{grid-template-columns:1fr}.sourceArrow{display:none}.sourceProduct{min-height:320px}.outputGrid{grid-auto-rows:220px}}
      @media(max-width:720px){.productCampaign{height:100dvh;min-height:100dvh;overflow:hidden}.campaignInner{height:100%;padding:10px 12px;grid-template-rows:auto auto auto auto minmax(0,1fr);gap:7px}.campaignHeroHeader h1{font-size:30px}.campaignHeroHeader p{font-size:11px}.campaignComposer{width:100%;min-height:112px;border-radius:18px;padding:11px}.campaignPrompt textarea{font-size:14px}.campaignActions span{display:none}.campaignActions>button:first-child{font-size:10px;padding:0 10px}.campaignFlowStrip{width:100%;display:flex;overflow-x:auto;gap:14px;scrollbar-width:none}.campaignFlowStrip>div{flex:0 0 auto}.campaignFlowStrip>div>svg{display:none}.categoryRow{justify-content:flex-start}.categoryGrid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;scrollbar-width:none}.categoryCard{flex:0 0 88vw;height:100%;scroll-snap-align:start}.campaignBlueprint{grid-row:2/6;gap:9px}.blueprintHeading{justify-content:flex-start}.blueprintHeading p{display:none}.campaignBlueprintGrid{display:block;overflow:auto}.productInput{min-height:360px}.blueprintPlan{margin-top:10px;grid-template-columns:1fr}.blueprintActions{justify-content:stretch}.blueprintActions button{flex:1;justify-content:center}.campaignWorkspaceStage{grid-row:2/6}.workspaceIntro{align-items:start}.workspaceIntro p{display:none}.workspaceIntro button{font-size:10px}.campaignOutputBoard{display:block;overflow:auto}.sourceProduct{height:300px}.outputGrid{margin-top:10px;display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.outputTile{flex:0 0 86vw;height:360px;scroll-snap-align:start}}
      @media(prefers-reduced-motion:reduce){.categoryCard img,.outputMock{transition:none}.spin{animation:none}}
    `}</style>
  </main>;
}
