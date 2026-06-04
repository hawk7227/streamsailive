export type StreamsUsageHelpPageId =
  | "what_are_usage_credits"
  | "how_included_usage_works"
  | "turn_on_usage_credits"
  | "set_spend_controls"
  | "usage_credit_pricing"
  | "manage_usage_balance"
  | "cost_control_tips"
  | "feature_usage_rules"
  | "usage_faq";

export type StreamsUsageHelpPage = {
  id: StreamsUsageHelpPageId;
  navLabel: string;
  title: string;
  summary: string;
  bullets: string[];
  ctaLabel?: string;
};

export const STREAMS_USAGE_HELP_PAGES: StreamsUsageHelpPage[] = [
  { id: "what_are_usage_credits", navLabel: "What are usage credits?", title: "Keep building after included usage runs out", summary: "Usage credits are paid continuation credits for users on paid Streams AI plans.", bullets: ["Free users upgrade first.", "Paid users can keep building with usage credits.", "Included usage resets on a session window.", "Generation and launch actions can cost more than normal chat."], ctaLabel: "View usage limits" },
  { id: "how_included_usage_works", navLabel: "How included usage works", title: "Included usage resets on a rolling session window", summary: "Each plan includes session usage and daily usage. When the included session limit is reached, paid users can continue with usage credits.", bullets: ["Session usage protects heavy compute cost.", "Daily usage protects against abuse.", "Higher plans receive higher limits.", "Usage dashboards should separate included usage from paid usage credits."] },
  { id: "turn_on_usage_credits", navLabel: "Turn on usage credits", title: "Enable paid continuation for serious builders", summary: "Paid users can turn on usage credits so Streams AI can continue after included limits are reached.", bullets: ["Require payment method before enabling.", "Ask for confirmation before paid credits are used.", "Allow users to disable usage credits.", "Show clear balance and reset messaging."], ctaLabel: "Enable usage credits" },
  { id: "set_spend_controls", navLabel: "Set spend controls", title: "Monthly spend limits and auto-reload controls", summary: "Spend controls keep power users building while preventing surprise charges.", bullets: ["Default monthly limit: 100 dollars.", "Maximum self-serve monthly limit: 2000 dollars.", "Default auto-reload trigger: 10 dollars.", "Default top-up amount: 50 dollars."], ctaLabel: "Adjust limit" },
  { id: "usage_credit_pricing", navLabel: "Usage credit pricing", title: "Usage credits sit on top of the subscription", summary: "Subscriptions unlock access and included usage. Usage credits monetize extra consumption after included limits are reached.", bullets: ["Charge more for final outputs than drafts.", "Video, Turn This Into You, website preview, code troubleshooting, and long documents should cost more.", "Credit packs should not replace subscriptions.", "Heavy generation must protect provider and GPU costs."] },
  { id: "manage_usage_balance", navLabel: "Manage usage balance", title: "Balance, reload, history, and alerts", summary: "Users need a usage center that shows included usage, paid balance, spend this month, reload state, and reset time.", bullets: ["Show included usage separately from paid usage credits.", "Show current paid balance and monthly spend.", "Show reset time.", "Warn before switching to paid usage credits."] },
  { id: "cost_control_tips", navLabel: "Cost control tips", title: "Help users spend intelligently without reducing conversion", summary: "Good usage education improves trust while still encouraging serious users to buy credits when they need to continue.", bullets: ["Start fresh for unrelated work.", "Use draft mode before final generation.", "Save project knowledge instead of re-uploading files.", "Run expensive video and launch actions when the concept is ready."] },
  { id: "feature_usage_rules", navLabel: "Usage with features", title: "Different work types consume usage differently", summary: "Streams AI should meter chat, documents, troubleshooting, generation, launch, and team usage separately.", bullets: ["Basic chat uses message limits.", "Business Builder and documents use operator credits.", "Image, voice, captions, and creator tools use studio credits.", "Video and Turn This Into You use premium video credits.", "Website and launch actions use launch credits."] },
  { id: "usage_faq", navLabel: "Frequently asked questions", title: "Usage credit FAQ", summary: "Answer the conversion-critical questions before users hit a limit.", bullets: ["Can I wait instead of paying? Yes, included usage resets.", "Can I keep building immediately? Paid plans can use usage credits.", "Can I set a limit? Yes, monthly limits and reload thresholds apply.", "Do free users get paid usage credits? No, free users upgrade first."] }
];

export function getStreamsUsageHelpPage(id: unknown) {
  return STREAMS_USAGE_HELP_PAGES.find((page) => page.id === id) || STREAMS_USAGE_HELP_PAGES[0];
}
