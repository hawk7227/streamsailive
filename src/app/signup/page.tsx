"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Github } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type PlanKey = "free" | "go" | "plus" | "pro";

type Plan = {
  key: PlanKey;
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
};

const plans: Plan[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    description: "For individuals getting started.",
    features: ["A.S.K. AI access", "Personal workspace", "Basic creation tools", "1 GB storage"],
    cta: "Get Started",
  },
  {
    key: "go",
    name: "Go",
    price: "$9",
    description: "More power for everyday creators.",
    features: ["Everything in Free", "More A.S.K. AI messages", "10 GB storage", "Basic premium tools"],
    cta: "Choose Go",
  },
  {
    key: "plus",
    name: "Plus",
    price: "$29",
    description: "Create more. Build faster.",
    features: ["Everything in Go", "Advanced tools", "100 GB storage", "Priority processing"],
    cta: "Choose Plus",
    popular: true,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$99",
    description: "For professionals and power users.",
    features: ["Everything in Plus", "Maximum A.S.K. AI access", "1 TB storage", "Advanced analytics"],
    cta: "Choose Pro",
  },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.8 6.8 0 015.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 001 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function SignupPageContent() {
  const searchParams = useSearchParams();
  const initialPlan = (searchParams.get("plan") || "free") as PlanKey;
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(plans.some((plan) => plan.key === initialPlan) ? initialPlan : "free");
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({ fullName: "", email: "", password: "", confirmPassword: "", orgName: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://streamsailive.vercel.app").replace(/\/$/, "");

  useEffect(() => {
    if (user && step === 1 && !isOtpSent) setStep(2);
  }, [user, step, isOtpSent]);

  const choosePlan = (plan: PlanKey) => {
    setSelectedPlan(plan);
    document.getElementById("create-account")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleOAuthSignup = async (provider: "google" | "github") => {
    setIsLoading(true);
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${appUrl}/auth/callback?next=/streams-ai&plan=${selectedPlan}` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setIsLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (isOtpSent) {
      if (otp.length !== 8) return setError("Enter the complete 8-digit verification code.");
      setIsLoading(true);
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: formData.email, token: otp, type: "email" });
      setIsLoading(false);
      if (verifyError) return setError(verifyError.message);
      setIsOtpSent(false);
      setStep(2);
      return;
    }

    if (!formData.fullName || !formData.email || !formData.password) return setError("Please fill in all required fields.");
    if (formData.password !== formData.confirmPassword) return setError("Passwords do not match.");
    if (formData.password.length < 6) return setError("Password must be at least 6 characters.");

    setIsLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=/streams-ai&plan=${selectedPlan}`,
        data: { full_name: formData.fullName, selected_plan: selectedPlan },
      },
    });
    setIsLoading(false);
    if (signUpError) return setError(signUpError.message);
    if (data.user && !data.session) {
      setIsOtpSent(true);
      setNotice("We sent an 8-digit verification code to your email.");
    } else if (data.session) {
      setStep(2);
    } else {
      setError("Failed to create account. Please try again.");
    }
  };

  const handleWorkspaceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.orgName.trim()) return setError("Please enter a workspace name.");
    if (!user) return setError("Please verify your email first.");
    setIsLoading(true);
    setError("");
    const { error: profileError } = await updateProfile({ full_name: formData.fullName, org_name: formData.orgName.trim() });
    if (profileError) {
      setIsLoading(false);
      return setError(profileError);
    }
    try {
      const response = await fetch("/api/team/ensure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: selectedPlan }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to create workspace");
      router.push("/streams-ai");
    } catch (workspaceError) {
      setError(workspaceError instanceof Error ? workspaceError.message : "Failed to create workspace.");
      setIsLoading(false);
    }
  };

  const inputClass = "w-full border-0 border-b border-white/15 bg-transparent px-0 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400";

  return (
    <main className="signup-scroll-root min-h-dvh bg-[#020713] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[.06] bg-[#020713e8] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-[1680px] items-center justify-between px-5 sm:px-8 lg:px-[clamp(2rem,4vw,5rem)]">
          <Link href="/" className="flex items-center gap-3 font-extrabold tracking-[.04em]" aria-label="Streams AI home">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-blue-500/40 bg-blue-950/50 shadow-[0_0_22px_rgba(34,211,238,.28)]"><span className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_14px_#22d3ee]" /></span>
            STREAMS AI
          </Link>
          <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white">Sign in</Link>
        </div>
      </header>

      <section className="px-5 pb-14 pt-12 sm:px-8 sm:pt-16 lg:px-[clamp(2rem,4vw,5rem)]">
        <div className="mx-auto w-full max-w-[1480px]">
          <div className="text-center">
            <h1 className="text-[clamp(1.8rem,4vw,3.25rem)] font-semibold tracking-[-.04em]">Choose the plan that fits your journey.</h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">Start free. Upgrade anytime.</p>
          </div>

          <div className="mt-9 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
              const active = selectedPlan === plan.key;
              return (
                <article key={plan.key} className={`relative flex min-h-[22rem] flex-col border-t pt-5 ${active ? "border-violet-400" : "border-white/12"}`}>
                  {plan.popular && <span className="absolute -top-3 right-0 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold">Most Popular</span>}
                  <h2 className="text-xl font-medium text-cyan-300">{plan.name}</h2>
                  <p className="mt-3"><span className={`text-4xl font-semibold ${plan.key === "plus" || plan.key === "pro" ? "text-violet-400" : "text-blue-400"}`}>{plan.price}</span><span className="ml-1 text-xs text-slate-500">/month</span></p>
                  <p className="mt-3 min-h-11 text-sm leading-5 text-slate-400">{plan.description}</p>
                  <ul className="mt-6 space-y-3 text-sm text-slate-300">
                    {plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />{feature}</li>)}
                  </ul>
                  <button type="button" onClick={() => choosePlan(plan.key)} aria-pressed={active} className={`mt-auto inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${active ? "bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white shadow-[0_10px_28px_rgba(79,70,229,.25)]" : "border border-white/15 text-white hover:border-white/30"}`}>{active ? `${plan.name} selected` : plan.cta}</button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="create-account" className="scroll-mt-20 border-t border-white/[.06] px-5 py-14 sm:px-8 lg:px-[clamp(2rem,4vw,5rem)]">
        <div className="mx-auto grid w-full max-w-[1180px] gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-400">{plans.find((plan) => plan.key === selectedPlan)?.name} plan</span>
            <h2 className="mt-4 text-[clamp(2rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-.05em]">Create your Streams Workspace.</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">Your individual account includes A.S.K. AI, a personal workspace, projects, files, memory, and access to premium Streams capabilities.</p>
          </div>

          <div>
            {step === 1 ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => handleOAuthSignup("google")} disabled={isLoading} className="inline-flex min-h-12 flex-1 items-center justify-center gap-3 rounded-lg border border-white/15 px-5 text-sm font-semibold hover:border-white/30 disabled:opacity-50"><GoogleIcon />Continue with Google</button>
                  <button type="button" onClick={() => handleOAuthSignup("github")} disabled={isLoading} className="inline-flex min-h-12 flex-1 items-center justify-center gap-3 rounded-lg border border-white/15 px-5 text-sm font-semibold hover:border-white/30 disabled:opacity-50"><Github className="h-5 w-5" />Continue with GitHub</button>
                </div>
                <div className="my-7 flex items-center gap-4 text-xs uppercase tracking-widest text-slate-600"><span className="h-px flex-1 bg-white/10" />or use email<span className="h-px flex-1 bg-white/10" /></div>

                <form onSubmit={handleSignup} className="space-y-5">
                  {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
                  {notice && <p role="status" className="text-sm text-cyan-300">{notice}</p>}
                  {isOtpSent ? (
                    <>
                      <label className="block"><span className="text-sm text-slate-400">Verification code sent to {formData.email}</span><input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} className={`${inputClass} text-center text-2xl tracking-[.35em]`} placeholder="00000000" maxLength={8} required /></label>
                      <button type="submit" disabled={isLoading || otp.length !== 8} className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 text-sm font-bold disabled:opacity-50">{isLoading ? "Verifying…" : "Verify email"}</button>
                      <button type="button" onClick={async () => { setIsLoading(true); setError(""); const { error: resendError } = await supabase.auth.signInWithOtp({ email: formData.email, options: { shouldCreateUser: false } }); setIsLoading(false); resendError ? setError(resendError.message) : setNotice("Verification code resent."); }} className="w-full text-center text-sm text-cyan-400">Resend verification code</button>
                    </>
                  ) : (
                    <>
                      <label className="block"><span className="text-sm text-slate-400">Full name</span><input className={inputClass} value={formData.fullName} onChange={(event) => setFormData({ ...formData, fullName: event.target.value })} autoComplete="name" placeholder="Your name" required /></label>
                      <label className="block"><span className="text-sm text-slate-400">Email address</span><input type="email" className={inputClass} value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} autoComplete="email" placeholder="you@company.com" required /></label>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <label className="block"><span className="text-sm text-slate-400">Password</span><input type="password" className={inputClass} value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} autoComplete="new-password" placeholder="At least 6 characters" minLength={6} required /></label>
                        <label className="block"><span className="text-sm text-slate-400">Confirm password</span><input type="password" className={inputClass} value={formData.confirmPassword} onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })} autoComplete="new-password" placeholder="Repeat password" minLength={6} required /></label>
                      </div>
                      <button type="submit" disabled={isLoading} className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 text-sm font-bold shadow-[0_10px_30px_rgba(79,70,229,.25)] disabled:opacity-50">{isLoading ? "Creating account…" : "Create account"}</button>
                    </>
                  )}
                </form>
              </>
            ) : (
              <form onSubmit={handleWorkspaceSubmit} className="space-y-6">
                {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
                <div><span className="text-sm font-semibold text-cyan-400">Account verified</span><h3 className="mt-2 text-2xl font-semibold">Name your workspace</h3><p className="mt-2 text-sm leading-6 text-slate-500">This can be your name, company, team, or project. You can change it later.</p></div>
                <label className="block"><span className="text-sm text-slate-400">Workspace name</span><input className={inputClass} value={formData.orgName} onChange={(event) => setFormData({ ...formData, orgName: event.target.value })} placeholder="My Workspace" required autoFocus /></label>
                <button type="submit" disabled={isLoading} className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 text-sm font-bold disabled:opacity-50">{isLoading ? "Preparing workspace…" : "Enter Streams Workspace"}</button>
              </form>
            )}
            <p className="mt-7 text-center text-xs leading-5 text-slate-600">By creating an account, you agree to the Terms of Service and Privacy Policy.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function SignupPage() {
  return <Suspense fallback={<main className="min-h-dvh bg-[#020713]" />}><SignupPageContent /></Suspense>;
}
