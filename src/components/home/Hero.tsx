"use client";

import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative pt-40 pb-24 overflow-hidden">
      {/* Background & Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#6366f126] to-transparent pointer-events-none" />
      <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(99,102,241,0.3)_0%,transparent_70%)] rounded-full blur-[80px] top-0 left-1/2 -translate-x-1/2 animate-pulse-slow pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#6366f11a] border border-[#6366f133] rounded-full text-sm text-[#a5b4fc] mb-6 opacity-0 animate-fade-in-up [animation-delay:0.1s]">
          <span className="w-2 h-2 bg-accent-emerald rounded-full animate-pulse" />
          Now with Veo 3 Video Generation
        </div>

        {/* Title */}
        <h1 className="text-[clamp(40px,6vw,72px)] font-extrabold leading-[1.1] mb-6 opacity-0 animate-fade-in-up [animation-delay:0.2s]">
          Create Stunning Content
          <br />
          <span className="bg-gradient-to-br from-[#818cf8] via-[#c084fc] to-[#f472b6] bg-[length:200%_200%] bg-clip-text text-transparent animate-gradient">
            with AI Magic
          </span>
        </h1>

        {/* Description */}
        <p className="text-xl text-text-secondary max-w-[600px] mx-auto mb-10 opacity-0 animate-fade-in-up [animation-delay:0.3s]">
          Transform your ideas into professional videos, images, voiceovers, and
          scripts. One platform, unlimited creativity.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 opacity-0 animate-fade-in-up [animation-delay:0.4s]">
          <Link
            href="/signup"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-br from-accent-indigo to-accent-purple text-white rounded-2xl font-semibold text-base transition-all hover:shadow-[0_8px_30px_rgba(99,102,241,0.4)] hover:-translate-y-0.5"
          >
            Start Creating Free
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <button
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-border-color text-white rounded-2xl font-semibold text-base transition-all hover:bg-white/10 hover:border-border-hover"
            onClick={() => {
              /* Handle smooth scroll to demo if needed */
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Watch Demo
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 opacity-0 animate-fade-in-up [animation-delay:0.5s]">
          <div className="text-center">
            <span className="block text-3xl font-bold text-white">50K+</span>
            <span className="text-sm text-text-muted">Creators</span>
          </div>
          <div className="text-center">
            <span className="block text-3xl font-bold text-white">2.5M+</span>
            <span className="text-sm text-text-muted">Generations</span>
          </div>
          <div className="text-center">
            <span className="block text-3xl font-bold text-white">10K+</span>
            <span className="text-sm text-text-muted">Hours Saved</span>
          </div>
        </div>
      </div>
    </section>
  );
}
