"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Globe2, ImagePlus, LoaderCircle, Paperclip, Rocket, Search, Sparkles, WandSparkles, X } from "lucide-react";

const IDEAS = [
  ["Business Website", "Build a complete website for my business with services, reviews, lead capture and local SEO."],
  ["Online Store", "Launch an online store with product collections, checkout, shipping and email capture."],
  ["Landing Page", "Create a focused landing page for my offer with conversion copy and a lead form."],
  ["Portfolio", "Build a premium portfolio website that presents my work, story and contact options."],
  ["Logo & Brand", "I only need a professional logo and complete brand identity for my business."],
  ["Find a Domain", "Help me find, register and connect the best domain for my business."],
  ["Redesign Website", "Redesign my existing website with a modern look, stronger messaging and better performance."],
  ["Launch My Business", "Help me create my brand, domain, website and complete online launch."],
];

const SHOWCASES = [
  ["Coffee shop", "Cozy. Inviting. Local.", "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1000&q=88"],
  ["Law firm", "Trust. Experience. Results.", "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=88"],
  ["Construction", "Built strong. Built right.", "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=88"],
  ["Fitness studio", "Stronger every day.", "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1000&q=88"],
  ["Restaurant", "Good food. Good mood.", "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1000&q=88"],
  ["Ecommerce", "Shop anything, anywhere.", "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1000&q=88"],
  ["Wellness", "Calm products. Clear ritual.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1000&q=88"],
  ["Real estate", "Exceptional homes, presented beautifully.", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=88"],
];

const STEPS = [
  ["Share your idea", "Tell A.S.K. what your business needs."],
  ["Website blueprint", "Pages, brand, domain and features are planned."],
  ["Preview and refine", "Review a real first version and request changes."],
  ["Build and optimize", "Mobile, SEO, speed and forms are verified."],
  ["Launch with Streams", "Connect the domain, hosting and support."],
];

function cleanDomain(value) {
  return value.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/[^a-z0-9.-]/g, "");
}

function domainOptions(value) {
  const clean = cleanDomain(value) || "yourbusiness.com";
  const stem = clean.split(".")[0] || "yourbusiness";
  return [
    [`${stem}.com`, "$12.99/yr"],
    [`${stem}.co`, "$9.99/yr"],
    [`get${stem}.com`, "$13.99/yr"],
    [`${stem}.io`, "$34.99/yr"],
    [`${stem}.store`, "$7.99/yr"],
  ];
}

export default function WebsiteLaunchWorkspace() {
  const router = useRouter();
  const fileRef = useRef(null);
  const inspirationRef = useRef(null);
  const [idea, setIdea] = useState("");
  const [stage, setStage] = useState("idea");
  const [attachment, setAttachment] = useState("");
  const [domain, setDomain] = useState("yourbusiness.com");
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainResults, setDomainResults] = useState(() => domainOptions("yourbusiness.com"));
  const [selectedDomain, setSelectedDomain] = useState("yourbusiness.com");
  const [notice, setNotice] = useState("");
  const [logoOpen, setLogoOpen] = useState(false);
  const [logoName, setLogoName] = useState("Northland");
  const [logoTagline, setLogoTagline] = useState("Built for what is next");
  const [logoStyle, setLogoStyle] = useState("Editorial");
  const [logoSeed, setLogoSeed] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const blueprint = useMemo(() => ({
    name: idea.trim().split(/[.!?]/)[0]?.replace(/^(build|create|launch|help me)\s+/i, "").slice(0, 48) || "Your new website",
    pages: ["Home", "About", "Services", "Reviews", "Contact"],
    features: ["Logo and brand system", "Domain connection", "Lead capture", "Mobile responsive", "SEO foundation", "Analytics", "Managed hosting"],
  }), [idea]);

  function focusComposer(prompt) {
    setIdea(prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function begin() {
    if (!idea.trim()) {
      setNotice("Describe what you want to build before continuing.");
      return;
    }
    setNotice("");
    setStage("blueprint");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function searchDomain() {
    setDomainBusy(true);
    setNotice("");
    window.setTimeout(() => {
      const results = domainOptions(domain);
      setDomainResults(results);
      setSelectedDomain(results[0][0]);
      setDomainBusy(false);
    }, 550);
  }

  function continueDomain(mode) {
    const detail = { domain: selectedDomain, mode, source: "website-project" };
    window.dispatchEvent(new CustomEvent("streams-ai:domain-checkout-requested", { detail }));
    setNotice(mode === "register" ? `${selectedDomain} selected. Domain checkout will continue inside your Website Project.` : "Existing-domain connection selected. A.S.K. will guide DNS connection during launch.");
    focusComposer(mode === "register" ? `Build my website and register ${selectedDomain} with Streams.` : "Build my website and connect a domain I already own.");
  }

  const visibleShowcases = showAll ? SHOWCASES : SHOWCASES.slice(0, 6);

  return <main className="websiteLaunch">
    <section className="websiteHero">
      <div className="websiteHeroShade" />
      <header className="websiteTopbar">
        <div className="websiteBrand"><span>S</span><strong>STREAMS</strong><b>WEBSITE PROJECT</b></div>
        <div className="websiteHost">Hosted by <Sparkles size={15}/><strong>A.S.K. Web Director</strong></div>
        <div className="websitePromise"><span>AI-powered web creation</span><span>Launch in minutes</span><span>Edit forever with A.S.K.</span></div>
      </header>

      {stage === "idea" && <div className="websiteHeroContent">
        <div className="websiteHeroCopy"><h1>Create. Build. <em>Launch.</em></h1><p>Everything you need to build a beautiful website and grow your business.</p></div>
        <div className="websiteComposer">
          <WandSparkles size={28}/>
          <textarea aria-label="Describe the website you want to build" value={idea} onChange={(event)=>setIdea(event.target.value)} onKeyDown={(event)=>{if(event.key === "Enter" && !event.shiftKey){event.preventDefault();begin();}}} placeholder="What would you like to build today? Describe your business, service, product, or idea…" />
          <div className="websiteComposerActions">
            <button type="button" onClick={()=>fileRef.current?.click()}><Paperclip size={15}/>{attachment || "Attach files or documents"}</button>
            <span>Enter to begin · Shift + Enter for new line</span>
            <button type="button" className="websiteGo" onClick={begin} aria-label="Begin website project"><ArrowRight/></button>
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" hidden onChange={(event)=>setAttachment(event.target.files?.[0]?.name || "")}/>
        </div>
        {notice && <p className="websiteNotice" role="status">{notice}</p>}
      </div>}

      {stage === "blueprint" && <div className="websiteBlueprint">
        <span className="eyebrow">A.S.K. WEBSITE BLUEPRINT</span><h1>{blueprint.name}</h1><p>I translated your idea into a complete launch plan. Review it before Streams creates the live first version.</p>
        <div className="blueprintColumns"><div><small>PAGES</small>{blueprint.pages.map((item)=><span key={item}><Check size={14}/>{item}</span>)}</div><div><small>INCLUDED</small>{blueprint.features.map((item)=><span key={item}><Check size={14}/>{item}</span>)}</div></div>
        <div className="blueprintActions"><button onClick={()=>setStage("idea")}>Refine idea</button><button className="primary" onClick={()=>setStage("preview")}><Sparkles size={16}/>Approve and generate website</button></div>
      </div>}

      {stage === "preview" && <div className="websiteGenerated">
        <div className="generatedCopy"><span className="eyebrow">YOUR WEBSITE IS READY TO REVIEW</span><h1>A real first version, built from your conversation.</h1><p>Every section can be refined by asking A.S.K. Next, Streams connects the domain, runs verification and prepares launch.</p><div><button onClick={()=>router.push("/streams-ai/streams-builder/workspace?project=website")}><Rocket size={16}/>Open website workspace</button><button onClick={()=>setStage("idea")}>Start another</button></div></div>
        <div className="generatedSite"><img src={SHOWCASES[2][2]} alt="Generated construction business website preview"/><div><b>{blueprint.name}</b><nav>Home · Services · Projects · Contact</nav></div><section><small>BUILT TO CONVERT</small><h2>Quality work. Clear results.</h2><p>A polished mobile-first website with content, SEO, forms and hosting already planned.</p><button onClick={()=>setNotice("Quote form selected for the production workspace.")}>Request a quote</button></section></div>
      </div>}
    </section>

    {stage === "idea" && <>
      <section className="quickStart"><h2>QUICK START</h2><div>{IDEAS.map(([label,prompt])=><button key={label} onClick={()=>label === "Logo & Brand" ? setLogoOpen(true) : focusComposer(prompt)}><Globe2/><span>{label}</span></button>)}</div></section>

      <section className="websiteInspiration"><header><h2>GET INSPIRED — <span>REAL WEBSITES BUILT WITH STREAMS</span></h2><button onClick={()=>setShowAll((value)=>!value)}>{showAll ? "Show less" : "View all"} <ArrowRight size={15}/></button></header><div ref={inspirationRef}>{visibleShowcases.map(([name,desc,img])=><button key={name} onClick={()=>focusComposer(`Build a premium ${name.toLowerCase()} website with strong branding, mobile design, lead capture and launch support.`)}><img src={img} alt={`${name} website inspiration`}/><strong>{name}</strong><span>{desc}</span></button>)}</div><div className="mobileGalleryControls"><button onClick={()=>inspirationRef.current?.scrollBy({left:-280,behavior:"smooth"})} aria-label="Previous inspiration"><ChevronLeft/></button><button onClick={()=>inspirationRef.current?.scrollBy({left:280,behavior:"smooth"})} aria-label="Next inspiration"><ChevronRight/></button></div></section>

      <section className="websiteTools">
        <article className="logoStudio"><span className="toolKicker">AI LOGO GENERATOR</span><h2>Create a professional logo and brand identity in seconds.</h2><div className="logoReferences"><img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=900&q=88" alt="Graphic designer working with real printed brand materials"/><div><b>Logo variations</b><span>Color palette</span><span>Typography</span><span>Favicon</span><span>Brand guide</span></div></div><button onClick={()=>setLogoOpen(true)}><ImagePlus size={16}/>Generate my logo</button></article>

        <article className="domainStudio"><span className="toolKicker">FIND YOUR PERFECT DOMAIN</span><h2>Search, select and connect your business name without leaving Streams.</h2><div className="domainSearch"><input aria-label="Domain name" value={domain} onChange={(event)=>setDomain(event.target.value)} onKeyDown={(event)=>{if(event.key === "Enter") searchDomain();}}/><button onClick={searchDomain}>{domainBusy?<LoaderCircle className="spin"/>:<Search/>}Search</button></div><div className="domainResults">{domainResults.map(([name,price])=><button className={selectedDomain === name ? "selected" : ""} key={name} onClick={()=>setSelectedDomain(name)}><span>{name}</span><em>Available</em><small>{price}</small><Check size={14}/></button>)}</div><div className="domainActions"><button onClick={()=>continueDomain("register")}>Register with Streams</button><button onClick={()=>continueDomain("connect")}>Use an existing domain</button></div></article>

        <article className="launchBenefits"><span className="toolKicker">WHY LAUNCH WITH STREAMS?</span><h2>Your entire website is managed in one place.</h2>{[["Managed hosting","Fast, secure hosting included."],["Continuous support","A.S.K. and the Streams team are always here."],["AI editing included","Ask for changes instead of hiring a developer."],["SSL and backups","Security and protection from day one."],["Global delivery","Fast performance for visitors everywhere."]].map(([title,copy])=><div key={title}><Check/><span><strong>{title}</strong><small>{copy}</small></span></div>)}<p>One subscription. Website, hosting, updates and support included.</p></article>
      </section>

      <section className="websiteProcess"><h2>HOW IT WORKS</h2><div>{STEPS.map(([title,copy],index)=><article key={title}><span>{index+1}</span><strong>{title}</strong><small>{copy}</small></article>)}</div></section>
    </>}

    {logoOpen && <div className="logoModal" role="presentation" onMouseDown={(event)=>{if(event.target === event.currentTarget)setLogoOpen(false);}}><section role="dialog" aria-modal="true" aria-label="AI logo generator"><header><div><span>STREAMS LOGO STUDIO</span><h2>Build your first brand direction.</h2></div><button onClick={()=>setLogoOpen(false)} aria-label="Close logo generator"><X/></button></header><div className="logoInputs"><label>Business name<input value={logoName} onChange={(event)=>setLogoName(event.target.value)}/></label><label>Tagline<input value={logoTagline} onChange={(event)=>setLogoTagline(event.target.value)}/></label><label>Direction<select value={logoStyle} onChange={(event)=>setLogoStyle(event.target.value)}><option>Editorial</option><option>Modern</option><option>Heritage</option></select></label></div><div className={`logoConcepts seed${logoSeed%3}`}><button onClick={()=>setLogoStyle("Editorial")}><i>◌</i><strong>{logoName || "Your Brand"}</strong><small>{logoTagline}</small></button><button onClick={()=>setLogoStyle("Modern")}><i>△</i><strong>{(logoName || "YOUR BRAND").toUpperCase()}</strong><small>{logoTagline}</small></button><button onClick={()=>setLogoStyle("Heritage")}><i>✦</i><strong>{logoName || "Your Brand"}</strong><small>EST. 2026</small></button></div><footer><button onClick={()=>setLogoSeed((value)=>value+1)}><Sparkles size={15}/>Generate new directions</button><button className="primary" onClick={()=>{setLogoOpen(false);focusComposer(`Create a complete ${logoStyle.toLowerCase()} logo and brand identity for ${logoName}${logoTagline ? ` with the tagline “${logoTagline}”` : ""}.`);}}>Use this brand direction</button></footer></section></div>}

    <style jsx>{`
      *{box-sizing:border-box}.websiteLaunch{min-height:100svh;background:#f8fbff;color:#081426;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.websiteHero{position:relative;min-height:560px;background:url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=92') center/cover no-repeat;color:white;overflow:hidden}.websiteHeroShade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,12,28,.97),rgba(2,12,28,.86) 52%,rgba(2,12,28,.18)),linear-gradient(0deg,rgba(2,12,28,.72),transparent 60%)}.websiteTopbar,.websiteHeroContent,.websiteBlueprint,.websiteGenerated{position:relative;z-index:2}.websiteTopbar{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(22px,4vw,66px);gap:18px}.websiteBrand{display:flex;align-items:center;gap:10px;white-space:nowrap}.websiteBrand>span{display:grid;place-items:center;width:30px;height:30px;background:#1264ff;font-weight:900;font-style:italic;clip-path:polygon(20% 0,100% 0,78% 42%,100% 42%,80% 100%,0 100%,22% 58%,0 58%)}.websiteBrand strong{font-size:20px;letter-spacing:.15em}.websiteBrand b{color:#4aa3ff}.websiteHost{display:flex;align-items:center;gap:7px}.websitePromise{display:flex;gap:18px;font-size:12px;color:#dbeafe}.websiteHeroContent{width:min(1180px,calc(100% - 48px));margin:56px auto 0}.websiteHeroCopy h1{font-size:clamp(48px,6vw,84px);line-height:.94;letter-spacing:-.055em;margin:0}.websiteHeroCopy h1 em{font-style:normal;color:#3b82f6}.websiteHeroCopy p{font-size:19px;color:#d9e7f8;margin:18px 0 28px}.websiteComposer{width:min(900px,100%);display:grid;grid-template-columns:auto 1fr;gap:18px;padding:22px 22px 14px;border-top:1px solid rgba(96,165,250,.85);border-bottom:1px solid rgba(96,165,250,.55);background:linear-gradient(90deg,rgba(3,17,39,.87),rgba(3,17,39,.62));backdrop-filter:blur(18px)}.websiteComposer textarea{min-height:76px;resize:none;border:0;outline:0;background:transparent;color:white;font:600 20px/1.5 inherit}.websiteComposer textarea::placeholder{color:#d5e2f2}.websiteComposerActions{grid-column:1/-1;display:flex;align-items:center;gap:18px}.websiteComposerActions button{border:0;background:transparent;color:#dbeafe;display:flex;align-items:center;gap:7px;cursor:pointer}.websiteComposerActions span{margin-left:auto;font-size:12px;color:#a8bad0}.websiteGo{width:46px;height:46px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:#1264ff!important;color:white!important}.websiteNotice{width:min(900px,100%);margin:10px 0 0;color:#bfdbfe;font-size:13px}.quickStart{padding:22px clamp(22px,4vw,66px) 26px;background:white}.quickStart h2,.websiteProcess>h2{text-align:center;font-size:11px;letter-spacing:.12em}.quickStart>div{display:grid;grid-template-columns:repeat(8,1fr);gap:16px}.quickStart button{border:0;background:transparent;display:grid;justify-items:center;gap:9px;padding:12px 4px;color:#0b1a30;cursor:pointer}.quickStart svg{color:#1264ff}.quickStart span{font-size:12px;font-weight:700}.websiteInspiration{padding:20px clamp(22px,4vw,66px) 34px}.websiteInspiration header{display:flex;justify-content:space-between;align-items:center}.websiteInspiration h2{font-size:14px}.websiteInspiration h2 span{color:#1264ff}.websiteInspiration header button{border:0;background:none;color:#1264ff;display:flex;align-items:center;gap:5px;cursor:pointer}.websiteInspiration>div:nth-of-type(1){display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.websiteInspiration>div:nth-of-type(1) button{border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.websiteInspiration img{width:100%;aspect-ratio:.82;object-fit:cover;display:block;transition:.35s}.websiteInspiration button:hover img{transform:translateY(-5px)}.websiteInspiration strong,.websiteInspiration span{display:block}.websiteInspiration strong{margin-top:9px;text-transform:uppercase;font-size:12px}.websiteInspiration span{font-size:11px;color:#607086}.mobileGalleryControls{display:none}.websiteTools{display:grid;grid-template-columns:.92fr 1.08fr 1fr;gap:22px;padding:0 clamp(22px,4vw,66px) 38px;background:white}.websiteTools article{padding:24px 0;border-top:1px solid #cbd7e6}.toolKicker{font-size:12px;font-weight:900;letter-spacing:.08em;color:#1264ff}.websiteTools h2{font-size:17px;line-height:1.4;margin:8px 0 18px}.logoReferences{display:grid;grid-template-columns:1.35fr 1fr;gap:16px;align-items:stretch}.logoReferences img{width:100%;height:180px;object-fit:cover}.logoReferences div{display:grid;align-content:center;gap:9px;font-size:12px}.logoStudio>button,.domainActions button{min-height:42px;border:0;background:#1264ff;color:white;padding:0 15px;margin-top:16px;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.domainSearch{display:flex;border-bottom:1px solid #9db1ca}.domainSearch input{min-width:0;flex:1;border:0;background:transparent;padding:13px 4px;outline:none}.domainSearch button{border:0;background:#1264ff;color:white;padding:0 16px;display:flex;align-items:center;gap:6px}.domainResults{display:grid}.domainResults button{display:grid;grid-template-columns:1fr auto auto auto;gap:10px;align-items:center;border:0;border-bottom:1px solid #dce5ef;background:transparent;padding:11px 4px;text-align:left;cursor:pointer}.domainResults button.selected{background:#eef5ff}.domainResults em{font-style:normal;color:#16a34a;font-size:12px}.domainResults small{color:#52647a}.domainActions{display:flex;gap:10px}.domainActions button:last-child{background:transparent;color:#1264ff;border:1px solid #9dbcec}.launchBenefits>div{display:flex;gap:11px;margin:13px 0}.launchBenefits svg{color:#1264ff}.launchBenefits span{display:grid}.launchBenefits small{color:#607086;margin-top:2px}.launchBenefits p{padding:14px 0;border-top:1px solid #bad0ec;color:#125ec6;font-weight:800}.websiteProcess{padding:0 clamp(22px,4vw,66px) 42px;background:white}.websiteProcess>div{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #cbd7e6}.websiteProcess article{display:grid;gap:7px;padding:22px 18px;border-right:1px solid #e3eaf2}.websiteProcess article:last-child{border-right:0}.websiteProcess article>span{color:#1264ff;font-size:12px;font-weight:900}.websiteProcess small{color:#607086}.websiteBlueprint,.websiteGenerated{width:min(1120px,calc(100% - 48px));margin:70px auto 0}.eyebrow{font-size:12px;letter-spacing:.14em;color:#7dd3fc}.websiteBlueprint h1,.generatedCopy h1{font-size:clamp(40px,5vw,70px);line-height:1;margin:12px 0 18px}.websiteBlueprint>p,.generatedCopy>p{max-width:720px;color:#d7e6f7;font-size:17px}.blueprintColumns{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin:34px 0}.blueprintColumns>div{display:grid;gap:10px;border-top:1px solid rgba(147,197,253,.45);padding-top:14px}.blueprintColumns span{display:flex;align-items:center;gap:8px}.blueprintActions,.generatedCopy>div{display:flex;gap:12px}.blueprintActions button,.generatedCopy button{min-height:44px;padding:0 18px;border:1px solid rgba(147,197,253,.55);background:transparent;color:white;display:flex;align-items:center;gap:7px}.blueprintActions .primary,.generatedCopy button:first-child{background:#1264ff;border-color:#1264ff}.websiteGenerated{display:grid;grid-template-columns:.9fr 1.1fr;gap:48px;align-items:center}.generatedSite{position:relative;min-height:430px;background:#fff;color:#0b1a30;box-shadow:0 24px 80px rgba(0,0,0,.35);overflow:hidden}.generatedSite>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.generatedSite:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,12,26,.92),rgba(3,12,26,.15))}.generatedSite>div,.generatedSite>section{position:relative;z-index:2;color:white}.generatedSite>div{display:flex;justify-content:space-between;padding:20px}.generatedSite>section{width:65%;padding:70px 28px}.generatedSite h2{font-size:38px;margin:8px 0}.generatedSite button{border:0;background:white;color:#0b1a30;padding:12px 16px}.logoModal{position:fixed;inset:0;z-index:70000;display:grid;place-items:center;padding:18px;background:rgba(1,7,18,.86);backdrop-filter:blur(14px)}.logoModal>section{width:min(920px,100%);max-height:calc(100svh - 36px);overflow:auto;background:#f8fbff;color:#081426;padding:24px}.logoModal header,.logoModal footer{display:flex;align-items:center;justify-content:space-between;gap:16px}.logoModal header span{font-size:11px;letter-spacing:.12em;color:#1264ff}.logoModal header h2{margin:5px 0;font-size:28px}.logoModal header button{border:0;background:none}.logoInputs{display:grid;grid-template-columns:1fr 1fr .7fr;gap:14px;margin:22px 0}.logoInputs label{display:grid;gap:6px;font-size:12px;font-weight:800}.logoInputs input,.logoInputs select{height:42px;border:0;border-bottom:1px solid #9db1ca;background:transparent}.logoConcepts{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.logoConcepts button{min-height:210px;border:0;background:white;display:grid;place-items:center;align-content:center;gap:8px;box-shadow:0 12px 40px rgba(17,49,89,.08)}.logoConcepts i{font-size:42px;color:#1264ff}.logoConcepts strong{font-size:25px}.logoConcepts small{letter-spacing:.12em}.logoConcepts.seed1 button:nth-child(1),.logoConcepts.seed2 button:nth-child(2){background:#06152a;color:white}.logoConcepts.seed1 button:nth-child(2),.logoConcepts.seed2 button:nth-child(3){background:#efe6d8}.logoModal footer{margin-top:18px;justify-content:flex-end}.logoModal footer button{min-height:42px;padding:0 16px;border:1px solid #9dbcec;background:transparent;color:#1264ff;display:flex;align-items:center;gap:7px}.logoModal footer .primary{background:#1264ff;color:white;border-color:#1264ff}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      @media(max-width:900px){.websitePromise{display:none}.websiteHero{min-height:620px}.websiteHeroContent{margin-top:50px}.quickStart>div{grid-template-columns:repeat(4,1fr)}.websiteInspiration>div:nth-of-type(1){display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}.websiteInspiration>div:nth-of-type(1)::-webkit-scrollbar{display:none}.websiteInspiration>div:nth-of-type(1) button{min-width:42vw;scroll-snap-align:start}.websiteTools{grid-template-columns:1fr}.websiteProcess>div{grid-template-columns:1fr 1fr}.websiteGenerated{grid-template-columns:1fr}.websiteTopbar{padding:0 18px}.websiteBrand b{display:none}.mobileGalleryControls{display:flex!important;justify-content:flex-end;gap:8px;margin-top:12px}.mobileGalleryControls button{width:38px;height:38px;border:0;background:#1264ff;color:white;display:grid;place-items:center}.logoInputs{grid-template-columns:1fr}.logoConcepts{grid-template-columns:1fr 1fr}.logoConcepts button:last-child{grid-column:1/-1}}
      @media(max-width:560px){.websiteTopbar{height:60px}.websiteBrand strong{font-size:16px}.websiteHero{min-height:650px}.websiteHeroContent{width:calc(100% - 28px);margin-top:42px}.websiteHeroCopy h1{font-size:47px}.websiteHeroCopy p{font-size:16px;line-height:1.45}.websiteComposer{grid-template-columns:1fr;padding:18px}.websiteComposer>svg{display:none}.websiteComposer textarea{font-size:17px;min-height:110px}.websiteComposerActions{display:grid;grid-template-columns:1fr auto}.websiteComposerActions span{display:none}.quickStart{padding:17px 12px}.quickStart>div{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:4px}.quickStart button{min-width:108px;scroll-snap-align:start}.websiteInspiration,.websiteTools,.websiteProcess{padding-inline:18px}.websiteInspiration header{align-items:flex-start;gap:10px}.websiteInspiration h2{line-height:1.35}.websiteInspiration>div:nth-of-type(1) button{min-width:76vw}.websiteTools{gap:0}.websiteTools article{padding:24px 0}.logoReferences{grid-template-columns:1fr}.logoReferences img{height:220px}.domainActions{display:grid}.websiteProcess>div{grid-template-columns:1fr}.websiteProcess article{border-right:0;border-bottom:1px solid #e3eaf2;grid-template-columns:auto 1fr;align-items:start}.websiteProcess article small{grid-column:2}.websiteBlueprint,.websiteGenerated{width:calc(100% - 30px);margin-top:48px}.blueprintColumns{grid-template-columns:1fr;gap:24px}.blueprintActions,.generatedCopy>div{flex-direction:column}.websiteHost{display:none}.generatedSite{min-height:470px}.generatedSite>div nav{display:none}.generatedSite>section{width:88%;padding:90px 20px}.generatedSite h2{font-size:34px}.logoModal{padding:0}.logoModal>section{min-height:100svh;max-height:100svh;padding:18px}.logoConcepts{grid-template-columns:1fr}.logoConcepts button:last-child{grid-column:auto}.logoModal footer{display:grid}.logoModal footer button{justify-content:center}}
    `}</style>
  </main>;
}
