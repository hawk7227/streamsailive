"use client";

import Link from "next/link";
import {
  Bot,
  Camera,
  Clapperboard,
  Image as ImageIcon,
  Mic2,
  Play,
  Rocket,
} from "lucide-react";

type Capability = {
  number: string;
  title: string;
  eyebrow: string;
  description: string;
  price: string;
  plan: string;
  cta: string;
  href: string;
  icon: typeof Bot;
  accent: string;
  image: string;
  labels: string[];
};

const capabilities: Capability[] = [
  {
    number: "1",
    title: "STREAMS AI",
    eyebrow: "Income Stream Workspace",
    description:
      "Plan, build, and grow income streams with business direction, offers, websites, branding, ads, and execution plans.",
    price: "$29/mo",
    plan: "Business Builder",
    cta: "Open STREAMS AI",
    href: "/signup?product=streams-ai",
    icon: Bot,
    accent: "from-blue-500 to-cyan-400",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=85",
    labels: ["Business Plan", "Website", "Branding", "Growth", "Ad Plan"],
  },
  {
    number: "2",
    title: "Text 2 Image Studio",
    eyebrow: "Prompt to Visuals",
    description:
      "Generate brand images, product visuals, thumbnails, campaign graphics, ads, and website visuals from prompts.",
    price: "$19/mo",
    plan: "Visual Creator",
    cta: "Create Image",
    href: "/signup?product=text-2-image",
    icon: ImageIcon,
    accent: "from-purple-500 to-fuchsia-400",
    image:
      "https://images.unsplash.com/photo-1585386959984-a41552231658?auto=format&fit=crop&w=1200&q=85",
    labels: ["Product", "Ad Creative", "Brand", "Thumbnail", "Web Graphic"],
  },
  {
    number: "3",
    title: "Photo 2 Motion Studio",
    eyebrow: "Photo to Movement",
    description:
      "Turn photos, selfies, products, and still visuals into motion-ready videos and social clips.",
    price: "$29/mo",
    plan: "Motion Creator",
    cta: "Start Motion",
    href: "/signup?product=photo-2-motion",
    icon: Play,
    accent: "from-pink-500 to-rose-400",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=85",
    labels: ["Motion", "Promo", "Selfie", "Social", "Effects"],
  },
  {
    number: "4",
    title: "Text 2 Video Studio",
    eyebrow: "Words to Video",
    description:
      "Convert hooks, scripts, prompts, and ideas into video direction, storyboards, short-form ads, and launch clips.",
    price: "$39/mo",
    plan: "Video Creator",
    cta: "Generate Video",
    href: "/signup?product=text-2-video",
    icon: Clapperboard,
    accent: "from-rose-500 to-red-400",
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=85",
    labels: ["Ad Video", "Story", "Promo", "Explainer", "Shorts"],
  },
  {
    number: "5",
    title: "Snap Pick Click Studio",
    eyebrow: "Snap. Pick. Click.",
    description:
      "Upload or capture a photo, pick a creative action, and route it into the right AI generation workflow.",
    price: "$19/mo",
    plan: "Mobile Creator",
    cta: "Snap Pick Click",
    href: "/signup?product=snap-pick-click",
    icon: Camera,
    accent: "from-cyan-400 to-teal-400",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85",
    labels: ["Animate", "Transform", "Background", "Avatar", "Social"],
  },
  {
    number: "6",
    title: "Voice & Captions Studio",
    eyebrow: "Voice, Audio, Captions",
    description:
      "Create voiceovers, captions, audio narration, dubbing direction, and spoken content for videos and campaigns.",
    price: "$19/mo",
    plan: "Audio Creator",
    cta: "Create Voice",
    href: "/signup?product=voice-captions",
    icon: Mic2,
    accent: "from-emerald-400 to-green-400",
    image:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=85",
    labels: ["Voiceover", "Captions", "Dubbing", "Narration", "Audio"],
  },
  {
    number: "7",
    title: "Idea to Launch Studio",
    eyebrow: "Full Launch Pipeline",
    description:
      "Turn a rough idea into a launch plan, offer, brand direction, content system, visuals, website, and campaign roadmap.",
    price: "$49/mo",
    plan: "Launch Builder",
    cta: "Launch Idea",
    href: "/signup?product=idea-to-launch",
    icon: Rocket,
    accent: "from-orange-400 to-red-400",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85",
    labels: ["Offer", "Brand", "Website", "Campaign", "Launch"],
  },
];

export default function Features() {
  return (
    <section className="relative overflow-hidden bg-[#030712] py-24 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.14),transparent_28%),radial-gradient(circle_at_90%_28%,rgba(168,85,247,0.18),transparent_32%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="relative z-10 mx-auto max-w-[1680px] px-5 sm:px-8">
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <div className="mb-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
            STREAMS AI capabilities
          </div>

          <h2 className="text-balance text-[clamp(34px,5vw,64px)] font-black leading-[0.95] tracking-[-0.06em]">
            Build, grow, and generate multiple income streams with one AI workspace.
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-300">
            The new face keeps the seven core product cards, but turns them into a premium Opus-style creation launch surface.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-4">
          {capabilities.map((capability, index) => {
            const Icon = capability.icon;
            const wide = index === 0 || index === 6;

            return (
              <article
                key={capability.title}
                className={`group relative overflow-hidden rounded-[28px] border border-white/10 bg-[#08101f]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl ${
                  wide ? "xl:col-span-2" : ""
                }`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${capability.accent}`} />

                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${capability.accent} shadow-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        {capability.eyebrow}
                      </div>
                      <h3 className="text-xl font-black tracking-[-0.04em]">
                        {capability.title}
                      </h3>
                    </div>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                    {capability.number}
                  </div>
                </div>

                <div className="relative mb-4 h-[210px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                  <img
                    src={capability.image}
                    alt=""
                    className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050914] via-[#050914]/20 to-transparent" />

                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                      AI output surface
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {capability.labels.slice(0, 4).map((label) => (
                        <div
                          key={label}
                          className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-slate-100 backdrop-blur-md"
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="min-h-[76px] text-sm leading-6 text-slate-300">
                  {capability.description}
                </p>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-2xl font-black">{capability.price}</div>
                    <div className="text-xs font-semibold text-slate-400">{capability.plan}</div>
                  </div>

                  <Link
                    href={capability.href}
                    className={`rounded-2xl bg-gradient-to-br ${capability.accent} px-5 py-3 text-sm font-black text-white shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5`}
                  >
                    {capability.cta} →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
