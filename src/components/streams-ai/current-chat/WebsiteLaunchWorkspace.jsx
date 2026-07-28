"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Globe2, ImagePlus, Link2, LoaderCircle, Paperclip, Rocket, Search, Sparkles, WandSparkles } from "lucide-react";

const IDEAS = [
  ["Business Website", "Build a complete website for my business with services, reviews, lead capture and local SEO."],
  ["Online Store", "Launch an online store with product collections, checkout, shipping and email capture."],
  ["Landing Page", "Create a focused landing page for my offer with strong conversion copy and a lead form."],
  ["Portfolio", "Build a premium portfolio website that presents my work, story and contact options."],
  ["Logo & Brand", "I only need a professional logo and brand identity for my business."],
  ["Find a Domain", "Help me find and register the best available domain for my business."],
  ["Redesign Website", "Redesign my existing website with a modern look, stronger messaging and better performance."],
  ["Launch My Business", "Help me create my brand, domain, website and complete online launch."],
];

const SHOWCASES = [
  ["Coffee shop", "Cozy. Local. Memorable.", "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1000&q=88"],
  ["Law firm", "Trust. Experience. Results.", "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=88"],
  ["Construction", "Built strong. Built right.", "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=88"],
  ["Fitness studio", "Stronger every day.", "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1000&q=88"],
  ["Restaurant", "Good food. Good mood.", "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1000&q=88"],
  ["Ecommerce", "Shop anything, anywhere.", "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1000&q=88"],
];

const DOMAIN_RESULTS = [
  ["yourbusiness.com", "$12.99/yr"],
  ["yourbusiness.co", "$9.99/yr"],
  ["getyourbusiness.com", "$13.99/yr"],
  ["yourbusiness.io", "$34.99/yr"],
];

export default function WebsiteLaunchWorkspace() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [idea, setIdea] = useState("");
  const [stage, setStage] = useState("idea");
  const [domain, setDomain] = useState("yourbusiness.com");
  const [domainBusy, setDomainBusy] = useState(false);
  const [attachment, setAttachment] = useState("");
  const blueprint = useMemo(() => ({
    name: idea.trim().split(/[.!?]/)[0]?.slice(0, 42) || "Your new website",
    pages: ["Home", "About", "Services", "Reviews", "Contact"],
    features: ["Lead capture", "Mobile responsive", "SEO foundation", "Analytics", "Managed hosting"],
  }), [idea]);

  function begin() {
    if (!idea.trim()) return;
    setStage("blueprint");
  }

  function searchDomain() {
    setDomainBusy(true);
    window.setTimeout(() => setDomainBusy(false), 850);
  }

  return <main className="websiteLaunch">
    <section className="websiteHero">
      <div className="websiteHeroShade" />
      <header className="websiteTopbar">
        <div className="websiteBrand"><span>S</span><strong>STREAMS</strong><b>WEBSITE PROJECT</b></div>
        <div className="websiteHost">Hosted by <Sparkles size={15}/><strong>A.S.K. Web Director</strong></div>
        <div className="websitePromise"><span>AI-powered creation</span><span>Launch in minutes</span><span>Edit forever with A.S.K.</span></div>
      </header>

      {stage === "idea" ? <div className="websiteHeroContent">
        <div className="websiteHeroCopy"><h1>Create. Build. <em>Launch.</em></h1><p>Everything you need to build a beautiful website and grow your business.</p></div>
        <div className="websiteComposer">
          <WandSparkles size={28}/><textarea value={idea} onChange={(e)=>setIdea(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();begin();}}} placeholder="What would you like to build today? Describe your business, service, product, or idea…" />
          <div className="websiteComposerActions"><button onClick={()=>fileRef.current?.click()}><Paperclip size={15}/>{attachment || "Attach files or documents"}</button><span>Enter to begin · Shift + Enter for new line</span><button className="websiteGo" onClick={begin} aria-label="Begin website project"><ArrowRight/></button></div>
          <input ref={fileRef} type="file" hidden onChange={(e)=>setAttachment(e.target.files?.[0]?.name || "")}/>
        </div>
      </div> : null}

      {stage === "blueprint" ? <div className="websiteBlueprint">
        <span className="eyebrow">A.S.K. WEBSITE BLUEPRINT</span><h1>{blueprint.name}</h1><p>I’ve translated your idea into a complete launch plan. Review the direction before Streams builds the live website.</p>
        <div className="blueprintColumns"><div><small>PAGES</small>{blueprint.pages.map(x=><span key={x}><Check size={14}/>{x}</span>)}</div><div><small>INCLUDED</small>{blueprint.features.map(x=><span key={x}><Check size={14}/>{x}</span>)}</div></div>
        <div className="blueprintActions"><button onClick={()=>setStage("idea")}>Refine idea</button><button className="primary" onClick={()=>setStage("preview")}><Sparkles size={16}/>Approve and generate website</button></div>
      </div> : null}

      {stage === "preview" ? <div className="websiteGenerated">
        <div className="generatedCopy"><span className="eyebrow">YOUR WEBSITE IS READY TO REVIEW</span><h1>A real first version, built from your conversation.</h1><p>Every section can be refined by asking A.S.K. The next step connects your domain, runs verification and launches with Streams hosting.</p><div><button onClick={()=>router.push("/streams-ai/streams-builder/workspace?project=website")}><Rocket size={16}/>Open website workspace</button><button onClick={()=>setStage("idea")}>Start another</button></div></div>
        <div className="generatedSite"><img src={SHOWCASES[2][2]} alt="Generated business website preview"/><div><b>{blueprint.name}</b><nav>Home · Services · Projects · Contact</nav></div><section><small>BUILT TO CONVERT</small><h2>Quality work. Clear results.</h2><p>A polished, mobile-first website with content, SEO, forms and hosting already planned.</p><button>Request a quote</button></section></div>
      </div> : null}
    </section>

    {stage === "idea" ? <>
      <section className="quickStart"><h2>QUICK START</h2><div>{IDEAS.map(([label,prompt])=><button key={label} onClick={()=>setIdea(prompt)}><Globe2/><span>{label}</span></button>)}</div></section>

      <section className="websiteInspiration"><header><h2>GET INSPIRED — <span>REAL WEBSITES BUILT WITH STREAMS</span></h2><button>View all <ArrowRight size={15}/></button></header><div>{SHOWCASES.map(([name,desc,img])=><button key={name} onClick={()=>setIdea(`Build a premium ${name.toLowerCase()} website with strong branding, mobile design, lead capture and launch support.`)}><img src={img} alt={`${name} website inspiration`}/><strong>{name}</strong><span>{desc}</span></button>)}</div></section>

      <section className="websiteTools">
        <article className="logoStudio"><span className="toolKicker">AI LOGO GENERATOR</span><h2>Create a professional logo and brand identity in seconds.</h2><div className="logoReferences"><img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=900&q=88" alt="Real graphic design desk"/><div><b>Logo variations</b><span>Color palette</span><span>Typography</span><span>Favicon</span><span>Brand guide</span></div></div><button onClick={()=>{setIdea("I only need a professional logo and complete brand identity for my business.");window.scrollTo({top:0,behavior:"smooth"});}}><ImagePlus size={16}/>Generate my logo</button></article>

        <article className="domainStudio"><span className="toolKicker">FIND YOUR PERFECT DOMAIN</span><h2>Search, purchase and connect your business name without leaving Streams.</h2><div className="domainSearch"><input value={domain} onChange={(e)=>setDomain(e.target.value)}/><button onClick={searchDomain}>{domainBusy?<LoaderCircle className="spin"/>:<Search/>}Search</button></div><div className="domainResults">{DOMAIN_RESULTS.map(([name,price])=><button key={name}><span>{name}</span><em>Available</em><small>{price}</small><ArrowRight size={14}/></button>)}</div><div className="domainActions"><button>Register with Streams</button><button>Use an existing domain</button></div></article>

        <article className="launchBenefits"><span className="toolKicker">WHY LAUNCH WITH STREAMS?</span><h2>Your entire website is managed in one place.</h2>{[["Managed hosting","Fast, secure hosting included."],["Continuous support","A.S.K. and the Streams team are always here."],["AI editing included","Ask for changes instead of hiring a developer."],["SSL and backups","Security and protection from day one."],["Global delivery","Fast performance for visitors everywhere."]].map(([a,b])=><div key={a}><Check/><span><strong>{a}</strong><small>{b}</small></span></div>)}<p>One subscription. Website, hosting, updates and support included.</p></article>
      </section>

      <section className="websiteProcess"><h2>HOW IT WORKS</h2><div>{[["Share your idea","Tell A.S.K. about your business."],["Website blueprint","Pages, brand and features are planned."],["Preview and refine","See the real site and request changes."],["Build and optimize","SEO, speed and mobile are verified."],["Launch with Streams","Domain, hosting and support go live."]].map(([a,b],i)=><article key={a}><span>{i+1}</span><strong>{a}</strong><small>{b}</small></article>)}</div></section>
    </> : null}

    <style jsx>{`
      .websiteLaunch{min-height:100svh;background:#f8fbff;color:#081426;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.websiteHero{position:relative;min-height:560px;background:url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=92') center/cover no-repeat;color:white;overflow:hidden}.websiteHeroShade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,12,28,.96) 0%,rgba(2,12,28,.86) 48%,rgba(2,12,28,.18) 100%),linear-gradient(0deg,rgba(2,12,28,.72),transparent 55%)}.websiteTopbar,.websiteHeroContent,.websiteBlueprint,.websiteGenerated{position:relative;z-index:2}.websiteTopbar{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(22px,4vw,66px);gap:18px}.websiteBrand{display:flex;align-items:center;gap:10px;white-space:nowrap}.websiteBrand>span{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#1264ff;font-weight:900;font-style:italic}.websiteBrand strong{font-size:20px;letter-spacing:.15em}.websiteBrand b{color:#4aa3ff}.websiteHost{display:flex;align-items:center;gap:7px}.websitePromise{display:flex;gap:18px;font-size:12px;color:#dbeafe}.websiteHeroContent{width:min(1180px,calc(100% - 48px));margin:58px auto 0}.websiteHeroCopy h1{font-size:clamp(48px,6vw,84px);line-height:.94;letter-spacing:-.055em;margin:0}.websiteHeroCopy h1 em{font-style:normal;color:#3b82f6}.websiteHeroCopy p{font-size:19px;color:#d9e7f8;margin:18px 0 28px}.websiteComposer{width:min(900px,100%);display:grid;grid-template-columns:auto 1fr;gap:18px;padding:22px 22px 14px;border-top:1px solid rgba(96,165,250,.8);border-bottom:1px solid rgba(96,165,250,.5);background:linear-gradient(90deg,rgba(3,17,39,.84),rgba(3,17,39,.62));backdrop-filter:blur(18px)}.websiteComposer textarea{min-height:76px;resize:none;border:0;outline:0;background:transparent;color:white;font:600 20px/1.5 inherit}.websiteComposer textarea::placeholder{color:#d5e2f2}.websiteComposerActions{grid-column:1/-1;display:flex;align-items:center;gap:18px}.websiteComposerActions button{border:0;background:transparent;color:#dbeafe;display:flex;align-items:center;gap:7px}.websiteComposerActions span{margin-left:auto;font-size:12px;color:#a8bad0}.websiteGo{width:46px;height:46px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:#1264ff!important;color:white!important}.quickStart{padding:22px clamp(22px,4vw,66px) 26px;background:white}.quickStart h2,.websiteProcess>h2{text-align:center;font-size:11px;letter-spacing:.12em}.quickStart>div{display:grid;grid-template-columns:repeat(8,1fr);gap:16px}.quickStart button{border:0;background:transparent;display:grid;justify-items:center;gap:9px;padding:12px 4px;color:#0b1a30;cursor:pointer}.quickStart svg{color:#1264ff}.quickStart span{font-size:12px;font-weight:700}.websiteInspiration{padding:20px clamp(22px,4vw,66px) 34px}.websiteInspiration header{display:flex;justify-content:space-between;align-items:center}.websiteInspiration h2{font-size:14px;letter-spacing:.02em}.websiteInspiration h2 span{color:#1264ff}.websiteInspiration header button{border:0;background:none;color:#1264ff;display:flex;align-items:center;gap:5px}.websiteInspiration>div{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.websiteInspiration>div button{border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.websiteInspiration img{width:100%;aspect-ratio:.82;object-fit:cover;display:block;transition:.35s}.websiteInspiration button:hover img{transform:translateY(-5px)}.websiteInspiration strong,.websiteInspiration span{display:block}.websiteInspiration strong{margin-top:9px;text-transform:uppercase;font-size:12px}.websiteInspiration span{font-size:11px;color:#607086}.websiteTools{display:grid;grid-template-columns:1fr 1.08fr 1fr;gap:34px;padding:38px clamp(22px,4vw,66px);background:#071426;color:white}.websiteTools article{min-width:0}.toolKicker{font-size:12px;font-weight:800;color:#60a5fa;letter-spacing:.09em}.websiteTools h2{font-size:21px;line-height:1.25;margin:10px 0 20px}.logoReferences{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}.logoReferences img{width:100%;height:210px;object-fit:cover}.logoReferences div{display:grid;align-content:center;gap:9px}.logoReferences span{font-size:13px;color:#b8c7da}.logoStudio>button,.domainActions button{margin-top:18px;min-height:42px;border:0;background:#1264ff;color:white;padding:0 16px;font-weight:700}.logoStudio>button{display:flex;align-items:center;gap:8px}.domainSearch{display:flex;border-bottom:1px solid #385173}.domainSearch input{flex:1;min-width:0;border:0;background:transparent;color:white;padding:13px 2px;outline:0}.domainSearch button{border:0;background:#1264ff;color:white;padding:0 18px;display:flex;align-items:center;gap:7px}.domainResults{display:grid}.domainResults button{display:grid;grid-template-columns:1fr auto auto auto;gap:12px;align-items:center;border:0;border-bottom:1px solid rgba(148,163,184,.15);background:transparent;color:white;padding:12px 0;text-align:left}.domainResults em{font-style:normal;color:#4ade80}.domainResults small{color:#cbd5e1}.domainActions{display:flex;gap:10px}.domainActions button:last-child{background:transparent;border:1px solid #365477}.launchBenefits>div{display:flex;gap:12px;margin:15px 0}.launchBenefits svg{color:#38bdf8;flex:none}.launchBenefits div span{display:grid}.launchBenefits small{color:#aebdd0;margin-top:3px}.launchBenefits p{margin-top:22px;padding:15px 0;border-top:1px solid #315174;border-bottom:1px solid #315174;color:#8ec5ff}.websiteProcess{padding:30px clamp(22px,4vw,66px) 45px;background:white}.websiteProcess>div{display:grid;grid-template-columns:repeat(5,1fr);gap:22px}.websiteProcess article{display:grid;grid-template-columns:auto 1fr;column-gap:12px}.websiteProcess article>span{grid-row:1/3;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#e8f1ff;color:#1264ff;font-weight:800}.websiteProcess small{color:#64748b;margin-top:4px}.websiteBlueprint{width:min(900px,calc(100% - 48px));margin:95px auto}.eyebrow{font-size:12px;letter-spacing:.16em;color:#60a5fa;font-weight:800}.websiteBlueprint h1,.generatedCopy h1{font-size:clamp(44px,6vw,72px);line-height:1;margin:12px 0}.websiteBlueprint>p,.generatedCopy>p{font-size:18px;color:#c8d7e9;max-width:760px}.blueprintColumns{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin:36px 0}.blueprintColumns>div{display:grid;gap:11px}.blueprintColumns span{display:flex;align-items:center;gap:8px}.blueprintActions,.generatedCopy>div{display:flex;gap:12px}.blueprintActions button,.generatedCopy button{min-height:46px;padding:0 18px;border:1px solid rgba(148,163,184,.4);background:transparent;color:white}.blueprintActions .primary,.generatedCopy button:first-child{background:#1264ff;border-color:#1264ff;display:flex;align-items:center;gap:8px}.websiteGenerated{width:min(1180px,calc(100% - 48px));margin:70px auto;display:grid;grid-template-columns:.8fr 1.2fr;gap:54px;align-items:center}.generatedSite{background:white;color:#081426;box-shadow:0 30px 80px rgba(0,0,0,.35)}.generatedSite>img{width:100%;height:250px;object-fit:cover}.generatedSite>div{display:flex;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e5e7eb}.generatedSite section{padding:30px}.generatedSite h2{font-size:34px;margin:8px 0}.generatedSite section button{background:#1264ff;color:white;border:0;padding:11px 16px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      @media(max-width:900px){.websitePromise{display:none}.websiteHost{font-size:12px}.websiteHero{min-height:620px}.websiteHeroContent{margin-top:50px}.quickStart>div{grid-template-columns:repeat(4,1fr)}.websiteInspiration>div{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.websiteInspiration>div button{min-width:58vw;scroll-snap-align:start}.websiteTools{grid-template-columns:1fr}.websiteProcess>div{grid-template-columns:1fr 1fr}.websiteGenerated{grid-template-columns:1fr}.websiteTopbar{padding:0 18px}.websiteBrand b{display:none}}
      @media(max-width:560px){.websiteHeroContent{width:calc(100% - 28px)}.websiteHeroCopy h1{font-size:46px}.websiteHeroCopy p{font-size:16px}.websiteComposer{grid-template-columns:1fr;padding:18px}.websiteComposer>svg{display:none}.websiteComposerActions{display:grid;grid-template-columns:1fr auto}.websiteComposerActions span{display:none}.quickStart{padding-inline:12px}.quickStart>div{grid-template-columns:repeat(2,1fr)}.websiteInspiration,.websiteTools,.websiteProcess{padding-inline:18px}.websiteProcess>div{grid-template-columns:1fr}.websiteBlueprint,.websiteGenerated{width:calc(100% - 30px);margin-top:55px}.blueprintColumns{grid-template-columns:1fr;gap:24px}.blueprintActions,.generatedCopy>div{flex-direction:column}.websiteHost{display:none}}
    `}</style>
  </main>;
}
