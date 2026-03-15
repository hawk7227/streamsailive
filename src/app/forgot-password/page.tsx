"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown((c) => c - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      setIsSuccess(true);
      setCooldown(60);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      setCooldown(60);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] animate-fade-in">
        <Link
          href="/"
          className="flex items-center justify-center gap-3 mb-12"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-accent-indigo to-accent-purple rounded-xl flex items-center justify-center text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-6 h-6"
            >
              <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.915a2 2 0 00-1.272 1.272L12 21l-1.912-5.813a2 2 0 00-1.272-1.272L3 12l5.816-1.915a2 2 0 001.272-1.272L12 3z" />
            </svg>
          </div>
          <span className="text-2xl font-bold">StreamsAI</span>
        </Link>

        <div className="bg-bg-secondary border border-border-color rounded-3xl p-10">
          {!isSuccess ? (
            <div className="animate-fade-in">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[20px] bg-[#6366f11a] text-accent-indigo flex items-center justify-center mx-auto mb-5">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-8 h-8"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold mb-2">Reset your password</h1>
                <p className="text-text-secondary text-[15px]">
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm mb-6">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-5 h-5 flex-shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                <div className="space-y-2 mb-6">
                  <label className="text-sm font-medium text-text-secondary block">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 bg-bg-tertiary border border-border-color rounded-xl text-text-primary text-[15px] focus:outline-none focus:border-accent-indigo focus:ring-4 focus:ring-accent-indigo/10 transition-all placeholder:text-text-muted"
                    placeholder="you@company.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-accent-indigo to-accent-purple text-white rounded-xl font-bold text-base transition-all hover:shadow-[0_8px_30px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="w-5 h-5"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 mt-6 text-sm text-text-secondary hover:text-white transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4.5 h-4.5"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to sign in
              </Link>
            </div>
          ) : (
            <div className="animate-fade-in text-center">
              <div className="w-20 h-20 rounded-full bg-[#10b9811a] flex items-center justify-center mx-auto mb-6 text-accent-emerald animate-pulse-slow">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="w-10 h-10"
                >
                  <path
                    d="M20 6L9 17l-5-5"
                    strokeDasharray="100"
                    strokeDashoffset="0"
                    className="animate-checkmark"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-bold mb-3">Check your email</h2>
              <p className="text-text-secondary text-[15px] mb-2">
                We've sent a password reset link to
              </p>
              <p className="font-medium text-white mb-6">{email}</p>
              <p className="text-xs text-text-muted mb-8">
                The link will expire in 1 hour
              </p>

              <div className="pt-6 border-t border-border-color mb-8">
                <p className="text-sm text-text-secondary mb-3">
                  Didn't receive the email?
                </p>
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || isLoading}
                  className="text-sm font-medium text-accent-indigo hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : "Click to resend"}
                </button>
              </div>

              <button
                onClick={() => (window.location.href = "mailto:")}
                className="w-full py-4 bg-bg-tertiary border border-border-color rounded-xl font-bold text-base text-white transition-all hover:bg-white/5 hover:border-border-hover flex items-center justify-center gap-2 mb-6"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Open Email App
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-white transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4.5 h-4.5"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
