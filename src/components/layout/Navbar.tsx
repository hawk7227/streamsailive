"use client";

import Link from "next/link";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function Navbar() {
  const config = useSiteConfig();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0fa0] backdrop-blur-[20px] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-center py-4">
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
      </div>
    </nav>
  );
}
