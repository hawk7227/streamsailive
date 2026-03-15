"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CTA from "@/components/home/CTA";
import { useState, type ReactNode } from "react";
import { ALL_PLANS, type PlanKey } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [checkoutError, setCheckoutError] = useState("");
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const { user } = useAuth();

  const planVisuals: Record<
    PlanKey,
    { iconBg: string; ctaClassName: string; icon: ReactNode }
  > = {
    free: {
      iconBg: "from-zinc-600 to-zinc-700",
      ctaClassName:
        "block w-full py-3.5 rounded-xl font-bold text-center bg-bg-tertiary border border-border-color text-white mb-6 transition-all hover:bg-white/5",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-white">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    starter: {
      iconBg: "from-blue-500 to-blue-600",
      ctaClassName:
        "block w-full py-3.5 rounded-xl font-bold text-center bg-bg-tertiary border border-border-color text-white mb-6 transition-all hover:bg-white/5",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-white">
          <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.915a2 2 0 00-1.272 1.272L12 21l-1.912-5.813a2 2 0 00-1.272-1.272L3 12l5.816-1.915a2 2 0 001.272-1.272L12 3z" />
        </svg>
      ),
    },
    professional: {
      iconBg: "from-accent-indigo to-accent-purple",
      ctaClassName:
        "block w-full py-3.5 rounded-xl font-bold text-center bg-gradient-to-r from-accent-indigo to-accent-purple text-white mb-6 transition-all hover:shadow-[0_8px_30px_rgba(99,102,241,0.4)]",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-white">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
    },
    enterprise: {
      iconBg: "from-purple-500 to-purple-600",
      ctaClassName:
        "block w-full py-3.5 rounded-xl font-bold text-center bg-bg-tertiary border border-border-color text-white mb-6 transition-all hover:bg-white/5",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-white">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
    },
  };

  const handleCheckout = async (planKey: PlanKey) => {
    setCheckoutError("");
    setPendingPlan(planKey);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, billing }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to start checkout");
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Missing checkout session URL");
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Unable to start checkout"
      );
      setPendingPlan(null);
    }
  };

  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 text-center">
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-[clamp(36px,5vw,56px)] font-extrabold mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-text-secondary mb-10">
              Start free, scale as you grow. No hidden fees.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-4 bg-bg-secondary border border-border-color rounded-2xl p-2 mb-16">
              <button
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  billing === "monthly"
                    ? "bg-white text-black"
                    : "text-text-secondary hover:text-white"
                }`}
                onClick={() => setBilling("monthly")}
              >
                Monthly
              </button>
              <button
                className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  billing === "yearly"
                    ? "bg-white text-black"
                    : "text-text-secondary hover:text-white"
                }`}
                onClick={() => setBilling("yearly")}
              >
                Yearly
                <span className="bg-[#10b9811a] text-accent-emerald text-xs font-bold px-2.5 py-1 rounded-full">
                  Save 17%
                </span>
              </button>
            </div>

            {checkoutError && (
              <p className="text-sm text-accent-red mb-6">{checkoutError}</p>
            )}

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
              {ALL_PLANS.map((plan) => {
                const visual = planVisuals[plan.key];
                const price = plan.prices[billing];
                const isCustom = price === null;
                const canCheckout =
                  !!user && plan.key !== "free" && plan.key !== "enterprise";
                const isPending = pendingPlan === plan.key;
                const ctaHref =
                  user && plan.key === "free" ? "/dashboard" : plan.ctaHref;
                const cardClassName = plan.isPopular
                  ? "bg-bg-secondary border border-accent-indigo rounded-3xl p-8 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(99,102,241,0.2)] text-left relative transform scale-105"
                  : "bg-bg-secondary border border-border-color rounded-3xl p-8 transition-all hover:border-border-hover hover:-translate-y-1 text-left";

                return (
                  <div key={plan.key} className={cardClassName}>
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent-indigo to-accent-purple text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                        {plan.badge}
                      </div>
                    )}
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${visual.iconBg} flex items-center justify-center mb-5`}
                    >
                      {visual.icon}
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-text-secondary text-sm mb-5">
                      {plan.description}
                    </p>
                    <div className="mb-6">
                      {isCustom ? (
                        <span className="text-4xl font-bold text-text-secondary">
                          Custom
                        </span>
                      ) : (
                        <>
                          <span className="text-5xl font-extrabold">
                            ${price}
                          </span>
                          <span className="text-text-muted text-sm">/month</span>
                        </>
                      )}
                    </div>
                    {canCheckout ? (
                      <button
                        type="button"
                        onClick={() => handleCheckout(plan.key)}
                        disabled={isPending}
                        className={`${visual.ctaClassName} ${
                          isPending ? "opacity-70 cursor-not-allowed" : ""
                        }`}
                      >
                        {isPending ? "Redirecting..." : plan.cta}
                      </button>
                    ) : (
                      <a href={ctaHref} className={visual.ctaClassName}>
                        {plan.cta}
                      </a>
                    )}
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-3 text-sm text-text-secondary"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4 text-accent-emerald flex-shrink-0"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 text-center">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-text-secondary mb-12">
              Everything you need to know about our pricing
            </p>

            <div className="space-y-4 text-left">
              {[
                {
                  q: "Can I try before I buy?",
                  a: "Yes! Our free tier gives you 10 generations per month to try the platform. All paid plans also include a 14-day free trial with full access to all features.",
                },
                {
                  q: "What counts as a generation?",
                  a: "One generation equals one output from any of our AI tools. This could be a video, an image, a voiceover, or a script. Each time you create something new, it counts as one generation.",
                },
                {
                  q: "Can I change plans anytime?",
                  a: "Absolutely! You can upgrade, downgrade, or cancel your plan at any time. When you upgrade, you get immediate access to new features. When you downgrade, changes take effect at the end of your billing cycle.",
                },
              ].map((faq, i) => (
                <details
                  key={i}
                  className="group bg-bg-secondary border border-border-color rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer font-semibold group-hover:text-accent-indigo transition-colors">
                    {faq.q}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-5 h-5 text-text-muted transition-transform group-open:rotate-180"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6 text-text-secondary leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </>
  );
}
