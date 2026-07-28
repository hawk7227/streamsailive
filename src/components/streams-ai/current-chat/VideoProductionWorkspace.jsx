"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ArrowUp, CalendarDays, Clock3, Film, GraduationCap,
  MessageSquareText, Mic2, Play, Smartphone, Sparkles, Star, Tag, Youtube,
} from "lucide-react";

const QUICK_IDEAS = [
  ["Product advertisement", Tag],
  ["Social media reel", Smartphone],
  ["Brand commercial", Star],
  ["Customer testimonial", MessageSquareText],
  ["Explainer video", Play],
  ["Training video", GraduationCap],
  ["YouTube video", Youtube],
  ["Event highlight", CalendarDays],
];

const VIDEO_IDEAS = [
  {
    title: "Product Advertisement",
    description: "Launch products with premium cinematic storytelling.",
    duration: "15–60 sec",
    prompt: "Create a premium cinematic product advertisement with dramatic lighting, polished close-ups, and a strong final brand reveal.",
    image: "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=1200&q=88",
    icon: Tag,
  },
  {
    title: "Social Campaign",
    description: "High-energy short-form content for TikTok, Instagram, Shorts, and Reels.",
    duration: "15–45 sec",
    prompt: "Create an energetic vertical social campaign with a real creator, quick cuts, bold hooks, and platform-ready pacing.",
    image: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=88",
    icon: Smartphone,
  },
  {
    title: "Brand Story",
    description: "Tell the story behind your brand with emotional visual storytelling.",
    duration: "30–120 sec",
    prompt: "Create an emotional cinematic brand story with real people, natural environments, and a memorable narrative arc.",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=88",
    icon: Star,
  },
  {
    title: "Customer Testimonial",
    description: "Build trust and credibility with authentic customer experiences.",
    duration: "30–90 sec",
    prompt: "Create an authentic customer testimonial with warm interview lighting, supporting product footage, and clear story beats.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=88",
    icon: MessageSquareText,
  },
  {
    title: "Event Highlight",
    description: "Capture the energy and excitement of your live event or conference.",
    duration: "30–120 sec",
    prompt: "Create a high-energy event highlight video with crowd reactions, stage moments, speakers, and a powerful closing montage.",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=88",
    icon: CalendarDays,
  },
  {
    title: "Educational & Training",
    description: "Teach, explain, and inspire with engaging training videos.",
    duration: "30–180 sec",
    prompt: "Create a clear professional training video with a real presenter, visual examples, structured chapters, and concise explanations.",
    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=88",
    icon: GraduationCap,
  },
];

export default function VideoProductionWorkspace() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState("");
  const canStart = useMemo(() => prompt.trim().length > 3, [prompt]);

  function chooseIdea(label, ideaPrompt = "") {
    setSelected(label);
    setPrompt(ideaPrompt || `Create a ${label.toLowerCase()} with a polished professional production style.`);
    window.requestAnimationFrame(() => document.querySelector(".vplPrompt input")?.focus());
  }

  function startProject(event) {
    event?.preventDefault?.();
    if (!canStart) return;
    window.localStorage.setItem("streams-video-project:creative-brief", prompt.trim());
    window.dispatchEvent(new CustomEvent("streams-video-project:brief-started", { detail: { prompt: prompt.trim() } }));
    router.push("/streams-ai/streams-builder/gen-video");
  }

  return (
    <main className="vpl" aria-label="Streams Video Project creative start">
      <section className="vplInner">
        <header className="vplHero">
          <div className="vplTitle">Streams <span>Video Project</span></div>
          <div className="vplHosted"><Sparkles aria-hidden="true" /> Hosted by <strong>A.S.K. Video Director</strong></div>
          <h1>What video would you like to create today?</h1>
          <p>Describe your idea in plain language and I’ll help you plan, storyboard, and produce it.</p>

          <form className="vplPrompt" onSubmit={startProject}>
            <Sparkles className="vplPromptSpark" aria-hidden="true" />
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Tell me the story you want to tell..."
              aria-label="Describe the video you want to create"
            />
            <button type="button" className="vplMic" aria-label="Use voice input"><Mic2 /></button>
            <button type="submit" className="vplSubmit" disabled={!canStart} aria-label="Start video project"><ArrowUp /></button>
          </form>

          <p className="vplTry">Or try one of these ideas to get started</p>
          <div className="vplChips" aria-label="Quick video ideas">
            {QUICK_IDEAS.map(([label, Icon]) => (
              <button key={label} type="button" className={selected === label ? "active" : ""} onClick={() => chooseIdea(label)}>
                <Icon aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </header>

        <section className="vplIdeas" aria-labelledby="popular-video-ideas">
          <header>
            <h2 id="popular-video-ideas"><Sparkles aria-hidden="true" /> Popular Video Ideas</h2>
            <p>Choose a direction below and A.S.K. Video Director will build your production plan.</p>
          </header>

          <div className="vplIdeaGrid">
            {VIDEO_IDEAS.map((idea) => {
              const Icon = idea.icon;
              return (
                <button
                  key={idea.title}
                  type="button"
                  className={selected === idea.title ? "vplIdea active" : "vplIdea"}
                  onClick={() => chooseIdea(idea.title, idea.prompt)}
                  aria-label={`Start a ${idea.title} video project`}
                >
                  <img src={idea.image} alt="" loading="eager" />
                  <span className="vplIdeaShade" />
                  <span className="vplIdeaBody">
                    <span className="vplIdeaIcon"><Icon aria-hidden="true" /></span>
                    <strong>{idea.title}</strong>
                    <small>{idea.description}</small>
                    <span className="vplIdeaMeta"><span><Clock3 aria-hidden="true" />{idea.duration}</span><i><ArrowRight aria-hidden="true" /></i></span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </section>

      <style jsx global>{`
        .vpl{height:100dvh;min-height:620px;overflow:hidden;background:
          radial-gradient(circle at 50% 0%,rgba(99,51,255,.12),transparent 35%),
          linear-gradient(180deg,#02030a 0%,#050616 58%,#03040d 100%);color:#f8fafc;font-family:Inter,ui-sans-serif,system-ui}
        .vpl *{box-sizing:border-box}.vpl button,.vpl input{font:inherit}
        .vplInner{height:100%;width:min(1500px,100%);margin:auto;padding:clamp(14px,2.1vh,26px) clamp(18px,3.2vw,50px) clamp(14px,2vh,24px);display:grid;grid-template-rows:auto minmax(0,1fr);gap:clamp(16px,2vh,24px)}
        .vplHero{text-align:center;display:grid;justify-items:center;gap:clamp(7px,1vh,12px)}
        .vplTitle{font-size:clamp(30px,3vw,50px);font-weight:850;letter-spacing:-.04em;line-height:1}.vplTitle span{background:linear-gradient(90deg,#b45cff,#6285ff);-webkit-background-clip:text;background-clip:text;color:transparent}
        .vplHosted{display:flex;align-items:center;gap:8px;color:#afb4c5;font-size:clamp(13px,1.25vw,19px)}.vplHosted svg{width:19px;color:#b45cff}.vplHosted strong{color:#a77cff}
        .vplHero h1{margin:clamp(8px,1.3vh,16px) 0 0;font-size:clamp(26px,2.7vw,44px);line-height:1.06;letter-spacing:-.035em}.vplHero>p:not(.vplTry){margin:0;color:#aeb4c5;font-size:clamp(12px,1vw,16px)}
        .vplPrompt{width:min(1000px,84vw);height:clamp(60px,7.6vh,82px);margin-top:clamp(8px,1vh,14px);display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:12px;padding:0 16px 0 22px;border:1px solid rgba(147,87,255,.58);border-radius:999px;background:linear-gradient(90deg,rgba(18,18,43,.96),rgba(20,22,44,.9));box-shadow:0 0 36px rgba(96,52,255,.1)}
        .vplPromptSpark{width:21px;color:#b45cff}.vplPrompt input{width:100%;border:0;outline:0;background:transparent;color:#f8fafc;font-size:clamp(14px,1.15vw,18px)}.vplPrompt input::placeholder{color:#7e8294}
        .vplMic,.vplSubmit{border:0;display:grid;place-items:center;cursor:pointer}.vplMic{width:36px;height:36px;background:transparent;color:#7e7cff}.vplMic svg{width:20px}.vplSubmit{width:48px;height:48px;border-radius:50%;background:linear-gradient(145deg,#7545ff,#a646f0);color:#fff;box-shadow:0 8px 22px rgba(110,66,255,.35)}.vplSubmit:disabled{opacity:.45;cursor:not-allowed}.vplSubmit svg{width:22px}
        .vplTry{margin:5px 0 0;color:#aeb4c5;font-size:13px}.vplChips{width:100%;display:flex;justify-content:center;gap:10px;overflow-x:auto;scrollbar-width:none;padding:0 0 2px}.vplChips::-webkit-scrollbar{display:none}.vplChips button{flex:0 0 auto;min-height:42px;display:flex;align-items:center;gap:8px;padding:0 16px;border:1px solid rgba(123,113,175,.28);border-radius:999px;background:rgba(14,15,35,.72);color:#f0eff8;cursor:pointer;white-space:nowrap;font-size:13px}.vplChips button:hover,.vplChips button.active{border-color:#8254ff;background:rgba(87,54,182,.22)}.vplChips svg{width:17px;color:#b463ff}
        .vplIdeas{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px}.vplIdeas>header h2{margin:0;display:flex;align-items:center;gap:9px;font-size:clamp(19px,1.8vw,27px)}.vplIdeas>header h2 svg{width:23px;color:#bd62ff}.vplIdeas>header p{margin:4px 0 0;color:#a9aebe;font-size:clamp(11px,.9vw,14px)}
        .vplIdeaGrid{min-height:0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}.vplIdea{position:relative;min-width:0;height:100%;border:1px solid rgba(112,107,160,.3);border-radius:14px;overflow:hidden;background:#080913;color:#fff;text-align:left;cursor:pointer;padding:0;isolation:isolate}.vplIdea:hover,.vplIdea.active{border-color:#7f52ff;transform:translateY(-2px)}.vplIdea img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .35s ease}.vplIdea:hover img{transform:scale(1.035)}.vplIdeaShade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 24%,rgba(3,4,12,.42) 48%,rgba(3,4,12,.98) 78%)}
        .vplIdeaBody{position:absolute;inset:auto 0 0;display:grid;gap:8px;padding:14px}.vplIdeaIcon{width:38px;height:38px;border:1px solid rgba(188,98,255,.75);border-radius:50%;display:grid;place-items:center;background:rgba(5,6,17,.72);color:#c469ff}.vplIdeaIcon svg{width:18px}.vplIdeaBody strong{font-size:clamp(14px,1.08vw,18px)}.vplIdeaBody small{min-height:3.1em;color:#c1c3cf;font-size:clamp(10px,.78vw,13px);line-height:1.55}.vplIdeaMeta{display:flex;align-items:center;justify-content:space-between;color:#9c79ff;font-size:12px}.vplIdeaMeta>span{display:flex;align-items:center;gap:6px}.vplIdeaMeta svg{width:15px}.vplIdeaMeta i{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#3f2379,#6840c8);color:#fff;font-style:normal}
        @media(max-width:1150px){.vplIdeaGrid{grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:1fr}.vpl{overflow:auto}.vplInner{height:auto;min-height:100%;}.vplIdea{min-height:330px}}
        @media(max-width:720px){.vpl{min-height:100dvh;height:100dvh;overflow:hidden}.vplInner{height:100%;padding:14px 14px 12px;grid-template-rows:auto minmax(0,1fr);gap:12px}.vplTitle{font-size:28px}.vplHosted{font-size:12px}.vplHero h1{font-size:24px;margin-top:4px}.vplHero>p:not(.vplTry){font-size:11px;max-width:350px}.vplPrompt{width:100%;height:58px;margin-top:4px;padding:0 8px 0 15px;gap:8px}.vplPrompt input{font-size:13px}.vplPromptSpark{width:18px}.vplMic{display:none}.vplSubmit{width:42px;height:42px}.vplTry{font-size:11px}.vplChips{justify-content:flex-start;margin-inline:-14px;width:calc(100% + 28px);padding-inline:14px}.vplChips button{min-height:36px;padding:0 12px;font-size:11px}.vplIdeas{gap:8px}.vplIdeas>header h2{font-size:18px}.vplIdeas>header p{font-size:10px}.vplIdeaGrid{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding-bottom:2px}.vplIdeaGrid::-webkit-scrollbar{display:none}.vplIdea{flex:0 0 min(74vw,270px);height:100%;min-height:0;scroll-snap-align:start}.vplIdeaBody{padding:12px;gap:6px}.vplIdeaIcon{width:34px;height:34px}.vplIdeaBody strong{font-size:15px}.vplIdeaBody small{font-size:11px}.vplIdeaMeta{font-size:11px}}
        @media(max-height:720px) and (min-width:721px){.vplInner{padding-top:10px;padding-bottom:10px;gap:10px}.vplHero{gap:5px}.vplHero h1{margin-top:4px}.vplPrompt{height:58px;margin-top:4px}.vplChips button{min-height:34px}.vplIdeas{gap:7px}.vplIdeaBody{padding:10px;gap:5px}.vplIdeaIcon{width:32px;height:32px}.vplIdeaBody small{line-height:1.35}}
        @media(prefers-reduced-motion:reduce){.vplIdea,.vplIdea img{transition:none}.vplIdea:hover{transform:none}}
      `}</style>
    </main>
  );
}
