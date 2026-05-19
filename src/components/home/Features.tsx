"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Camera,
  Clapperboard,
  Image as ImageIcon,
  Mic2,
  Play,
  Rocket,
} from "lucide-react";

type Capability = {
  id: string;
  number: string;
  title: string;
  eyebrow: string;
  description: string;
  price: string;
  plan: string;
  cta: string;
  href: string;
  status: "wired" | "later";
  accent: "blue" | "purple" | "pink" | "rose" | "cyan" | "green" | "orange";
  icon: typeof Bot;
  images: string[];
  sourceLabel: string;
  resultLabels: string[];
  fields: string[];
  testimonials: {
    quote: string;
    result: string;
    built: string;
  }[];
};

const accentStyles = {
  blue: {
    border: "border-blue-400/60",
    glow: "shadow-blue-950/40",
    badge: "from-blue-500 to-cyan-400",
    button: "from-blue-600 to-cyan-500",
    chip: "border-blue-300/25 bg-blue-400/10 text-blue-100",
  },
  purple: {
    border: "border-purple-400/60",
    glow: "shadow-purple-950/40",
    badge: "from-purple-500 to-fuchsia-400",
    button: "from-purple-600 to-fuchsia-500",
    chip: "border-purple-300/25 bg-purple-400/10 text-purple-100",
  },
  pink: {
    border: "border-pink-400/60",
    glow: "shadow-pink-950/40",
    badge: "from-pink-500 to-rose-400",
    button: "from-pink-600 to-rose-500",
    chip: "border-pink-300/25 bg-pink-400/10 text-pink-100",
  },
  rose: {
    border: "border-rose-400/60",
    glow: "shadow-rose-950/40",
    badge: "from-rose-500 to-red-400",
    button: "from-rose-600 to-red-500",
    chip: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  },
  cyan: {
    border: "border-cyan-400/60",
    glow: "shadow-cyan-950/40",
    badge: "from-cyan-400 to-teal-400",
    button: "from-cyan-600 to-teal-500",
    chip: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
  },
  green: {
    border: "border-emerald-400/60",
    glow: "shadow-emerald-950/40",
    badge: "from-emerald-400 to-green-400",
    button: "from-emerald-600 to-green-500",
    chip: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  },
  orange: {
    border: "border-orange-400/60",
    glow: "shadow-orange-950/40",
    badge: "from-orange-400 to-red-400",
    button: "from-orange-600 to-red-500",
    chip: "border-orange-300/25 bg-orange-400/10 text-orange-100",
  },
};

const capabilities: Capability[] = [
  {
    id: "streams-ai",
    number: "1",
    title: "STREAMS AI",
    eyebrow: "Income Stream Workspace",
    description:
      "Takes out the guesswork when you want to start, grow, or generate multiple income streams.",
    price: "$29/mo",
    plan: "Business Builder",
    cta: "Open STREAMS AI",
    href: "/signup?product=streams-ai",
    status: "wired",
    accent: "blue",
    icon: Bot,
    sourceLabel: "Business Problem",
    resultLabels: ["Business Plan", "Website Direction", "Branding", "Growth Plan", "Ad Plan"],
    fields: ["Goal / Vision", "Business Type", "Growth Stage", "Current Problem", "Revenue Ideas"],
    images: [
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=85",
    ],
    testimonials: [
      {
        quote: "I needed a business idea.",
        result: "STREAMS AI built the visual concept, offer, name, website sections, and first launch direction.",
        built: "Then STREAMS AI built the website direction, branding plan, and generated the first image concepts.",
      },
      {
        quote: "I needed more income streams.",
        result: "STREAMS AI built the income stream map, offer stack, pricing path, and growth plan.",
        built: "Then STREAMS AI built the next-step roadmap and matched it to the right execution capability.",
      },
      {
        quote: "I did not know what to build next.",
        result: "STREAMS AI built the decision path, business priorities, and execution order.",
        built: "Then STREAMS AI built the project plan and first action checklist.",
      },
    ],
  },
  {
    id: "text-2-image",
    number: "2",
    title: "Text 2 Image Studio",
    eyebrow: "Prompt to Visuals",
    description:
      "Turn prompts into brand images, product visuals, ads, thumbnails, and website graphics.",
    price: "$19/mo",
    plan: "Visual Creator",
    cta: "Create Image",
    href: "/signup?product=text-2-image",
    status: "later",
    accent: "purple",
    icon: ImageIcon,
    sourceLabel: "Prompt / Idea",
    resultLabels: ["Product Photo", "Ad Creative", "Brand Visual", "Thumbnail", "Website Graphic"],
    fields: ["Prompt", "Style", "Aspect Ratio", "Image Type", "Brand Direction", "Export Size"],
    images: [
      "https://images.unsplash.com/photo-1585386959984-a41552231658?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?auto=format&fit=crop&w=900&q=85",
    ],
    testimonials: [
      {
        quote: "I needed my brand to look professional.",
        result: "STREAMS AI built the brand direction, visual style, content plan, and generated first image concepts.",
        built: "Then STREAMS AI built product visuals, web graphics, and ad image direction.",
      },
      {
        quote: "I needed product images for ads.",
        result: "STREAMS AI built the product visual direction, campaign angle, and image prompts.",
        built: "Then STREAMS AI generated the product image concept and ad creative structure.",
      },
      {
        quote: "I needed website hero graphics.",
        result: "STREAMS AI built the page visual concept, banner direction, and brand image set.",
        built: "Then STREAMS AI generated the first website graphic concepts.",
      },
    ],
  },
  {
    id: "photo-2-motion",
    number: "3",
    title: "Photo 2 Motion Studio",
    eyebrow: "Photo to Movement",
    description: "Turn photos, products, selfies, or visuals into moving video content.",
    price: "$29/mo",
    plan: "Motion Creator",
    cta: "Start Motion",
    href: "/signup?product=photo-2-motion",
    status: "later",
    accent: "pink",
    icon: Play,
    sourceLabel: "Source Photo",
    resultLabels: ["Cinematic Motion", "Product Promo", "Selfie Video", "Social Clip", "Motion Effects"],
    fields: ["Upload Image", "Motion Prompt", "Camera Move", "Duration", "Aspect Ratio", "Export Goal"],
    images: [
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=85",
    ],
    testimonials: [
      {
        quote: "I had photos but no videos.",
        result: "STREAMS AI built the motion plan and turned the photo into video-ready promo direction.",
        built: "Then STREAMS AI built the camera move, clip purpose, and social video layout.",
      },
      {
        quote: "I needed a product promo fast.",
        result: "STREAMS AI built the product motion style, ad angle, and short video plan.",
        built: "Then STREAMS AI built the product promo direction and motion settings.",
      },
      {
        quote: "I wanted my photo to feel alive.",
        result: "STREAMS AI built cinematic movement, social clip direction, and motion effects.",
        built: "Then STREAMS AI built the motion storyboard and export direction.",
      },
    ],
  },
  {
    id: "text-2-video",
    number: "4",
    title: "Text 2 Video Studio",
    eyebrow: "Words to Video",
    description: "Turn text, scripts, hooks, or ideas into videos.",
    price: "$39/mo",
    plan: "Video Creator",
    cta: "Generate Video",
    href: "/signup?product=text-2-video",
    status: "later",
    accent: "rose",
    icon: Clapperboard,
    sourceLabel: "Script / Hook",
    resultLabels: ["Ad Video", "Story Video", "Promo Script", "Explainer", "Shorts/Reels"],
    fields: ["Video Prompt", "Hook", "Script", "Style", "Duration", "Export Platform"],
    images: [
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=900&q=85",
    ],
    testimonials: [
      {
        quote: "I had scripts and hooks but no finished videos.",
        result: "STREAMS AI built the video direction, campaign hooks, scenes, and ad video plan.",
        built: "Then STREAMS AI built the prompt, storyboard, and video generation direction.",
      },
      {
        quote: "I needed a video ad from an idea.",
        result: "STREAMS AI built the ad story, scene flow, prompt, and export direction.",
        built: "Then STREAMS AI built the video plan and short-form structure.",
      },
      {
        quote: "I needed short-form video ideas.",
        result: "STREAMS AI built the hooks, scripts, and Shorts/Reels video structure.",
        built: "Then STREAMS AI built the text-to-video prompt set.",
      },
    ],
  },
  {
    id: "snap-pick-click",
    number: "5",
    title: "Snap Pick Click Studio",
    eyebrow: "Snap. Pick. Click.",
    description: "Snap a photo or video, pick an action, click create, and let AI do the rest.",
    price: "$19/mo",
    plan: "Mobile Creator",
    cta: "Snap Pick Click",
    href: "/signup?product=snap-pick-click",
    status: "later",
    accent: "cyan",
    icon: Camera,
    sourceLabel: "Source Snap",
    resultLabels: [
      "Make Me Dance",
      "Motivate Me",
      "FaceTime With Myself",
      "Funny Scene",
      "Change Background",
      "Cinematic Transformation",
    ],
    fields: ["Camera / Upload", "Voice Input", "Action", "Duration", "Export"],
    images: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=85",
    ],
    testimonials: [
      {
        quote: "I needed fast content from my phone.",
        result: "STREAMS AI built the action plan for snaps, selfies, products, scenes, and quick content ideas.",
        built: "Then STREAMS AI built Snap Pick Click actions and mobile-first content direction.",
      },
      {
        quote: "I wanted a FaceTime-style motivation clip.",
        result: "STREAMS AI built the personal message, talking-selfie direction, and Motivation Mirror flow.",
        built: "Then STREAMS AI built the FaceTime With Myself action and voice direction.",
      },
      {
        quote: "I needed a product promo from one picture.",
        result: "STREAMS AI built the Snap Pick Click action, product angle, and quick promo direction.",
        built: "Then STREAMS AI built the Product Promo action and export path.",
      },
    ],
  },
  {
    id: "voice-captions",
    number: "6",
    title: "Voice & Captions Studio",
    eyebrow: "Voice, Captions, Sound",
    description: "Create voiceovers, captions, music, dubbing, and audio polish.",
    price: "$19/mo",
    plan: "Audio Creator",
    cta: "Voice Studio",
    href: "/signup?product=voice-captions",
    status: "later",
    accent: "green",
    icon: Mic2,
    sourceLabel: "Raw Script",
    resultLabels: ["Voiceover", "Captions", "Lip Sync", "Dubbing", "Music"],
    fields: ["Task", "Script", "Voice", "Language", "Captions", "Audio Polish"],
    images: [
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=85",
    ],
    testimonials: [
      {
        quote: "My videos needed voice and captions.",
        result: "STREAMS AI built the script, voice direction, captions plan, and audio polish workflow.",
        built: "Then STREAMS AI built the voiceover, captions, and sound plan.",
      },
      {
        quote: "I needed my ad to sound finished.",
        result: "STREAMS AI built the voiceover, music direction, auto-caption plan, and timing flow.",
        built: "Then STREAMS AI built the audio finish workflow.",
      },
      {
        quote: "I needed captions for every clip.",
        result: "STREAMS AI built the subtitle workflow, script cleanup, and voice polish direction.",
        built: "Then STREAMS AI built the captions and timing path.",
      },
    ],
  },
  {
    id: "idea-2-launch",
    number: "7",
    title: "Idea 2 Launch Studio",
    eyebrow: "Idea to Campaign",
    description: "Turn a business idea, offer, campaign, or story into a full launch pipeline.",
    price: "$79/mo",
    plan: "Launch Builder",
    cta: "Start Launch",
    href: "/signup?product=idea-2-launch",
    status: "later",
    accent: "orange",
    icon: Rocket,
    sourceLabel: "Launch Idea",
    resultLabels: ["Plan", "Generate Assets", "Edit", "Stitch", "Export"],
    fields: ["Idea / Concept", "Scene Breakdown", "Assets Needed", "Output Length", "Launch Goal", "Export Plan"],
    images: [
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=900&q=85",
    ],
    testimonials: [
      {
        quote: "I needed the full launch built out.",
        result: "STREAMS AI built the campaign strategy, assets plan, launch flow, and execution pipeline.",
        built: "Then STREAMS AI built the plan, generation, edit, export, and launch sequence.",
      },
      {
        quote: "I had an offer but no campaign.",
        result: "STREAMS AI built the plan, generated asset direction, edit flow, and launch sequence.",
        built: "Then STREAMS AI built the full campaign pipeline.",
      },
      {
        quote: "I needed one system to pull everything together.",
        result: "STREAMS AI built the idea, website, content, media, ad, and launch pipeline.",
        built: "Then STREAMS AI built the launch execution flow.",
      },
    ],
  },
];

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function CapabilityCard({ capability }: { capability: Capability }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const accent = accentStyles[capability.accent];
  const Icon = capability.icon;
  const activeStory = capability.testimonials[activeIndex];
  const previewImage = capability.images[activeIndex % capability.images.length];

  const previous = () => {
    setActiveIndex((current) =>
      current === 0 ? capability.testimonials.length - 1 : current - 1,
    );
  };

  const next = () => {
    setActiveIndex((current) => (current + 1) % capability.testimonials.length);
  };

  return (
    <article className="min-w-0">
      <div className="mb-4 grid min-h-[138px] grid-cols-[34px_1fr_34px] items-center gap-3">
        <button
          type="button"
          onClick={previous}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/10"
          aria-label={`Previous ${capability.title} testimonial`}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="break-words text-lg font-black leading-tight tracking-[-0.03em] text-white">
            “{activeStory.quote}”
          </p>
          <p className="mt-2 break-words text-xs font-semibold leading-5 text-slate-300">
            {activeStory.result}
          </p>
          <p className="mt-1 break-words text-xs font-bold leading-5 text-cyan-200">
            {activeStory.built}
          </p>
        </div>
        <button
          type="button"
          onClick={next}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/10"
          aria-label={`Next ${capability.title} testimonial`}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`relative h-full min-h-[610px] overflow-hidden rounded-[28px] border ${accent.border} bg-[#080c18] shadow-2xl ${accent.glow}`}
      >
        <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/80" />
        <div className="relative z-0 flex h-full min-h-[610px] flex-col p-4 pt-10">
          <div className="mb-3 flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent.badge} text-xl font-black text-white shadow-lg`}
            >
              {capability.number}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <h3 className="truncate text-lg font-black leading-tight text-white">
                  {capability.title}
                </h3>
                <Icon className="h-4 w-4 shrink-0 text-white/70" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
                {capability.eyebrow}
              </p>
            </div>
          </div>

          <p className="mb-2 line-clamp-3 text-xs leading-5 text-slate-300">
            {capability.description}
          </p>

          <div className="mb-3 flex items-center justify-end text-right">
            <div>
              <div className="text-base font-black text-white">{capability.price}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {capability.plan}
              </div>
            </div>
          </div>

          {!workspaceOpen ? (
            <div className="mb-3 rounded-xl border border-white/10 bg-slate-950/70 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">
                  Before → generated results
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Default first view
                </span>
              </div>
              <div className="grid grid-cols-[1.05fr_1.55fr] gap-2">
                <div className={`overflow-hidden rounded-xl border ${accent.border} bg-slate-950 shadow-sm`}>
                  <img
                    src={previewImage}
                    alt=""
                    className="h-[156px] w-full object-cover brightness-[.84] contrast-125 saturate-150"
                  />
                  <div className={`border-t px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.08em] ${accent.chip}`}>
                    {capability.sourceLabel}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {capability.resultLabels.slice(0, 6).map((label, index) => (
                    <div
                      key={label}
                      className={`overflow-hidden rounded-lg border ${accent.border} bg-slate-950/80 shadow-sm`}
                    >
                      <img
                        src={capability.images[(index + 1) % capability.images.length]}
                        alt=""
                        className="h-[48px] w-full object-cover brightness-[.84] contrast-125 saturate-150"
                      />
                      <div className={`min-h-[30px] px-1.5 py-1 text-center text-[9px] font-black leading-[1.05] ${accent.chip}`}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-[0.12em] text-white">
                  Workspace Inputs
                </div>
                <button
                  type="button"
                  onClick={() => setWorkspaceOpen(false)}
                  className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:text-white"
                >
                  Back
                </button>
              </div>
              <div className="grid gap-2">
                {capability.fields.map((field, index) => (
                  <label key={field}>
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {field}
                    </span>
                    {index === 0 ? (
                      <textarea
                        className="h-14 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-white outline-none placeholder:text-slate-500"
                        placeholder={`Enter ${field.toLowerCase()}...`}
                      />
                    ) : (
                      <div className="flex h-9 items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300">
                        <span>Select value</span>
                        <ArrowIcon />
                      </div>
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-[11px] leading-5 text-slate-300">
                Preview mode only. Final generation and capability execution unlock after account setup.
              </div>
            </div>
          )}

          <div className="mt-auto grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWorkspaceOpen((open) => !open)}
              className={`rounded-xl bg-gradient-to-r ${accent.button} px-3 py-3 text-sm font-black text-white shadow-lg transition active:scale-[.98]`}
            >
              {workspaceOpen ? "Show Results" : capability.cta}
            </button>
            <Link
              href={capability.href}
              className="flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-3 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]"
            >
              {capability.status === "wired" ? "Start Free" : "Join List"}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Features() {
  return (
    <section className="relative overflow-hidden bg-[#050711] py-20 sm:py-24" id="features">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,.18),transparent_35%),radial-gradient(circle_at_100%_10%,rgba(236,72,153,.12),transparent_30%)]" />
      <div className="relative mx-auto w-full max-w-[1800px] px-4 sm:px-6">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            <BriefcaseBusiness className="h-4 w-4" />
            STREAMS AI capabilities
          </div>
          <h2 className="mx-auto max-w-5xl text-[clamp(34px,5vw,64px)] font-black leading-[0.98] tracking-[-0.05em] text-white">
            Build, grow, and generate multiple income streams with one AI workspace.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Start with STREAMS AI to remove the guesswork. Then unlock focused capabilities for websites, branding, content, ads, images, motion, voice, and full launch execution.
          </p>
        </div>

        <div className="grid w-full min-w-0 gap-x-5 gap-y-14 md:grid-cols-2 xl:grid-cols-4">
          {capabilities.map((capability) => (
            <CapabilityCard key={capability.id} capability={capability} />
          ))}
        </div>
      </div>
    </section>
  );
}
