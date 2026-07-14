export type StreamsPrimaryIntent =
  | "conversation"
  | "factual_answer"
  | "reasoning"
  | "writing"
  | "rewriting"
  | "summarization"
  | "translation"
  | "research"
  | "file_analysis"
  | "image_analysis"
  | "coding"
  | "repository_action"
  | "connected_action"
  | "generation"
  | "artifact_edit"
  | "planning"
  | "troubleshooting";

export type StreamsRequestedDepth = "minimal" | "standard" | "detailed" | "exhaustive";

export type StreamsFormatContract = {
  exact: boolean;
  table: boolean;
  json: boolean;
  xml: boolean;
  csv: boolean;
  codeBlock: boolean;
  blockquote: boolean;
  numberedSections: boolean;
  headings: string[];
  requestedOrder: boolean;
};

export type StreamsIntentDecision = {
  primaryIntent: StreamsPrimaryIntent;
  requestedOutcome: string;
  requestedFormat: StreamsFormatContract;
  requestedDepth: StreamsRequestedDepth;
  needsCurrentInformation: boolean;
  needsFiles: boolean;
  needsImages: boolean;
  needsTools: boolean;
  needsArtifact: boolean;
  needsClarification: boolean;
  clarificationReason?: string;
  riskLevel: "low" | "medium" | "high";
  complexity: "simple" | "moderate" | "complex" | "critical";
  confidence: number;
  signals: string[];
};

function lower(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function detectHeadings(text: string) {
  const quoted = Array.from(text.matchAll(/[“\"]([^”\"]{2,80})[”\"]/g)).map((match) => match[1].trim());
  const afterHeadings = text.match(/headings?\s*:?\s*([^\n]+)/i)?.[1]
    ?.split(/,|\band\b/i)
    .map((value) => value.trim())
    .filter(Boolean) || [];
  return Array.from(new Set([...quoted, ...afterHeadings])).slice(0, 20);
}

export function detectFormatContract(userMessage: string): StreamsFormatContract {
  const text = lower(userMessage);
  return {
    exact: /\b(exact|exactly|only|same order|do not change|preserve.*format|must include)\b/.test(text),
    table: /\b(markdown table|table|columns?)\b/.test(text),
    json: /\bjson\b/.test(text),
    xml: /\bxml\b/.test(text),
    csv: /\bcsv\b/.test(text),
    codeBlock: /\b(code block|fenced code|```)/.test(text),
    blockquote: /\bblockquote\b|^\s*>/m.test(userMessage),
    numberedSections: /\b(numbered sections?|numbered list|steps?\s+1|1\.)\b/.test(text),
    headings: detectHeadings(userMessage),
    requestedOrder: /\b(same order|in this order|order below|following order)\b/.test(text),
  };
}

function resolveDepth(text: string): StreamsRequestedDepth {
  if (/\b(full|complete|non[- ]?compressed|non[- ]?condensed|exhaustive|end[- ]?to[- ]?end|nothing omitted|deep dive)\b/.test(text)) return "exhaustive";
  if (/\b(detailed|thorough|comprehensive|in depth|deep)\b/.test(text)) return "detailed";
  if (/\b(short|brief|concise|one sentence|quick answer|only answer)\b/.test(text)) return "minimal";
  return "standard";
}

function resolvePrimaryIntent(text: string, hasFiles: boolean, hasImages: boolean): StreamsPrimaryIntent {
  if (/\b(delete|remove permanently|destroy|wipe|drop table|revoke|send|publish|deploy|merge|commit|push|update repo|edit file|change code)\b/.test(text)) return "repository_action";
  if (/\b(email|calendar|schedule|contact|slack|drive|github)\b/.test(text) && /\b(send|create|update|delete|forward|archive|label|invite|book|schedule)\b/.test(text)) return "connected_action";
  if (/\b(generate|create image|create video|image to video|text to video|voice|audio|song|music|render)\b/.test(text)) return "generation";
  if (/\b(fix|broken|error|failed|bug|troubleshoot|debug|repair|not working|still wrong)\b/.test(text)) return "troubleshooting";
  if (/\b(build|implement|patch|wire|refactor|component|function|typescript|javascript|react|next\.js|code)\b/.test(text)) return "coding";
  if (hasImages || /\b(image|screenshot|photo|picture|diagram|see attached)\b/.test(text)) return "image_analysis";
  if (hasFiles || /\b(file|document|pdf|spreadsheet|presentation|attachment|uploaded)\b/.test(text)) return "file_analysis";
  if (/\b(search|research|latest|current|today|recent|news|price|law|schedule|who is|what is the current)\b/.test(text)) return "research";
  if (/\b(rewrite|reword|polish|improve this writing)\b/.test(text)) return "rewriting";
  if (/\b(summarize|summary|condense)\b/.test(text)) return "summarization";
  if (/\b(translate|translation)\b/.test(text)) return "translation";
  if (/\b(write|draft|script|email copy|proposal|article|post|caption)\b/.test(text)) return "writing";
  if (/\b(plan|strategy|roadmap|architecture|checklist|steps|todo)\b/.test(text)) return "planning";
  if (/\b(why|how|compare|analyze|reason|explain|should)\b/.test(text)) return "reasoning";
  if (/\b(who|what|when|where|which)\b/.test(text)) return "factual_answer";
  return "conversation";
}

function detectCurrentInformation(text: string) {
  return /\b(latest|current|today|now|recent|this week|this month|202[5-9]|price|stock|weather|news|law|regulation|schedule|score|standings|ceo|president|version|release)\b/.test(text);
}

function detectRisk(text: string, primaryIntent: StreamsPrimaryIntent) {
  if (/\b(delete|destroy|wipe|drop|revoke|transfer money|purchase|pay|send externally|publish|deploy production|merge main)\b/.test(text)) return "high" as const;
  if (["repository_action", "connected_action", "generation", "artifact_edit"].includes(primaryIntent)) return "medium" as const;
  return "low" as const;
}

function resolveComplexity(text: string, depth: StreamsRequestedDepth, primaryIntent: StreamsPrimaryIntent, hasFiles: boolean, hasImages: boolean) {
  if (/\b(high[- ]?stakes|medical|legal|financial|production|security|privacy|10 million|enterprise)\b/.test(text)) return "critical" as const;
  if (depth === "exhaustive" || hasFiles || hasImages || ["research", "coding", "repository_action", "connected_action", "troubleshooting"].includes(primaryIntent)) return "complex" as const;
  if (text.length > 500 || depth === "detailed" || primaryIntent === "reasoning") return "moderate" as const;
  return "simple" as const;
}

export function classifyStreamsIntent(input: {
  userMessage: string;
  hasFiles?: boolean;
  hasImages?: boolean;
  hasSelectedArtifact?: boolean;
}): StreamsIntentDecision {
  const text = lower(input.userMessage);
  const hasFiles = Boolean(input.hasFiles);
  const hasImages = Boolean(input.hasImages);
  const primaryIntent = resolvePrimaryIntent(text, hasFiles, hasImages);
  const requestedDepth = resolveDepth(text);
  const requestedFormat = detectFormatContract(input.userMessage);
  const needsCurrentInformation = detectCurrentInformation(text) || primaryIntent === "research";
  const needsTools = needsCurrentInformation || ["repository_action", "connected_action", "generation", "artifact_edit"].includes(primaryIntent);
  const needsArtifact = Boolean(input.hasSelectedArtifact) || ["artifact_edit", "generation"].includes(primaryIntent) || /\b(canvas|workspace|artifact|document|spreadsheet|slides|website|app)\b/.test(text);
  const riskLevel = detectRisk(text, primaryIntent);
  const complexity = resolveComplexity(text, requestedDepth, primaryIntent, hasFiles, hasImages);
  const signals = [
    primaryIntent,
    requestedDepth,
    needsCurrentInformation ? "current_information" : "stable_information",
    hasFiles ? "files" : "no_files",
    hasImages ? "images" : "no_images",
    needsTools ? "tools" : "no_tools",
    riskLevel,
    complexity,
  ];

  const ambiguousAction = /\b(fix it|do it|change it|update it|remove it|send it)\b/.test(text) && !hasFiles && !hasImages && text.split(/\s+/).length < 8;
  const needsClarification = ambiguousAction && ["repository_action", "connected_action", "coding", "troubleshooting"].includes(primaryIntent);

  return {
    primaryIntent,
    requestedOutcome: String(input.userMessage || "").trim(),
    requestedFormat,
    requestedDepth,
    needsCurrentInformation,
    needsFiles: hasFiles || primaryIntent === "file_analysis",
    needsImages: hasImages || primaryIntent === "image_analysis",
    needsTools,
    needsArtifact,
    needsClarification,
    clarificationReason: needsClarification ? "The requested action does not identify a safe, verifiable target." : undefined,
    riskLevel,
    complexity,
    confidence: needsClarification ? 0.58 : 0.9,
    signals,
  };
}
