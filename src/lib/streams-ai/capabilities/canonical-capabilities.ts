export type CapabilityExecutionStatus = "reasoning_ready" | "wired" | "implemented_unproven" | "blocked" | "external_tool_required";

export type StreamsAICapability = {
  id: string;
  title: string;
  summary: string;
  status: CapabilityExecutionStatus;
  proof: string;
};

export const STREAMS_CANONICAL_CAPABILITIES_VERSION = "2026-06-22.public.v2";

export const STREAMS_CANONICAL_CAPABILITIES: StreamsAICapability[] = [
  { id: "chat.general", title: "General Chat", summary: "Answer questions, explain topics, brainstorm, compare options, and help users think through problems.", status: "wired", proof: "Public capability surface." },
  { id: "chat.reasoning", title: "Reasoning and Planning", summary: "Plan projects, reason through complex decisions, break work into steps, and guide next actions.", status: "wired", proof: "Public capability surface." },
  { id: "chat.writing", title: "Writing and Editing", summary: "Draft, rewrite, summarize, translate, simplify, polish, and organize written content.", status: "wired", proof: "Public capability surface." },
  { id: "research.current", title: "Research and Current Information", summary: "Look up current information when research is enabled, compare sources, summarize findings, and turn research into recommendations.", status: "wired", proof: "Public capability surface." },
  { id: "research.deep", title: "Deep Research", summary: "Create longer research summaries, competitive analysis, topic maps, vendor comparisons, evidence summaries, and research-to-report workflows.", status: "reasoning_ready", proof: "Public capability surface." },
  { id: "files.upload", title: "File Uploads", summary: "Work with supported uploaded documents, images, spreadsheets, code files, text files, audio, video, and project materials.", status: "wired", proof: "Public capability surface." },
  { id: "files.analysis", title: "File and Document Analysis", summary: "Summarize files, compare documents, extract key points, answer questions about uploads, and turn file content into structured outputs.", status: "wired", proof: "Public capability surface." },
  { id: "data.analysis", title: "Data, Tables, and Charts", summary: "Clean, organize, calculate, analyze, explain, and present data as tables, summaries, formulas, chart guidance, and spreadsheet-ready outputs.", status: "reasoning_ready", proof: "Public capability surface." },
  { id: "vision.images", title: "Image and Screenshot Understanding", summary: "Analyze photos, screenshots, diagrams, charts, layouts, app screens, website screens, product images, and visual references.", status: "wired", proof: "Public capability surface." },
  { id: "media.images", title: "Image Creation and Editing Workflows", summary: "Create image prompts, design visual concepts, generate images when tools are available, refine image ideas, prepare references, and guide editing workflows.", status: "wired", proof: "Public capability surface." },
  { id: "media.video", title: "Video and Media Workflows", summary: "Plan, prompt, generate, organize, review, and improve video or media projects when the media tools are available.", status: "wired", proof: "Public capability surface." },
  { id: "media.audio", title: "Voice and Audio Workflows", summary: "Write voice scripts, plan audio content, prepare narration, create audio prompts, and support audio production tasks when connected tools are available.", status: "reasoning_ready", proof: "Public capability surface." },
  { id: "dev.coding", title: "Coding and Technical Work", summary: "Explain code, write code, debug errors, review logs, plan architecture, create API specs, generate tests, refactor components, and troubleshoot deployments.", status: "reasoning_ready", proof: "Public capability surface." },
  { id: "dev.design_to_code", title: "Design-to-Code and UI Review", summary: "Review screenshots, plan interfaces, create frontend handoff instructions, improve layouts, and convert visual references into build guidance.", status: "reasoning_ready", proof: "Public capability surface." },
  { id: "artifacts.outputs", title: "Artifacts and Reusable Outputs", summary: "Create specs, checklists, plans, reports, tables, code files, UI instructions, prompts, scripts, templates, and reusable project outputs.", status: "wired", proof: "Public capability surface." },
  { id: "projects.context", title: "Projects and Memory", summary: "Organize long-running work, keep context tied to the right project, use uploaded materials as references, and continue work across sessions.", status: "wired", proof: "Public capability surface." },
  { id: "tools.connected", title: "Connected Workflows", summary: "Help with external workflows such as email, calendar, contacts, documents, spreadsheets, presentations, repositories, files, team tools, and business systems when connected and authorized.", status: "external_tool_required", proof: "Public capability surface." },
  { id: "agent.workflow", title: "Agent-Style Work", summary: "Break large tasks into steps, inspect available context, choose a workflow, use available tools, track progress, return partial results, and continue until completion or approval is needed.", status: "wired", proof: "Public capability surface." },
  { id: "workspace.operation", title: "Computer and Workstation-Style Workflows", summary: "Operate across files, previews, assets, projects, tasks, and connected systems when the right workspace tools are available.", status: "wired", proof: "Public capability surface." },
  { id: "business.strategy", title: "Business, Marketing, and Ecommerce", summary: "Support business ideas, offers, pricing, branding, launch plans, SEO, ecommerce, product pages, ads, captions, campaigns, sales, and growth strategy.", status: "reasoning_ready", proof: "Public capability surface." },
  { id: "qa.testing", title: "Testing, QA, and Production Audits", summary: "Create smoke tests, QA checklists, bug reports, audit plans, quality gates, launch checklists, error classifications, and proof requirements.", status: "reasoning_ready", proof: "Public capability surface." },
  { id: "safety.truth", title: "Truthful Action Claims", summary: "Avoid claiming that external actions, file edits, generated media, sent messages, system changes, or production fixes happened unless a connected tool actually ran and returned proof.", status: "wired", proof: "Public capability surface." },
];

const PUBLIC_CAPABILITY_ANSWER = [
  "I’m Streams AI — your AI chat, creative, business, builder, and workflow assistant.",
  "",
  "Here is what I can help you do:",
  "",
  "**Chat, reason, and solve problems**",
  "I can answer questions, explain topics, brainstorm, compare options, plan projects, reason through complex problems, teach step-by-step, and help you make decisions.",
  "",
  "**Write, rewrite, and summarize**",
  "I can draft, rewrite, summarize, translate, simplify, expand, organize, and polish emails, scripts, documents, product copy, SOPs, reports, notes, captions, ads, landing pages, and long-form content.",
  "",
  "**Research and current information**",
  "When research is enabled, I can look up current information, compare sources, summarize findings, create research reports, map topics, check facts, and turn research into clear recommendations.",
  "",
  "**Files and uploads**",
  "I can work with uploaded documents, PDFs, spreadsheets, CSVs, images, screenshots, code files, text files, audio, video, and other project materials when supported. I can summarize them, compare them, extract useful details, answer questions about them, and turn them into structured outputs.",
  "",
  "**Data, tables, and charts**",
  "I can help clean, organize, calculate, analyze, and explain data. I can create tables, formulas, summaries, chart recommendations, dashboards, reports, and spreadsheet-ready outputs.",
  "",
  "**Images and screenshots**",
  "I can analyze photos, screenshots, diagrams, charts, layouts, app screens, website screens, product images, and visual references. I can identify issues, compare designs, describe what is shown, and turn visual references into build instructions.",
  "",
  "**Image creation and editing workflows**",
  "I can help create image prompts, design visual concepts, generate images when tools are available, refine image ideas, prepare reference images, create style sheets, and guide image-editing workflows.",
  "",
  "**Video and media workflows**",
  "I can help plan, prompt, generate, organize, review, and improve video or media projects when the media tools are available. I can help with video concepts, scenes, scripts, motion direction, storyboard planning, and generated media organization.",
  "",
  "**Voice and audio workflows**",
  "I can help write voice scripts, plan audio content, prepare narration, create voice/audio prompts, organize audio workflows, and support audio-related production tasks when the required tools are connected.",
  "",
  "**Coding and technical work**",
  "I can explain code, write code, debug errors, review logs, plan architecture, create API specs, generate tests, refactor components, audit frontend/backend flows, troubleshoot deployments, and prepare developer-ready instructions.",
  "",
  "**Websites, apps, and UI/UX**",
  "I can help design pages, app screens, user flows, dashboards, forms, workstations, mobile layouts, frontend components, and developer handoff specs. I can also review screenshots and tell you what needs to be fixed.",
  "",
  "**Artifacts and reusable outputs**",
  "I can create specs, checklists, plans, reports, tables, code files, UI instructions, prompts, scripts, templates, and other reusable outputs that can be copied, saved, edited, or used in a project.",
  "",
  "**Projects and memory**",
  "I can help organize long-running work into projects, keep context tied to the right project, use uploaded materials as reference, continue work across sessions, and avoid mixing unrelated projects unless you ask me to compare or merge them.",
  "",
  "**Connected workflows**",
  "When you connect and authorize tools, I can help with external workflows such as email, calendar, contacts, documents, spreadsheets, presentations, repositories, files, team tools, and other business systems.",
  "",
  "**Agent-style work**",
  "I can break large tasks into steps, inspect available context, choose the right workflow, use available tools, track progress, return partial results, and continue until the task is complete or until I need your approval.",
  "",
  "**Computer/workstation-style workflows**",
  "When the right workspace tools are available, I can help operate across files, previews, assets, projects, tasks, and connected systems. I can inspect what is visible, reason about what is broken, and guide or perform the next approved action.",
  "",
  "**Testing, QA, and production audits**",
  "I can create smoke tests, QA checklists, bug reports, audit plans, quality gates, launch checklists, error classifications, and proof requirements so work is verified instead of guessed.",
  "",
  "I will not claim I completed an external action, edited a file, generated media, sent a message, changed a system, or fixed production unless the connected tool actually ran and returned proof.",
].join("\n");

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

export function buildCanonicalCapabilityAnswer(_message = "") {
  return PUBLIC_CAPABILITY_ANSWER;
}
