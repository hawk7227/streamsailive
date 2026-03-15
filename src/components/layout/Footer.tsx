"use client";

import Link from "next/link";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function Footer() {
  const config = useSiteConfig();
  return (
    <footer className="py-20 border-t border-border-color bg-bg-primary">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-indigo to-accent-purple rounded-xl flex items-center justify-center text-white">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.915a2 2 0 00-1.272 1.272L12 21l-1.912-5.813a2 2 0 00-1.272-1.272L3 12l5.816-1.915a2 2 0 001.272-1.272L12 3z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">{config.appName}</span>
            </Link>
            <p className="text-text-secondary text-sm leading-relaxed mb-6">
              Empowering creators with AI tools for video, image, voice, and
              text generation. Unleash your creativity today.
            </p>
            <div className="flex gap-3">
              {[1, 2, 3, 4].map((i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-xl bg-bg-secondary border border-border-color flex items-center justify-center text-text-secondary hover:bg-bg-tertiary hover:text-white hover:border-border-hover transition-all"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-5">
              Product
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/features"
                  className="text-text-secondary hover:text-white text-sm transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-text-secondary hover:text-white text-sm transition-colors"
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-5">
              Company
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/about"
                  className="text-text-secondary hover:text-white text-sm transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="text-text-secondary hover:text-white text-sm transition-colors"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="/legal"
                  className="text-text-secondary hover:text-white text-sm transition-colors"
                >
                  Legal
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-text-secondary hover:text-white text-sm transition-colors"
                >
                  Privacy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-5">
              Support
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/help-center"
                  className="text-text-secondary hover:text-white text-sm transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-text-secondary hover:text-white text-sm transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-10 border-t border-border-color flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-sm">
            &copy; {new Date().getFullYear()} {config.appName} Inc. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-text-muted hover:text-white text-sm transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-text-muted hover:text-white text-sm transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/cookies"
              className="text-text-muted hover:text-white text-sm transition-colors"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
