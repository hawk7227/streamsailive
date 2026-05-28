"use client";

import { FormEvent, useState } from "react";

type Kind = "image" | "image-to-video" | "text-to-video" | "voice" | "snap-pick-click" | "motion" | "launch";
type Provider = "auto" | "openai" | "fal" | "runway" | "kling" | "veo" | "elevenlabs";

const studios: { id: Kind; title: string; icon: string; provider: string }[] = [
  { id: "image", title: "Image Generation", icon: "🖼️", provider: "OpenAI / fal.ai" },
  { id: "image-to-video", title: "Image to Video", icon: "🎞️", provider: "Runway / fal.ai" },
  { id: "text-to-video", title: "Text to Video", icon: "🎬", provider: "Runway / fal.ai / Veo / Kling" },
  { id: "voice", title: "Voice Studio", icon: "🎙️", provider: "ElevenLabs" },
  { id: "snap-pick-click", title: "Snap Pick Click", icon: "📸", provider: "fal.ai / OpenAI" },
  { id: "motion", title: "Motion Graphics", icon: "🔷", provider: "fal.ai" },
  { id: "launch", title: "Idea to Launch", icon: "🚀", provider: "OpenAI / fal.ai" },
];

export default function AdminGenerationPage() {
  const [kind, setKind] = useState<Kind>("image");
  const [provider, setProvider] = useState<Provider>("auto");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [prompt, setPrompt] = useState("Create a cinematic premium STREAMS AI launch visual with a dark Opus-style dashboard, glowing creator tools, and realistic studio lighting.");
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);

    const response = await fetch("/api/admingeneration/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-generation-key": accessKey,
      },
      body: JSON.stringify({
        kind,
        provider,
        prompt,
        aspectRatio,
        sourceImageUrl: sourceImageUrl || undefined,
        voiceId: voiceId || undefined,
      }),
    });

    setResult(await response.json());
    setPending(false);
  }

  return (
    <main className="min-h-screen bg-[#03070f] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4">
        <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
          <div>
            <div className="text-xl font-black tracking-[-0.04em]">STREAMS AI Admin Generation</div>
            <div className="text-xs text-slate-400">/admingeneration — production provider route control surface</div>
          </div>
          <div className="hidden gap-2 text-xs font-bold md:flex">
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">Real API</span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-200">Provider Router</span>
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-200">Protected</span>
          </div>
        </header>

        <section className="grid flex-1 gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-white/10 bg-[#07101c] p-5">
            <div className="mb-5">
              <div className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Universal Generation Router</div>
              <h1 className="max-w-4xl text-[clamp(34px,5vw,72px)] font-black leading-[0.9] tracking-[-0.07em]">One admin board for image, video, voice, motion, and launch generation.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">This page is the deployed version of the local Opus-style generation frame. It submits to a real backend route and shows truthful blocked states when provider keys, endpoint contracts, or persistence are missing.</p>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {studios.map((studio) => (
                <button
                  key={studio.id}
                  type="button"
                  onClick={() => setKind(studio.id)}
                  className={`rounded-2xl border p-4 text-left transition ${kind === studio.id ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"}`}
                >
                  <div className="text-2xl">{studio.icon}</div>
                  <div className="mt-2 text-sm font-black leading-tight">{studio.title}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{studio.provider}</div>
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Prompt</label>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="h-40 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white outline-none" />
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input value={sourceImageUrl} onChange={(event) => setSourceImageUrl(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs outline-none" placeholder="Optional source image URL" />
                  <input value={voiceId} onChange={(event) => setVoiceId(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs outline-none" placeholder="Optional ElevenLabs voice ID" />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <input value={accessKey} onChange={(event) => setAccessKey(event.target.value)} type="password" className="mb-3 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs outline-none" placeholder="Admin generation key" />
                <select value={provider} onChange={(event) => setProvider(event.target.value as Provider)} className="mb-3 h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-xs outline-none">
                  {(["auto", "openai", "fal", "runway", "kling", "veo", "elevenlabs"] as Provider[]).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className="mb-4 h-11 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-xs outline-none">
                  {['16:9', '9:16', '1:1'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <button disabled={pending} className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 text-sm font-black disabled:opacity-50">{pending ? "Submitting..." : "Submit Real Job"}</button>
              </div>
            </form>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-black">Backend Status</h2>
            <div className="mt-3 grid gap-2 text-xs">
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-emerald-100">POST /api/admingeneration/jobs</div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-100">Requires ADMIN_GENERATION_KEY</div>
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-100">Requires Supabase streams schema for persistence</div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Last Result</div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-200">{result ? JSON.stringify(result, null, 2) : "No job submitted yet."}</pre>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
