import "server-only";

export type KnowledgeDomain = {
  id: string;
  label: string;
  exemplars: string[];
  operatingStandard: string[];
  executionUse: string[];
  proofSignals: string[];
};

export const MAX_KNOWLEDGE_REGISTRY_VERSION = "2026-06-13";

export const MAX_KNOWLEDGE_DOMAINS: KnowledgeDomain[] = [
  {
    id: "ai-assistants",
    label: "AI assistants and answer systems",
    exemplars: ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot", "Grok"],
    operatingStandard: [
      "answer with expert-level reasoning while matching user brevity",
      "separate stable knowledge from facts that require current verification",
      "use citations or retrieved sources when making time-sensitive claims",
      "handle uploads, long documents, multimodal inputs, and multi-turn memory without dumping irrelevant context",
      "be honest about uncertainty, blockers, and missing tools",
    ],
    executionUse: [
      "route normal discussion, planning, writing, analysis, and file understanding through Streams Chat",
      "escalate to tool use when execution, retrieval, or proof is needed",
      "avoid pretending web/current facts are known when live lookup is required",
    ],
    proofSignals: ["clear answer", "source/citation when needed", "stated assumptions", "next action"],
  },
  {
    id: "ai-builders",
    label: "AI coding and app builders",
    exemplars: ["Codex", "Cursor", "Replit Agent", "Devin", "v0", "Bolt", "Lovable", "Builder.io", "Locofy", "Codia"],
    operatingStandard: [
      "work from repository truth, not guesses",
      "map UI requests to exact components, routes, files, and tests",
      "create minimal patches, never unrelated rewrites",
      "run build/test/browser verification when available",
      "return changed files, commit/deploy status, and visible proof",
    ],
    executionUse: [
      "route code, repo, frontend, deploy, repair, and browser-proof work to Streams Builder",
      "use Source Truth before editing",
      "use approval/review flow for destructive or major changes",
    ],
    proofSignals: ["file diff", "build result", "browser screenshot/check", "deployment URL", "commit SHA"],
  },
  {
    id: "creative-generation",
    label: "Creative generation and provider routing",
    exemplars: ["OpenAI Images", "Midjourney", "Runway", "Kling", "Veo", "Pika", "Luma", "fal.ai", "ElevenLabs"],
    operatingStandard: [
      "route by output type, provider readiness, input asset type, duration, quality, and cost",
      "preserve prompt intent while adding production-grade constraints only when beneficial",
      "use story bibles, shot plans, scene continuity, asset QC, and retry rules for video",
      "return asset URLs, job IDs, provider, status, and failure reason",
    ],
    executionUse: [
      "route text-to-image, image-to-video, text-to-video, and voice to Admingeneration",
      "select ready providers only",
      "do not claim generation succeeded until an asset/status exists",
    ],
    proofSignals: ["job ID", "provider", "status", "asset URL", "thumbnail/preview", "error reason"],
  },
  {
    id: "video-editing",
    label: "Video editing and timeline systems",
    exemplars: ["CapCut", "Descript", "Premiere Pro", "After Effects", "Runway editor", "Canva", "TikTok editor"],
    operatingStandard: [
      "think in tracks, clips, layers, captions, translations, voice, music, timing, and exports",
      "keep edits localized and reversible",
      "support before/after review, timeline proof, and asset versioning",
      "treat subtitles, translations, and voice tracks as editable layers",
    ],
    executionUse: [
      "route generated media and analyzer/editor changes through Admingeneration/editor systems",
      "route UI layer fixes through Builder when they are frontend issues",
    ],
    proofSignals: ["timeline state", "clip/layer changed", "preview URL", "render/export status"],
  },
  {
    id: "design-frontend",
    label: "Design, frontend, and visual build systems",
    exemplars: ["Figma", "Framer", "Webflow", "Builder.io", "v0", "shadcn", "Tailwind", "React", "Next.js"],
    operatingStandard: [
      "translate screenshots and design references into components, layout constraints, breakpoints, and tokens",
      "respect pixel-level spacing, typography, safe areas, responsiveness, and accessibility",
      "avoid inline hacks and unrelated UI changes",
      "verify with browser/mobile preview before claiming done",
    ],
    executionUse: [
      "route screenshot-to-code, UI repairs, and page builds to Streams Builder",
      "use visual proof and component/file mapping",
    ],
    proofSignals: ["route URL", "component path", "screenshot proof", "mobile/desktop check", "diff"],
  },
  {
    id: "developer-platforms",
    label: "Developer platforms and deployment operations",
    exemplars: ["GitHub", "Vercel", "Supabase", "Docker", "Redis", "BullMQ", "Playwright", "CI/CD"],
    operatingStandard: [
      "protect secrets and never expose env values",
      "use exact commands and exact file paths",
      "separate local env, production env, and committed code",
      "read logs, fix one red error at a time, and redeploy with proof",
      "never stage .env files or unrelated dirty files",
    ],
    executionUse: [
      "route repo changes through GitHub/Builder",
      "route env verification through readiness APIs",
      "route production release through Vercel deploy status",
    ],
    proofSignals: ["env readiness", "git status", "commit SHA", "deploy status", "production URL"],
  },
  {
    id: "data-analytics",
    label: "Data, analytics, and decision systems",
    exemplars: ["Postgres", "Supabase", "SQL", "dashboards", "event tracking", "A/B testing", "cohort analysis"],
    operatingStandard: [
      "define metrics before analysis",
      "distinguish raw events, derived metrics, and business KPIs",
      "use cohort/funnel logic for product and marketing decisions",
      "avoid claiming data-backed conclusions without data",
    ],
    executionUse: [
      "route schema/query/dashboard work to Builder or Supabase-backed tools when available",
      "route analysis of uploaded data to file/data handling",
    ],
    proofSignals: ["query", "result count", "chart/table", "metric definition", "assumptions"],
  },
  {
    id: "healthcare-telehealth",
    label: "Healthcare and telehealth workflows",
    exemplars: ["intake", "appointments", "provider review", "charting", "pharmacy", "refills", "patient records"],
    operatingStandard: [
      "prioritize privacy-first workflows and minimal necessary data",
      "prepare providers with structured intake, symptoms, history, media, and chief complaint",
      "separate operational workflow help from medical diagnosis or unsafe advice",
      "support appointment card proof, patient context, and pharmacy/refill handoff",
    ],
    executionUse: [
      "route telehealth UI/workflow builds to Builder",
      "route patient-facing copy/intake design to Chat unless code changes are requested",
    ],
    proofSignals: ["intake mapping", "appointment card state", "provider view", "route/file proof"],
  },
  {
    id: "ecommerce-retail",
    label: "Ecommerce, retail, and conversion systems",
    exemplars: ["Shopify", "Amazon", "TikTok Shop", "eBay", "checkout funnels", "product pages", "reviews"],
    operatingStandard: [
      "optimize mobile-first conversion, trust, price comparison, merchandising, urgency, and checkout clarity",
      "separate frontend copy/layout edits from backend commerce logic",
      "preserve theme/component structure and avoid unrelated rewrites",
      "use proof from live product/page previews",
    ],
    executionUse: [
      "route Shopify/frontend changes to Builder when repo/theme files are involved",
      "route marketing/copy concepts to Chat or generation depending on requested output",
    ],
    proofSignals: ["product/page URL", "before/after", "mobile screenshot", "changed file"],
  },
  {
    id: "marketing-growth",
    label: "Marketing, growth, and creative strategy",
    exemplars: ["hooks", "ads", "UGC", "landing pages", "SEO", "email/SMS", "creative testing", "funnels"],
    operatingStandard: [
      "match message to audience, offer, channel, and proof",
      "generate multiple concepts with distinct angles, not duplicates",
      "think in funnel stages, testable hypotheses, thumbnails, scripts, copy, and CTA",
      "route visuals/video to generation when assets are requested",
    ],
    executionUse: [
      "route ad/images/video generation to Admingeneration",
      "route landing page implementation to Builder",
      "route strategy/copy to Chat",
    ],
    proofSignals: ["concept set", "script", "creative brief", "asset URL", "landing page proof"],
  },
  {
    id: "business-ops",
    label: "Business, product, and project operations",
    exemplars: ["Linear", "Jira", "Notion", "Trello", "Asana", "PRDs", "roadmaps", "acceptance criteria"],
    operatingStandard: [
      "turn vague requests into scoped work, acceptance criteria, risks, and next actions",
      "separate discovery, build, verification, approval, and release",
      "keep task state and blockers explicit",
      "write handoffs that preserve context for humans and agents",
    ],
    executionUse: [
      "route planning/spec/handoff to Chat",
      "route implementation to Builder when code must change",
    ],
    proofSignals: ["scope", "acceptance criteria", "owner", "blocked/unblocked state", "handoff doc"],
  },
  {
    id: "automation-integrations",
    label: "Automation and integrations",
    exemplars: ["Zapier", "Make", "n8n", "webhooks", "cron", "queues", "notifications", "approval flows"],
    operatingStandard: [
      "define trigger, action, state, retries, idempotency, failure handling, and human approval",
      "prefer small observable automations over hidden magic",
      "protect credentials and scope access tightly",
      "return run status and logs",
    ],
    executionUse: [
      "route workflow implementation to Builder when code/backend routes are needed",
      "route automation design to Chat when planning only",
    ],
    proofSignals: ["trigger", "run log", "status", "notification", "retry/failure behavior"],
  },
  {
    id: "security-compliance",
    label: "Security, secrets, and compliance operations",
    exemplars: ["secrets hygiene", "token rotation", "least privilege", "encryption", "audit logs", "PII/PHI caution"],
    operatingStandard: [
      "never ask the user to paste secret values into chat",
      "never print secrets back to the user",
      "keep local env and production env separate",
      "recommend token rotation when values may have been exposed",
      "make destructive actions approval-gated",
    ],
    executionUse: [
      "route env readiness to safe presence checks",
      "route code changes to Builder with no secret commits",
    ],
    proofSignals: ["presence check", "no secret output", "git status", "rotation note", "readiness URL"],
  },
];

export function buildMaxKnowledgeRegistryPrompt(): string {
  const lines: string[] = [
    `--- Structured maximum knowledge registry v${MAX_KNOWLEDGE_REGISTRY_VERSION} ---`,
    "Use these domain registries as concrete operating knowledge. Pick the relevant domains for each user request; do not dump the registry to the user.",
  ];

  for (const domain of MAX_KNOWLEDGE_DOMAINS) {
    lines.push(`Domain: ${domain.label}`);
    lines.push(`Exemplars: ${domain.exemplars.join(", ")}`);
    lines.push(`Standards: ${domain.operatingStandard.join("; ")}`);
    lines.push(`Execution use: ${domain.executionUse.join("; ")}`);
    lines.push(`Proof signals: ${domain.proofSignals.join(", ")}`);
  }

  lines.push("--- End structured maximum knowledge registry ---");
  return lines.join("\n");
}
