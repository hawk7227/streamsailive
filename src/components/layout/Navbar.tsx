"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function Navbar() {
  const config = useSiteConfig();
  const { user, loading } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0fa0] backdrop-blur-[20px] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
            <img
              src={config.logoUrl}
              alt={`${config.appName} Logo`}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-xl font-bold text-white">{config.appName}</span>
        </Link>

        <div className="flex items-center gap-3">
          {!loading && user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-accent-indigo to-accent-purple px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-accent-indigo to-accent-purple px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
