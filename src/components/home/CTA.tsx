"use client";

import Link from "next/link";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function CTA() {
  const config = useSiteConfig();
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-gradient-to-br from-accent-indigo to-accent-purple rounded-[32px] py-20 px-10 text-center relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-[clamp(28px,4vw,40px)] font-bold mb-4 text-white">
              Ready to Create Magic?
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-[500px] mx-auto">
              Join thousands of creators who are already using {config.appName} to level
              up their content game.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-accent-indigo rounded-2xl font-semibold text-base transition-all hover:bg-slate-50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
            >
              Get Started for Free
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
          </div>
        </div>
      </div>
    </section>
  );
}
