"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const { user, loading } = useAuth();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#02050de8] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[68px] max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Streams AI home">
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#225db8] bg-[#081934] shadow-[0_0_24px_rgba(28,130,255,.3)]" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#42dfff] shadow-[0_0_14px_#24cfff]" />
          </span>
          <span className="truncate text-sm font-extrabold tracking-[0.05em] text-white sm:text-base">STREAMS AI</span>
        </Link>

        <div className="hidden items-center gap-7 text-sm text-slate-300 md:flex" aria-label="Primary navigation">
          <a href="#product" className="transition-colors hover:text-white">Product</a>
          <a href="#solutions" className="transition-colors hover:text-white">Solutions</a>
          <Link href="/pricing" className="transition-colors hover:text-white">Pricing</Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!loading && user ? (
            <Link href="/streams-ai" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-gradient-to-r from-[#15aeef] via-[#585dff] to-[#a943e8] px-4 text-xs font-bold text-white shadow-[0_8px_25px_rgba(52,91,255,.25)] sm:px-5 sm:text-sm">
              Open Workspace
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden min-h-10 items-center justify-center px-2 text-sm font-semibold text-slate-200 transition-colors hover:text-white sm:inline-flex">Sign in</Link>
              <Link href="/signup" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-gradient-to-r from-[#15aeef] via-[#585dff] to-[#a943e8] px-4 text-xs font-bold text-white shadow-[0_8px_25px_rgba(52,91,255,.25)] sm:px-5 sm:text-sm">Get Started for Free</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
