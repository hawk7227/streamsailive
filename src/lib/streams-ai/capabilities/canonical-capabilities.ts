export type CapabilityExecutionStatus = "reasoning_ready" | "wired" | "implemented_unproven" | "blocked" | "external_tool_required";

export type StreamsAICapability = {
  id: string;
  title: string;
  summary: string;
  status: CapabilityExecutionStatus;
  proof: string;
};

export const STREAMS_CANONICAL_CAPABILITIES_VERSION = "2026-05-20.canonical.v1";

export const STREAMS_CANONICAL_CAPABILITIES: StreamsAICapability[] = [
  { id: "core.model", title: "Core OpenAI Reasoning", summary: "Deep reasoning, planning, code analysis, architecture design, debugging, structured writing, and safe reasoning summaries.", status: "wired", proof: "Live assistant route uses server-side OpenAI Responses API path." },
  { id: "core.streaming", title: "Live Chat Streaming", summary: "SSE activity/response/complete/error events, smooth token pacing, status text, and persisted assistant messages.", status: "wired", proof: "Streams chat runtime and /api/streams-ai/messages route are wired." },
  { id: "core.memory", title: "Session Message Context", summary: "Recent persisted messages are loaded into OpenAI context for continuity.", status: "wired", proof: "messages repository is read before OpenAI call." },
  { id: "core.truth", title: "Strict Truthfulness and Anti-Overclaiming", summary: "Classifies work as Proven, Implemented but unproven, Blocked, or Rejected. No fake provider, worker, storage, preview, or output claims.", status: "wired", proof: "System instructions and STREAMS project rules enforce proof-aware claims." },
  { id: "core.nofake", title: "No Fake Layers Build Mode", summary: "Rejects mocks, fake progress, placeholder outputs, route-as-worker claims, and UI-only capability claims when production proof is missing.", status: "wired", proof: "Configured as a project-specific STREAMS rule." },
  { id: "core.capability_registry", title: "Canonical Capability Registry", summary: "Answers capability questions from a canonical STREAMS source instead of generic assistant memory.", status: "wired", proof: "This registry file is the canonical source for capability answers." },

  { id: "dev.codebase_inspection", title: "Codebase Inspection", summary: "Inspect folder structure, file responsibility, imports, duplicate logic, dead files, unused components, fake components, stubs, mock data, bad types, broken async flow, and local-only assumptions.", status: "reasoning_ready", proof: "Available through OpenAI reasoning and connected repository/file context when provided." },
  { id: "dev.full_file", title: "Full-File Replacement", summary: "Generate complete directly replaceable .tsx, .ts, .jsx, .js, .css, .liquid, .sql, config, shell, test, route, repository, and component files.", status: "reasoning_ready", proof: "Assistant can write full files; execution requires repo/file tool access." },
  { id: "dev.patch_diff", title: "Patch and Diff Work", summary: "Create manual patches, git-style diffs, targeted replacements, bash patch scripts, and patch troubleshooting guidance.", status: "reasoning_ready", proof: "Assistant can generate and apply GitHub patches when repository tool access is available." },
  { id: "dev.terminal", title: "Terminal Walkthrough", summary: "Guide Git Bash, PowerShell, Windows paths, npm/pnpm/node/git/vercel/supabase/curl, env files, test commands, and build commands.", status: "reasoning_ready", proof: "Available through reasoning; local execution requires user terminal or connected environment." },
  { id: "dev.errors", title: "Error Log Diagnosis", summary: "Diagnose browser console, terminal, TypeScript, ESLint, Next.js, Vercel, API, Supabase, OpenAI, fal, Runway, ElevenLabs, Git, Playwright, network, CORS, and auth errors.", status: "reasoning_ready", proof: "Requires pasted logs/screenshots or connected source data." },
  { id: "dev.playwright", title: "Playwright / E2E Testing", summary: "Generate tests for page loads, chat send, streaming, preview panel, drag/resize, upload, login modes, media rendering, mobile viewport, console/network failures, and smoke tests.", status: "reasoning_ready", proof: "Assistant can write tests; running them requires environment access." },
  { id: "dev.api_contracts", title: "API Contract Design", summary: "Define request/response shapes, errors, status codes, auth, provider fields, job IDs, asset IDs, session IDs, SSE/WebSocket envelopes, and persistence requirements.", status: "reasoning_ready", proof: "Available through architecture/design reasoning." },
  { id: "dev.github", title: "Git / GitHub Workflow", summary: "Branch checks, commit status, diffs, remotes, pushing, repo state, Vercel connection, PRs, issues, and source audits when connected.", status: "external_tool_required", proof: "GitHub connector required for live repo actions." },

  { id: "runtime.openapi", title: "OpenAI API / Responses API", summary: "Responses API, streaming, tool calling, structured outputs, function calls, vision/file inputs, prompt rewriting, model routing, continuation, cost controls, and latency optimization.", status: "wired", proof: "STREAMS chat uses server-side OpenAI Responses API path." },
  { id: "runtime.tools", title: "Tool Orchestration", summary: "Tool registry, tool schema, permissions, execution, result normalization, result streaming, retries, continuation, timeout handling, and output rendering.", status: "implemented_unproven", proof: "Approved backend tool execution exists for jobs/assets/provider_runs; full general registry remains a future hardening layer." },
  { id: "runtime.agent", title: "Agent Runtime", summary: "Planner, router, context builder, memory retriever, tool executor, stream transformer, state machine, job creator, worker dispatcher, provider caller, artifact creator, preview updater, event logger, and final response composer.", status: "implemented_unproven", proof: "Pieces exist; full centralized orchestrator module is not fully refactored/proven." },
  { id: "runtime.context", title: "Context Engineering", summary: "Minimal context loading, intent classification, file relevance scoring, summaries, project context, cache strategy, context budgeting, and avoiding full-codebase dumps.", status: "implemented_unproven", proof: "Recent messages are loaded; full retrieval/cache layer is not fully proven." },
  { id: "runtime.rag", title: "RAG / Retrieval", summary: "Codebase search, uploaded docs, knowledge bases, product docs, internal specs, support articles, provider docs, project memory, citations, chunking, filters, ranking, and freshness rules.", status: "external_tool_required", proof: "Requires file/search/vector infrastructure for execution." },
  { id: "runtime.websocket", title: "WebSocket Control Plane", summary: "Session attach/resume, turn start/cancel/complete, tool events, errors, ping/pong, reconnect, backpressure, flow control, single active turn, multi-tab, and durable recovery.", status: "blocked", proof: "Target architecture documented; current primary route is SSE/HTTP, not full WebSocket control plane." },
  { id: "runtime.sse", title: "SSE Streaming", summary: "Token deltas, status events, tool events, completion events, error events, keepalive concepts, parser logic, AbortController cancellation, and chunk smoothing.", status: "wired", proof: "Existing /api/streams-ai/messages route and frontend parser use SSE event names." },
  { id: "runtime.turns", title: "Turn State Persistence", summary: "Dedicated turn records, trace IDs, timing metrics, status transitions, cancellation, and final persistence state.", status: "blocked", proof: "Messages/jobs/tool calls exist; dedicated assistant_turns table is not proven." },

  { id: "infra.supabase", title: "Supabase Persistence", summary: "Postgres schema, storage buckets, signed/public URLs, service role, RLS planning, migrations, repositories, job tables, asset tables, project tables, provider runs, events, and runtime verification.", status: "wired", proof: "STREAMS repositories use Supabase service client and streams schema." },
  { id: "infra.vercel", title: "Vercel Deployment", summary: "Builds, env vars, previews, production deploys, route visibility, Next.js output, serverless limits, runtime selection, logs, branch deploys, and GitHub integration.", status: "wired", proof: "Recent commits are deployed through Vercel status checks." },
  { id: "infra.security", title: "Security Review", summary: "API keys, client secret leakage, unsafe env, open routes, weak test mode, CORS, auth, ownership, upload safety, provider callbacks, prompt injection, SSRF-style risk, RLS, and rate limits.", status: "implemented_unproven", proof: "Worker auth was hardened; full app security audit still requires runtime/config review." },
  { id: "infra.env", title: "Environment Variables", summary: "OPENAI_API_KEY, Supabase keys, FAL_KEY/FAL_API_KEY, Runway, ElevenLabs, TEST_USER_ID, provider models, public/private env, local vs Vercel env, and proof blockers.", status: "reasoning_ready", proof: "Assistant can audit and explain; actual values are hidden unless user provides proof." },
  { id: "infra.observability", title: "Observability", summary: "Request IDs, session IDs, turn IDs, job IDs, provider run IDs, asset IDs, timing, model used, tool calls, provider/storage/database latency, errors, retries, and costs.", status: "implemented_unproven", proof: "Job events/provider runs exist; full trace/timing/cost dashboard is not proven." },

  { id: "media.provider_router", title: "Multi-Provider Routing", summary: "Backend chooses fal, Runway, Kling, Veo, ElevenLabs, or OpenAI media based on mode, cost, quality, speed, availability, aspect ratio, duration, input/output type, and retry strategy.", status: "implemented_unproven", proof: "Image worker uses fal; full provider router for all modes is not proven." },
  { id: "media.image_generation", title: "Image Generation", summary: "Prompt to durable job, provider execution, storage upload, asset row, preview URL, and no temporary provider URL as source of truth.", status: "implemented_unproven", proof: "Image job worker and storage/asset path are implemented; runtime/output proof still required." },
  { id: "media.video_generation", title: "Video Generation", summary: "Text-to-video and image-to-video jobs through Runway/Kling/Veo/fal, provider runs, storage, video asset, preview, and lifecycle events.", status: "blocked", proof: "Architecture is defined; full video worker/provider/storage chain is not proven." },
  { id: "media.voice_audio", title: "Voice and Audio", summary: "Voice generation, TTS, audio processing, ElevenLabs/OpenAI/fal routing, speech workflows, and audio asset persistence.", status: "blocked", proof: "Architecture is defined; production voice/audio worker chain is not proven." },
  { id: "media.music", title: "Music / Song", summary: "Song concepts, lyrics, hooks, music prompts, background music direction, and provider-based generation when wired.", status: "reasoning_ready", proof: "Creative planning is available; production generation tools are not fully wired." },
  { id: "media.asset_system", title: "Media Asset System", summary: "Uploaded, generated, derived assets, thumbnails, preview URLs, storage keys, metadata, project/job/provider ownership, lineage, deletion, and versioning.", status: "implemented_unproven", proof: "STREAMS AI assets repository exists; full lineage/versioning/deletion proof is not complete." },
  { id: "media.jobs", title: "Durable Job System", summary: "Job creation, status, events, cancellation, worker pickup, retries, failures, dead-letter behavior, provider association, output association, UI status, and no fake progress.", status: "implemented_unproven", proof: "Jobs/events/cron worker exist for image_generation; cancellation/retry/dead-letter and all modes are not fully proven." },
  { id: "media.worker", title: "Worker System", summary: "Durable queue workers, provider workers, video/audio/FFmpeg workers, webhook handlers, polling, retry, cleanup, and health checks.", status: "implemented_unproven", proof: "Vercel cron worker exists for image_generation; full worker family is not complete." },

  { id: "ui.preview", title: "Preview System", summary: "Artifact/image/video/code/HTML/React/mobile/desktop preview, split-pane, slide-out, drag-resize, lifecycle, persistence, session ownership, tracing, errors, loading states, and real artifact connection.", status: "implemented_unproven", proof: "Existing preview UI exists; final rendering from all stored asset types needs proof." },
  { id: "ui.artifacts", title: "Artifact System", summary: "Code, documents, images, videos, audio, HTML, React components, reports, specs, edited files, versions, storage, renderer, download, and edit history.", status: "implemented_unproven", proof: "Some artifact paths exist; full artifact versioning/download/edit history is not proven." },
  { id: "ui.editor", title: "Editor Systems", summary: "Image editor, video editor, text/code editor, timeline, node editor, inspector, layers/effects, command bus, undo/redo, selection, tool state, asset binding, and export.", status: "blocked", proof: "Target is documented; first-class production editors are not fully wired." },
  { id: "ui.video_editor", title: "Video Editor", summary: "Timeline tracks, clips, frames, audio, captions, transitions, trim/split/cut/move, ripple edit, layers, effects, masks, partial regeneration, segment replacement, export, proxies, and render.", status: "blocked", proof: "Architecture target exists; production implementation is not proven." },
  { id: "ui.image_editor", title: "Image Editor", summary: "Canvas, layers, selection, crop, resize, masks, inpaint/outpaint, background removal, object removal/replacement, adjustments, prompt-guided edits, version history, export, storage, and undo/redo.", status: "blocked", proof: "Architecture target exists; production implementation is not proven." },
  { id: "ui.mobile", title: "Mobile Web", summary: "iPhone viewport sizing, dynamic island, safe areas, visualViewport, keyboard handling, composer docking, touch targets, scroll locking, fixed-position quirks, PWA-like layout, and mobile previews.", status: "reasoning_ready", proof: "Can design/audit; runtime proof requires browser/mobile tests." },
  { id: "ui.accessibility", title: "Accessibility", summary: "Keyboard navigation, focus states, ARIA, button semantics, contrast, readability, reduced motion, screen reader labels, touch target size, errors, form labels, and modal focus traps.", status: "reasoning_ready", proof: "Can audit/design; runtime proof requires tests." },
  { id: "ui.design_to_code", title: "Design-to-Code", summary: "Convert screenshots/wireframes/Figma-like descriptions into React/Tailwind/Shopify layouts and identify hierarchy, alignment, spacing, contrast, mobile proportion, and polish issues.", status: "reasoning_ready", proof: "Available through vision/reasoning; code execution requires repo/file path." },

  { id: "biz.shopify", title: "Shopify / E-commerce", summary: "Intent-aware merchandising, product pages, collection strips, Best Buy-inspired UI, Liquid snippets/sections, pricing, reviews, compare blocks, safe mobile layout, and conversion logic.", status: "reasoning_ready", proof: "Can advise/write code; store execution requires theme files or connected repo." },
  { id: "biz.marketplace", title: "Marketplace / eBay Seller", summary: "Appeals, listing copy, defect explanations, account health arguments, upload issue documentation, support escalation, buyer messages, returns, and performance plans.", status: "reasoning_ready", proof: "Can write policy-style drafts; outcome not guaranteed." },
  { id: "biz.marketing", title: "Marketing / SEO / Product Copy", summary: "Landing pages, headlines, CTAs, ads, email/SMS/social copy, product listings, SEO titles/meta, keyword grouping, internal linking, and conversion copy.", status: "reasoning_ready", proof: "Available through writing/reasoning." },
  { id: "biz.strategy", title: "Business Model and Strategy", summary: "SaaS structure, AI pricing, feature tiers, module separation, signups, positioning, MVP vs production slice, provider cost control, launch plan, and packaging.", status: "reasoning_ready", proof: "Available through reasoning." },

  { id: "personal.gmail", title: "Gmail Workflow", summary: "Search/read emails, threads, attachments, drafts, updates, sending, forwarding, labeling, archiving, deleting, and evidence collection when connected.", status: "external_tool_required", proof: "Requires Gmail connector and user authorization." },
  { id: "personal.calendar", title: "Calendar Workflow", summary: "Search, create, update, delete events, respond to invites, find availability, add Meet links, and create recurring events when connected.", status: "external_tool_required", proof: "Requires Calendar connector and user authorization." },
  { id: "personal.contacts", title: "Contacts Workflow", summary: "Find contacts and use contact info for drafts or calendar invites when connected.", status: "external_tool_required", proof: "Requires Contacts connector." },
  { id: "personal.reminders", title: "Reminders and Automations", summary: "One-time, recurring, daily, weekly, monthly, and conditional scheduled checks.", status: "external_tool_required", proof: "Requires automation tool in the ChatGPT environment or STREAMS implementation." },

  { id: "files.documents", title: "Documents / PDFs / Spreadsheets / Slides", summary: "Create and edit documents, PDFs, Excel/CSV spreadsheets, formulas, charts, and presentation decks when tools are available.", status: "external_tool_required", proof: "Requires artifact/document/spreadsheet/slides tool path." },
  { id: "files.library", title: "File Library Search", summary: "Find recent uploads, PDFs, spreadsheets, slides, images, docs, answer from files, and cite file lines when available.", status: "external_tool_required", proof: "Requires file-search or STREAMS file retrieval path." },
  { id: "files.upload", title: "Upload and Extraction", summary: "Images, videos, audio, documents, PDFs, ZIPs, reference assets, product images, file type validation, size limits, storage, metadata, and preview generation.", status: "implemented_unproven", proof: "Some upload routes exist; full extraction/preview for all file types is not proven." },

  { id: "ops.quality_gates", title: "Quality Gates", summary: "Checks whether provider returned output, output saved to storage, DB record exists, UI renders stored result, job status came from real events, fake fallback removed, tests passed, logs show provider path, and Vercel deployed same code.", status: "reasoning_ready", proof: "Can define/audit; automated gate runner not fully proven." },
  { id: "ops.smoke_tests", title: "Smoke Tests", summary: "App loads, API responds, env exists, DB insert works, storage upload works, provider call works, generated output renders, job completes, browser shows final asset.", status: "reasoning_ready", proof: "Can generate tests; execution requires runtime/test runner." },
  { id: "ops.contractor_audit", title: "Developer / Contractor Audit", summary: "Scope, audit checklist, fix checklist, file list, test list, proof demands, definition of done, red flags, milestone gates, and review classifications.", status: "reasoning_ready", proof: "Available through reasoning and file/repo inspection." },
  { id: "ops.frozen_architecture", title: "Frozen Architecture / AI Governance", summary: "Locks folder structure, state patterns, component grammar, API contracts, data flow, design system, naming, provider interfaces, error contracts, tests, allowed components, and forbidden patterns.", status: "reasoning_ready", proof: "Can create governance specs; enforcement requires build tooling/tests." },
  { id: "ops.health", title: "System Health", summary: "Health checks for database, storage, OpenAI, fal, Runway, ElevenLabs, queue, worker, WebSocket, Vercel route, and env vars.", status: "blocked", proof: "Health dashboard/check endpoint not fully implemented." },
];

export function isCanonicalCapabilityQuestion(message = "") {
  const text = String(message || "").trim().toLowerCase();
  if (!text) return false;
  return /\b(capabilities|capability|what can you do|what are you able to do|all you can do|non[-\s]?compressed|non[-\s]?consolidated|source of truth capability|canonical capability)\b/.test(text);
}

export function wantsNonCompressedCapabilities(message = "") {
  const text = String(message || "").trim().toLowerCase();
  return /\b(non[-\s]?compressed|non[-\s]?consolidated|all|everything|full|complete|do it all|full list|source of truth)\b/.test(text);
}

export function buildRuntimeCapabilityRegistry() {
  const grouped = STREAMS_CANONICAL_CAPABILITIES.reduce<Record<CapabilityExecutionStatus, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {
    reasoning_ready: 0,
    wired: 0,
    implemented_unproven: 0,
    blocked: 0,
    external_tool_required: 0,
  });

  return {
    version: STREAMS_CANONICAL_CAPABILITIES_VERSION,
    total: STREAMS_CANONICAL_CAPABILITIES.length,
    statusCounts: grouped,
    capabilities: STREAMS_CANONICAL_CAPABILITIES,
  };
}

export function buildCanonicalCapabilityAnswer(message = "") {
  const full = wantsNonCompressedCapabilities(message);
  const registry = buildRuntimeCapabilityRegistry();
  const intro = [
    `STREAMS canonical capability source: ${registry.version}`,
    "",
    "Important truth split:",
    "- Reasoning-ready means STREAMS/OpenAI can explain, plan, write, audit, or guide that capability now.",
    "- Wired means there is an implemented backend/UI path for that capability.",
    "- Implemented but unproven means source exists, but runtime/output proof is still required.",
    "- External tool required means execution depends on a connected account/tool or future STREAMS tool path.",
    "- Blocked means the target is known but not fully built/proven yet.",
    "",
    `Capability count: ${registry.total}`,
    `Status counts: wired=${registry.statusCounts.wired}, implemented_unproven=${registry.statusCounts.implemented_unproven}, reasoning_ready=${registry.statusCounts.reasoning_ready}, external_tool_required=${registry.statusCounts.external_tool_required}, blocked=${registry.statusCounts.blocked}`,
    "",
  ];

  const items = (full ? registry.capabilities : registry.capabilities.slice(0, 24)).map((item, index) => [
    `${index + 1}. ${item.title}`,
    `   Status: ${item.status}`,
    `   Summary: ${item.summary}`,
    `   Proof: ${item.proof}`,
  ].join("\n"));

  const outro = full ? [
    "",
    "Missing / not fully proven areas remain tracked above as blocked, external_tool_required, or implemented_unproven. STREAMS should never collapse those into fake done states.",
  ] : [
    "",
    "This is the compressed capability view. Ask for the non-compressed/full capability list to see every canonical entry.",
  ];

  return [...intro, ...items, ...outro].join("\n");
}
