"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Code2, Globe2, ImagePlus, LoaderCircle, LockKeyhole, Mail, Paperclip, RefreshCw, Rocket, Search, ShieldCheck, Smartphone, Sparkles, WandSparkles, X, Zap } from "lucide-react";

const IDEAS = [
  ["Business Website", "Build a complete website for my business with services, reviews, lead capture and local SEO."],
  ["Online Store", "Launch an online store with product collections, checkout, shipping and email capture."],
  ["Landing Page", "Create a focused landing page for my offer with strong conversion copy and a lead form."],
  ["Portfolio", "Build a premium portfolio website that presents my work, story and contact options."],
  ["Logo & Brand", "I only need a professional logo and complete brand identity for my business."],
  ["Find a Domain", "Help me find, register and connect the best domain for my business."],
  ["Redesign Website", "Redesign my current website with stronger design, messaging and performance."],
  ["Launch My Business", "Help me create my logo, domain, website and full online launch."],
];

const SHOWCASES = [
  ["Coffee Shop", "Cozy. Inviting. Local.", "Great Coffee\nGreat Day", "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=88"],
  ["Law Firm", "Trust. Experience. Results.", "Your Case.\nOur Mission.", "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=88"],
  ["Construction", "Built Strong. Built Right.", "Building\nBetter\nSpaces", "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=88"],
  ["Fitness Studio", "Stronger Every Day.", "Train Hard\nLive Strong", "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=88"],
  ["Restaurant", "Good Food. Good Mood.", "Delicious Food\nMade Fresh", "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=88"],
  ["Ecommerce Store", "Shop. Anything. Anywhere.", "New Collection\nNow Live", "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=88"],
];

const STEPS = [
  ["Share Your Idea", "Tell A.S.K. about your business or what you want to build."],
  ["Website Blueprint", "A.S.K. creates your site plan, logo, pages and features."],
  ["Preview & Refine", "Review your live site preview and ask for changes."],
  ["Build & Optimize", "We build, optimize for SEO, speed and all devices."],
  ["Launch with Streams", "Go live with domain, hosting and full support."],
];

const BENEFITS = [
  [Globe2, "Free Managed Hosting", "Fast, secure, and reliable hosting included."],
  [RefreshCw, "Free Continuous Support", "Our team and A.S.K. are always here."],
  [WandSparkles, "Free AI Editing Forever", "Make any change by asking A.S.K."],
  [LockKeyhole, "SSL Certificate Included", "Your site is secured from day one."],
  [ShieldCheck, "Automatic Backups", "We protect your site every day."],
  [Globe2, "Global CDN", "Lightning fast for visitors worldwide."],
];

const FEATURES = [
  [Smartphone, "Mobile Responsive", "Looks perfect on all devices, automatically."],
  [Search, "SEO Optimized", "Built-in SEO tools to rank higher on Google."],
  [Zap, "Lightning Fast", "Optimized performance for the best experience."],
  [Mail, "Lead & Form Ready", "Capture leads and manage inquiries easily."],
  [BarChart3, "Analytics Included", "Track visitors and grow your business."],
  [RefreshCw, "Always Up to Date", "We handle updates so you stay worry-free."],
];

function cleanDomain(value) {
  return value.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/[^a-z0-9.-]/g, "");
}

function domainOptions(value) {
  const clean = cleanDomain(value) || "yourbusiness.com";
  const stem = clean.split(".")[0] || "yourbusiness";
  return [[`${stem}.com`, "$12.99/yr"], [`${stem}.co`, "$9.99/yr"], [`get${stem}.com`, "$13.99/yr"], [`${stem}.io`, "$34.99/yr"], [`${stem}.store`, "$7.99/yr"]];
}

export default function WebsiteLaunchWorkspace() {
  const router = useRouter();
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const [idea, setIdea] = useState("");
  const [stage, setStage] = useState("idea");
  const [attachment, setAttachment] = useState("");
  const [domain, setDomain] = useState("yourbusiness.com");
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainResults, setDomainResults] = useState(() => domainOptions("yourbusiness.com"));
  const [selectedDomain, setSelectedDomain] = useState("yourbusiness.com");
  const [logoOpen, setLogoOpen] = useState(false);
  const [logoName, setLogoName] = useState("Northland");
  const [logoTagline, setLogoTagline] = useState("Built for what is next");
  const [logoStyle, setLogoStyle] = useState("Modern");
  const [logoSeed, setLogoSeed] = useState(0);
  const [notice, setNotice] = useState("");

  const blueprint = useMemo(() => ({
    name: idea.trim().split(/[.!?]/)[0]?.replace(/^(build|create|launch|help me)\s+/i, "").slice(0, 50) || "Your new website",
    pages: ["Home", "About", "Services", "Reviews", "Contact"],
    features: ["Logo & brand", "Domain connection", "Lead capture", "SEO", "Analytics", "Managed hosting"],
  }), [idea]);

  function focusComposer(prompt) {
    setIdea(prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function begin() {
    if (!idea.trim()) return setNotice("Describe what you want to build before continuing.");
    setNotice("");
    setStage("blueprint");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function searchDomain() {
    setDomainBusy(true);
    setTimeout(() => {
      const results = domainOptions(domain);
      setDomainResults(results);
      setSelectedDomain(results[0][0]);
      setDomainBusy(false);
    }, 450);
  }

  function continueDomain(mode) {
    const prompt = mode === "register" ? `Build my website and register ${selectedDomain} with Streams.` : "Build my website and connect a domain I already own.";
    window.dispatchEvent(new CustomEvent("streams-ai:domain-checkout-requested", { detail: { domain: selectedDomain, mode, source: "website-project" } }));
    focusComposer(prompt);
  }

  return <main className="websiteLaunch">
    <section className="websiteHero">
      <div className="heroGrid" />
      <header className="websiteTopbar">
        <div className="websiteBrand"><span>S</span><strong>STREAMS</strong><b>WEBSITE PROJECT</b></div>
        <div className="websiteHost">Hosted by <Sparkles size={15}/><strong>A.S.K. Web Director</strong></div>
        <div className="websitePromise"><span><WandSparkles/>AI-Powered<br/>Web Creation</span><span><Clock3/>Launch<br/>in Minutes</span><span><Sparkles/>Edit Forever<br/>with A.S.K.</span></div>
      </header>

      {stage === "idea" && <div className="websiteHeroContent">
        <h1>Create. Build. <em>Launch.</em></h1>
        <p>Everything you need to build a beautiful website and grow your business.</p>
        <div className="websiteComposer">
          <div className="composerMain"><Code2/><textarea aria-label="Describe what you want to build" value={idea} onChange={(e)=>setIdea(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();begin();}}} placeholder="What would you like to build today?\nDescribe your business, service, product, or idea..."/></div>
          <div className="composerBottom"><button onClick={()=>fileRef.current?.click()}><Paperclip/>{attachment || "Attach files or documents"}</button><span>Enter to begin · Shift + Enter for new line</span><button className="go" onClick={begin}><ArrowRight/></button></div>
          <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.doc,.docx,.txt" onChange={(e)=>setAttachment(e.target.files?.[0]?.name || "")}/>
        </div>
        {notice && <small className="notice">{notice}</small>}
      </div>}

      {stage === "blueprint" && <div className="stagePanel"><span>A.S.K. WEBSITE BLUEPRINT</span><h1>{blueprint.name}</h1><p>I translated your idea into a complete website and launch plan.</p><div className="blueprintGrid"><div><small>PAGES</small>{blueprint.pages.map(x=><b key={x}><Check/>{x}</b>)}</div><div><small>INCLUDED</small>{blueprint.features.map(x=><b key={x}><Check/>{x}</b>)}</div></div><footer><button onClick={()=>setStage("idea")}>Refine idea</button><button className="primary" onClick={()=>setStage("preview")}><Sparkles/>Approve and generate website</button></footer></div>}

      {stage === "preview" && <div className="previewStage"><div><span>YOUR WEBSITE IS READY TO REVIEW</span><h1>A real first version, built from your conversation.</h1><p>Every section can be refined by asking A.S.K. Next, Streams connects your domain and prepares launch.</p><footer><button className="primary" onClick={()=>router.push("/streams-ai/streams-builder/workspace?project=website")}><Rocket/>Open website workspace</button><button onClick={()=>setStage("idea")}>Start another</button></footer></div><div className="sitePreview"><img src={SHOWCASES[2][3]} alt="Generated website preview"/><header><b>{blueprint.name}</b><span>Home · Services · Projects · Contact</span></header><section><small>BUILT TO CONVERT</small><h2>Quality work. Clear results.</h2><button>Request a quote</button></section></div></div>}
    </section>

    {stage === "idea" && <>
      <section className="quickStart"><h2>QUICK START</h2><div>{IDEAS.map(([label,prompt])=><button key={label} onClick={()=>label==="Logo & Brand"?setLogoOpen(true):focusComposer(prompt)}><Globe2/><span>{label}</span></button>)}</div></section>

      <section className="inspiration"><header><h2>GET INSPIRED — <span>REAL WEBSITES BUILT WITH STREAMS</span></h2><button onClick={()=>galleryRef.current?.scrollBy({left:320,behavior:"smooth"})}>View all <ArrowRight/></button></header><div ref={galleryRef}>{SHOWCASES.map(([name,desc,headline,img])=><button key={name} onClick={()=>focusComposer(`Build a premium ${name.toLowerCase()} website with strong branding, mobile design, lead capture and launch support.`)}><div className="browser"><i/><i/><i/><span/><img src={img} alt={`${name} website inspiration`}/><h3>{headline.split("\n").map((line,i)=><b key={i}>{line}</b>)}</h3><em>{name==="Coffee Shop"?"Order Now":name==="Law Firm"?"Learn More":name==="Construction"?"Our Services":name==="Fitness Studio"?"Get Started":name==="Restaurant"?"View Menu":"Shop Now"}</em></div><strong>{name}</strong><small>{desc}</small></button>)}</div><nav><button onClick={()=>galleryRef.current?.scrollBy({left:-300,behavior:"smooth"})}><ChevronLeft/></button><button onClick={()=>galleryRef.current?.scrollBy({left:300,behavior:"smooth"})}><ChevronRight/></button></nav></section>

      <section className="toolRow">
        <article className="logoTool"><h2>AI LOGO GENERATOR</h2><p>Create a professional logo and brand identity in seconds.</p><div className="logoGrid">{[["Leaf & Bloom","✧"],["Elevate","△"],["Northland","⌂"],["Core","○"],["Wave","≈"],["Spark","✦"]].map(([name,mark],i)=><button key={name} className={`logo${i}`} onClick={()=>setLogoOpen(true)}><i>{mark}</i><b>{name}</b><small>{i===1?"FITNESS":i===2?"CONSTRUCTION":i===4?"STUDIO":"CREATIVE"}</small></button>)}</div><div className="brandKit"><strong>Brand Kit Includes:</strong><span>✓ Logo Variations</span><span>✓ Typography</span><span>✓ Favicon</span><span>✓ Color Palette</span><span>✓ Brand Guide</span></div><button className="primary" onClick={()=>setLogoOpen(true)}>Generate My Logo <WandSparkles/></button></article>

        <article className="domainTool"><h2>FIND YOUR PERFECT DOMAIN</h2><p>Search for the perfect domain name for your business.</p><div className="domainSearch"><input value={domain} onChange={(e)=>setDomain(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")searchDomain();}}/><button onClick={searchDomain}>{domainBusy?<LoaderCircle className="spin"/>:<Search/>}Search</button></div><div className="domainResults">{domainResults.map(([name,price])=><button key={name} className={selectedDomain===name?"selected":""} onClick={()=>setSelectedDomain(name)}><span>{name}</span><em>Available</em><small>{price}</small><b>⌑</b></button>)}</div><footer><button className="primary" onClick={()=>continueDomain("register")}>Register with Streams</button><button onClick={()=>continueDomain("connect")}>I’ll Use My Existing Domain</button></footer></article>

        <article className="benefits"><h2>WHY LAUNCH WITH STREAMS?</h2>{BENEFITS.map(([Icon,title,copy])=><div key={title}><Icon/><span><strong>{title}</strong><small>{copy}</small></span></div>)}<p><ShieldCheck/> <span><strong>One Subscription. Everything Included.</strong><small>No hidden fees. No developer needed.</small></span></p></article>
      </section>

      <section className="process"><h2>HOW IT WORKS</h2><div>{STEPS.map(([title,copy],i)=><article key={title}><span>{i+1}</span><strong>{title}</strong><small>{copy}</small>{i<4&&<ArrowRight/>}</article>)}</div></section>

      <section className="features">{FEATURES.map(([Icon,title,copy])=><article key={title}><Icon/><div><strong>{title}</strong><small>{copy}</small></div></article>)}</section>

      <section className="success"><article><ShieldCheck/><div><strong>Your Success is Our Mission</strong><p>We don’t just build websites. We launch businesses. With Streams, you’ll never need developers, designers or technicians again.</p></div></article><article><b>1,247+</b><span>Websites Launched<br/>with Streams</span></article><article><div className="faces"><img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"/><img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80"/><img src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80"/></div><b>★★★★★ 4.9/5</b><small>from 1,000+ happy customers</small></article><article><div><strong>Ready to Build <em>Something Amazing?</em></strong><small>Start your website, logo, domain and brand today.</small><button className="primary" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>Start Building with A.S.K. <ArrowRight/></button></div><img src="https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=400&q=80" alt="Friendly technology assistant"/></article></section>

      <footer className="trust"><span><ShieldCheck/>30-Day Money Back Guarantee</span><span><Clock3/>99.9% Uptime Guarantee</span><span><LockKeyhole/>Secure & Trusted Platform</span><span><X/>Cancel Anytime</span></footer>
    </>}

    {logoOpen && <div className="logoModal" onMouseDown={(e)=>{if(e.target===e.currentTarget)setLogoOpen(false)}}><section><header><div><span>STREAMS LOGO STUDIO</span><h2>Build your first brand direction.</h2></div><button onClick={()=>setLogoOpen(false)}><X/></button></header><div className="logoInputs"><label>Business name<input value={logoName} onChange={(e)=>setLogoName(e.target.value)}/></label><label>Tagline<input value={logoTagline} onChange={(e)=>setLogoTagline(e.target.value)}/></label><label>Direction<select value={logoStyle} onChange={(e)=>setLogoStyle(e.target.value)}><option>Modern</option><option>Editorial</option><option>Heritage</option></select></label></div><div className={`logoConcepts seed${logoSeed%3}`}><button><i>◌</i><strong>{logoName}</strong><small>{logoTagline}</small></button><button><i>△</i><strong>{logoName.toUpperCase()}</strong><small>{logoTagline}</small></button><button><i>✦</i><strong>{logoName}</strong><small>EST. 2026</small></button></div><footer><button onClick={()=>setLogoSeed(v=>v+1)}><Sparkles/>Generate new directions</button><button className="primary" onClick={()=>{setLogoOpen(false);focusComposer(`Create a complete ${logoStyle.toLowerCase()} logo and brand identity for ${logoName}${logoTagline?` with the tagline “${logoTagline}”`:""}.`)}}>Use this brand direction</button></footer></section></div>}

    <style jsx>{`
      *{box-sizing:border-box}.websiteLaunch{min-height:100svh;background:#020b19;color:#eef6ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.websiteHero{position:relative;min-height:438px;padding-bottom:24px;background:radial-gradient(circle at 82% 18%,rgba(0,84,255,.18),transparent 26%),linear-gradient(180deg,#020916,#031123);overflow:hidden}.heroGrid{position:absolute;inset:0;background-image:linear-gradient(rgba(31,111,235,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(31,111,235,.045) 1px,transparent 1px);background-size:58px 58px;mask-image:linear-gradient(to bottom,transparent,#000 40%,transparent)}.websiteTopbar{position:relative;z-index:2;height:62px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 28px;gap:20px}.websiteBrand{display:flex;align-items:center;gap:9px}.websiteBrand>span{display:grid;place-items:center;width:26px;height:28px;background:#1264ff;font-weight:900;font-style:italic;clip-path:polygon(18% 0,100% 0,78% 44%,100% 44%,82% 100%,0 100%,22% 56%,0 56%)}.websiteBrand strong{font-size:17px;letter-spacing:.16em}.websiteBrand b{color:#2582ff;font-size:13px}.websiteHost{display:flex;align-items:center;gap:7px;padding:9px 14px;border:1px solid #16457d;border-radius:10px;font-size:13px}.websitePromise{justify-self:end;display:flex;gap:20px}.websitePromise span{display:flex;align-items:center;gap:7px;font-size:10px;line-height:1.2}.websitePromise svg{width:18px;color:#2e8cff}.websiteHeroContent{position:relative;z-index:2;width:min(960px,calc(100% - 44px));margin:20px auto 0}.websiteHeroContent>h1{margin:0;font-size:clamp(44px,5vw,64px);line-height:1;letter-spacing:-.055em}.websiteHeroContent>h1 em{font-style:normal;color:#176df3}.websiteHeroContent>p{margin:10px 0 18px;color:#d2dceb;font-size:15px}.websiteComposer{border:1px solid #1373db;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,rgba(6,22,45,.98),rgba(4,17,35,.95));box-shadow:0 20px 60px rgba(0,0,0,.28)}.composerMain{display:grid;grid-template-columns:auto 1fr;gap:16px;padding:17px 20px}.composerMain svg{width:35px;height:35px;padding:8px;border:1px solid #174b80;border-radius:50%;color:white}.composerMain textarea{min-height:54px;resize:none;border:0;outline:0;background:transparent;color:white;font:600 15px/1.45 inherit}.composerMain textarea::placeholder{color:#d8e3f2}.composerBottom{min-height:48px;display:flex;align-items:center;gap:14px;padding:8px 14px;border-top:1px solid rgba(45,116,195,.35)}.composerBottom button{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:#dbeafe}.composerBottom button:first-child{padding:8px 10px;border:1px solid #244f7e;border-radius:8px}.composerBottom span{margin-left:auto;font-size:10px;color:#aab9cc}.composerBottom .go{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#1264ff;color:white}.notice{display:block;margin-top:8px;color:#9ec9ff}.quickStart{padding:10px 32px 14px;background:#061224;border-top:1px solid #17365e}.quickStart h2,.process h2{text-align:center;font-size:9px;letter-spacing:.12em;color:#9fc7f3}.quickStart>div{display:grid;grid-template-columns:repeat(8,1fr);gap:10px}.quickStart button{min-height:62px;display:grid;justify-items:center;align-content:center;gap:7px;border:1px solid #173c68;border-radius:9px;background:linear-gradient(180deg,#0a1b31,#081527);color:white}.quickStart button:hover{transform:translateY(-2px);border-color:#2582ff}.quickStart svg{width:26px;color:#2582ff}.quickStart span{font-size:10px;font-weight:700}.inspiration{padding:14px 22px;background:#061224}.inspiration header{display:flex;align-items:center;justify-content:space-between}.inspiration h2{font-size:11px}.inspiration h2 span{color:#3ba1ff}.inspiration header button{border:0;background:none;color:#a9caee;display:flex;gap:4px;align-items:center;font-size:9px}.inspiration>div{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.inspiration>div>button{border:0;background:transparent;color:white;text-align:left;padding:0}.browser{position:relative;aspect-ratio:.76;border:1px solid #2b527a;border-radius:7px;overflow:hidden;background:#0a1525}.browser>i{position:absolute;z-index:3;top:6px;width:4px;height:4px;border-radius:50%;background:#ef4444}.browser>i:nth-child(1){left:8px}.browser>i:nth-child(2){left:15px;background:#eab308}.browser>i:nth-child(3){left:22px;background:#22c55e}.browser>span{position:absolute;z-index:2;top:0;left:0;right:0;height:16px;background:rgba(227,236,245,.15)}.browser img{width:100%;height:100%;object-fit:cover;filter:brightness(.72)}.browser h3{position:absolute;left:10px;top:29%;margin:0;font-size:15px;line-height:1.02}.browser h3 b{display:block}.browser em{position:absolute;left:10px;top:53%;padding:4px 7px;border-radius:8px;background:#e6d9c4;color:#101827;font-size:7px;font-style:normal}.inspiration>div>button>strong,.inspiration>div>button>small{display:block}.inspiration>div>button>strong{margin:6px 4px 1px;font-size:9px;text-transform:uppercase}.inspiration>div>button>small{margin:0 4px;color:#8fa5bf;font-size:8px}.inspiration nav{display:none}.toolRow{display:grid;grid-template-columns:.95fr 1.08fr 1fr;gap:12px;padding:0 22px 12px;background:#061224}.toolRow article{min-width:0;padding:14px 12px;border:1px solid #173d67;border-radius:10px;background:linear-gradient(145deg,#081a30,#061426)}.toolRow h2{margin:0;font-size:13px}.toolRow p{margin:5px 0 10px;color:#aabbd0;font-size:9px;line-height:1.35}.logoGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.logoGrid button{min-height:62px;display:grid;place-items:center;align-content:center;border:1px solid #254565;border-radius:6px;background:#f3f1ec;color:#0c1727}.logoGrid .logo1,.logoGrid .logo4{background:#081221;color:white}.logoGrid i{font-size:19px;font-style:normal}.logoGrid b{font-size:9px;text-transform:uppercase}.logoGrid small{font-size:5px;letter-spacing:.1em}.brandKit{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:8px 0;padding:8px;border:1px solid #183c63;border-radius:7px}.brandKit strong{grid-column:1/-1;font-size:8px}.brandKit span{font-size:6px;color:#b5c6da}.primary{border:0!important;background:#1264ff!important;color:white!important}.logoTool>.primary{width:100%;min-height:30px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:5px;font-size:9px}.domainSearch{display:flex;border:1px solid #1b4e84;border-radius:6px;overflow:hidden}.domainSearch input{min-width:0;flex:1;border:0;background:#07182c;color:white;padding:8px 9px;outline:0;font-size:9px}.domainSearch button{border:0;background:#1264ff;color:white;display:flex;align-items:center;gap:4px;padding:0 10px;font-size:8px}.domainResults{display:grid;margin-top:7px}.domainResults button{display:grid;grid-template-columns:1fr auto auto auto;gap:6px;align-items:center;padding:7px 3px;border:0;border-bottom:1px solid #183b61;background:transparent;color:white;text-align:left;font-size:8px}.domainResults button.selected{background:#0d2746}.domainResults em{color:#21df67;font-style:normal}.domainResults small{color:#d0d7e1}.domainTool footer{display:flex;gap:7px;margin-top:9px}.domainTool footer button{min-height:30px;padding:0 9px;border:1px solid #20548c;border-radius:4px;background:transparent;color:white;font-size:8px}.benefits>div{display:flex;gap:8px;margin:8px 0}.benefits svg{width:18px;color:#1d8bff}.benefits span{display:grid}.benefits strong{font-size:9px}.benefits small{font-size:7px;color:#9fb0c4}.benefits>p{display:flex;gap:8px;padding:8px;border:1px solid #1d5aa0;border-radius:7px;color:#72b8ff}.benefits>p span{display:grid}.process{padding:0 22px 10px;background:#061224}.process>div{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid #183d66;border-radius:9px;overflow:hidden}.process article{position:relative;display:grid;grid-template-columns:auto 1fr;gap:3px 8px;padding:12px;border-right:1px solid #183d66}.process article:last-child{border-right:0}.process article>span{grid-row:1/3;width:28px;height:28px;display:grid;place-items:center;border:1px solid #2582ff;border-radius:50%;color:#3ba1ff;font-size:9px}.process strong{font-size:9px}.process small{font-size:7px;color:#9fb0c4}.process article>svg{position:absolute;right:-8px;top:50%;z-index:2;width:14px;color:#6d88a5}.features{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:0 22px 12px;background:#061224}.features article{display:flex;gap:8px;align-items:flex-start;padding:11px 9px;border:1px solid #173d67;border-radius:8px;background:#07172a}.features svg{width:24px;color:#2582ff}.features div{display:grid}.features strong{font-size:8px}.features small{font-size:6px;color:#9fb0c4}.success{display:grid;grid-template-columns:1.4fr .65fr .9fr 1.45fr;margin:0 22px 10px;border:1px solid #173d67;border-radius:9px;overflow:hidden;background:#07172a}.success>article{min-height:84px;display:flex;gap:10px;align-items:center;padding:12px;border-right:1px solid #173d67}.success>article:last-child{border-right:0}.success svg{width:42px;color:#2582ff}.success strong{font-size:9px}.success p,.success span,.success small{font-size:7px;color:#aab9cc}.success>article:nth-child(2){display:grid;align-content:center}.success>article:nth-child(2)>b{font-size:20px}.success>article:nth-child(3){display:grid;align-content:center}.faces{display:flex}.faces img{width:24px;height:24px;object-fit:cover;border-radius:50%;border:2px solid #07172a;margin-left:-4px}.success>article:last-child{justify-content:space-between}.success>article:last-child div{display:grid;gap:5px}.success>article:last-child strong{font-size:11px}.success>article:last-child em{color:#39a3ff;font-style:normal}.success>article:last-child button{min-height:30px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:4px;font-size:8px}.success>article:last-child>img{width:64px;height:64px;object-fit:cover;border-radius:50%}.trust{display:flex;justify-content:space-around;padding:3px 22px 12px;background:#061224;color:#aab9cc;font-size:7px}.trust span{display:flex;align-items:center;gap:5px}.trust svg{width:12px;color:#2acbd2}.stagePanel,.previewStage{position:relative;z-index:2;width:min(960px,calc(100% - 40px));margin:45px auto}.stagePanel>span,.previewStage>div>span{font-size:10px;letter-spacing:.12em;color:#5eb5ff}.stagePanel h1,.previewStage h1{font-size:44px;margin:8px 0}.stagePanel>p,.previewStage p{color:#b8c9dc}.blueprintGrid{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:24px 0}.blueprintGrid>div{display:grid;gap:7px;padding-top:10px;border-top:1px solid #24558a}.blueprintGrid b{display:flex;align-items:center;gap:7px;font-size:11px}.blueprintGrid svg{width:14px;color:#3ba1ff}.stagePanel footer,.previewStage footer{display:flex;gap:10px}.stagePanel footer button,.previewStage footer button{min-height:38px;padding:0 14px;border:1px solid #2b5d93;background:transparent;color:white}.previewStage{display:grid;grid-template-columns:.9fr 1.1fr;gap:30px;align-items:center}.sitePreview{position:relative;min-height:300px;overflow:hidden;border:8px solid white;background:white;color:white;box-shadow:0 20px 70px rgba(0,0,0,.4)}.sitePreview:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,12,26,.92),rgba(2,12,26,.1))}.sitePreview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.sitePreview header,.sitePreview section{position:relative;z-index:2}.sitePreview header{display:flex;justify-content:space-between;padding:16px}.sitePreview section{width:65%;padding:55px 18px}.sitePreview h2{font-size:30px}.sitePreview button{padding:9px 12px;border:0}.logoModal{position:fixed;inset:0;z-index:70000;display:grid;place-items:center;padding:18px;background:rgba(0,5,15,.9);backdrop-filter:blur(14px)}.logoModal>section{width:min(840px,100%);max-height:calc(100svh - 36px);overflow:auto;padding:22px;border:1px solid #23588f;border-radius:12px;background:#061427}.logoModal header,.logoModal footer{display:flex;align-items:center;justify-content:space-between}.logoModal header span{font-size:9px;color:#4dabff}.logoModal header h2{margin:4px 0}.logoModal header button{border:0;background:none;color:white}.logoInputs{display:grid;grid-template-columns:1fr 1fr .7fr;gap:12px;margin:18px 0}.logoInputs label{display:grid;gap:5px;font-size:9px}.logoInputs input,.logoInputs select{height:36px;border:1px solid #23588f;background:#081b31;color:white;padding:0 8px}.logoConcepts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.logoConcepts button{min-height:170px;display:grid;place-items:center;align-content:center;gap:7px;border:1px solid #23588f;background:white;color:#071426}.logoConcepts i{font-size:34px;color:#1264ff}.logoConcepts strong{font-size:20px}.logoConcepts.seed1 button:nth-child(1),.logoConcepts.seed2 button:nth-child(2){background:#071426;color:white}.logoModal footer{justify-content:flex-end;gap:8px;margin-top:14px}.logoModal footer button{min-height:36px;padding:0 12px;border:1px solid #23588f;background:transparent;color:white}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      @media(max-width:900px){.websitePromise{display:none}.websiteTopbar{grid-template-columns:1fr auto}.websiteHeroContent{margin-top:35px}.quickStart>div{grid-template-columns:repeat(4,1fr)}.inspiration>div{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.inspiration>div>button{min-width:34vw;scroll-snap-align:start}.toolRow{grid-template-columns:1fr}.process>div{grid-template-columns:1fr 1fr}.features{grid-template-columns:repeat(3,1fr)}.success{grid-template-columns:1fr 1fr}.success>article:nth-child(2){border-right:0}.previewStage{grid-template-columns:1fr}.logoInputs{grid-template-columns:1fr}.logoConcepts{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:560px){.websiteTopbar{height:auto;min-height:58px;padding:10px 14px}.websiteBrand strong{font-size:14px}.websiteBrand b{display:none}.websiteHost{font-size:10px;padding:7px 9px}.websiteHero{min-height:520px}.websiteHeroContent{width:calc(100% - 24px);margin-top:30px}.websiteHeroContent>h1{font-size:44px}.websiteHeroContent>p{font-size:13px;line-height:1.4}.composerMain{grid-template-columns:1fr;padding:14px}.composerMain>svg{display:none}.composerMain textarea{min-height:110px;font-size:14px}.composerBottom{display:grid;grid-template-columns:1fr auto}.composerBottom span{display:none}.quickStart{padding-inline:10px}.quickStart>div{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.quickStart button{min-width:105px;scroll-snap-align:start}.inspiration{padding-inline:12px}.inspiration header h2{font-size:9px}.inspiration>div>button{min-width:62vw}.inspiration nav{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}.inspiration nav button{width:34px;height:34px;display:grid;place-items:center;border:1px solid #24558a;background:#0b1c31;color:white}.toolRow,.process,.features{padding-inline:12px}.process>div{grid-template-columns:1fr}.process article{border-right:0;border-bottom:1px solid #183d66}.features{grid-template-columns:1fr 1fr}.success{grid-template-columns:1fr;margin-inline:12px}.success>article{border-right:0;border-bottom:1px solid #173d67}.trust{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-inline:16px}.stagePanel,.previewStage{width:calc(100% - 24px);margin-top:30px}.stagePanel h1,.previewStage h1{font-size:34px}.blueprintGrid{grid-template-columns:1fr}.stagePanel footer,.previewStage footer{flex-direction:column}.logoConcepts{grid-template-columns:1fr}.logoModal{padding:8px}.logoModal>section{max-height:calc(100svh - 16px)}}
    `}</style>
  </main>;
}
