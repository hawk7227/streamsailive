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
  secondaryIntents: StreamsPrimaryIntent[];
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

function cleanLiteralHeading(value: string) {
  return String(value || "")
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/\s+$/g, "")
    .trim();
}

function detectHeadings(text: string) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  const quoted = Array.from(source.matchAll(/[“\"]([^”\"]{2,80})[”\"]/g)).map((match) => cleanLiteralHeading(match[1]));
  const lines = source.split("\n");
  const literal: string[] = [];
  const markerIndex = lines.findIndex((line) => /(?:section\s+)?headings?\s*:?[\s]*$/i.test(line.trim()));

  if (markerIndex >= 0) {
    for (const raw of lines.slice(markerIndex + 1)) {
      const line = raw.trim();
      if (!line) {
        if (literal.length) break;
        continue;
      }
      const numbered = line.match(/^(\d+[.)]\s+.+)$/);
      const markdownHeading = line.match(/^#{1,6}\s+(.+)$/);
      const bullet = line.match(/^[-*•]\s+(.+)$/);
      if (numbered) literal.push(cleanLiteralHeading(numbered[1]));
      else if (markdownHeading) literal.push(cleanLiteralHeading(markdownHeading[1]));
      else if (bullet) literal.push(cleanLiteralHeading(bullet[1]));
      else if (literal.length) break;
    }
  }

  const inline = source.match(/headings?\s*:\s*([^\n]+)/i)?.[1]
    ?.split(/,|\band\b/i)
    .map((value) => cleanLiteralHeading(value))
    .filter(Boolean) || [];

  return Array.from(new Set([...literal, ...quoted, ...inline].filter(Boolean))).slice(0, 20);
}

export function detectFormatContract(userMessage: string): StreamsFormatContract {
  const text = lower(userMessage);
  const headings = detectHeadings(userMessage);
  return {
    exact: /\b(exact|exactly|only|same order|do not change|preserve.*format|must include|return only)\b/.test(text),
    table: /\b(markdown table|table|columns?)\b/.test(text),
    json: /\bjson\b/.test(text),
    xml: /\bxml\b/.test(text),
    csv: /\bcsv\b/.test(text),
    codeBlock: /\b(code block|fenced code|```)/.test(text),
    blockquote: /\bblockquote\b|^\s*>/m.test(userMessage),
    numberedSections: headings.some((heading) => /^\d+[.)]\s+/.test(heading)) || /\b(numbered sections?|numbered list|steps?\s+1|1\.)\b/.test(text),
    headings,
    requestedOrder: /\b(same order|in this order|order below|following order)\b/.test(text) || headings.length > 1,
  };
}

function resolveDepth(text: string): StreamsRequestedDepth {
  if (/\b(full|complete|non[- ]?compressed|non[- ]?condensed|exhaustive|end[- ]?to[- ]?end|nothing omitted|deep dive)\b/.test(text)) return "exhaustive";
  if (/\b(detailed|thorough|comprehensive|in depth|deep)\b/.test(text)) return "detailed";
  if (/\b(short|brief|concise|one sentence|quick answer|only answer)\b/.test(text)) return "minimal";
  return "standard";
}

function hasConnectedAction(text: string) {
  const connectedTarget = /\b(email|gmail|calendar|event|contact|slack|drive|github issue|github pull request|message|appointment|invite)\b/.test(text);
  const action = /\b(send|draft|create|update|delete|forward|archive|label|invite|book|schedule|cancel|reply|move|trash)\b/.test(text);
  return connectedTarget && action;
}

function hasRepositoryAction(text: string) {
  const repositoryTarget = /\b(repo|repository|branch|commit|pull request|github file|source file|codebase|deployment|vercel|production build|main branch)\b/.test(text);
  const action = /\b(delete|remove|revoke|publish|deploy|merge|commit|push|update|edit|change|patch|revert)\b/.test(text);
  return repositoryTarget && action;
}

function collectIntentCandidates(text: string, hasFiles: boolean, hasImages: boolean): StreamsPrimaryIntent[] {
  const intents: StreamsPrimaryIntent[] = [];
  if (hasConnectedAction(text)) intents.push("connected_action");
  if (hasRepositoryAction(text)) intents.push("repository_action");
  if (/\b(generate|create image|create video|image to video|text to video|voice|audio|song|music|render)\b/.test(text)) intents.push("generation");
  if (/\b(fix|broken|error|failed|bug|troubleshoot|debug|repair|not working|still wrong)\b/.test(text)) intents.push("troubleshooting");
  if (/\b(build|implement|patch|wire|refactor|component|function|typescript|javascript|react|next\.js|code)\b/.test(text)) intents.push("coding");
  if (hasImages || /\b(image|screenshot|photo|picture|diagram|see attached)\b/.test(text)) intents.push("image_analysis");
  if (hasFiles || /\b(file|document|pdf|spreadsheet|presentation|attachment|uploaded)\b/.test(text)) intents.push("file_analysis");
  if (/\b(search|research|latest|current|today|recent|news|price|law|schedule|who is|what is the current)\b/.test(text)) intents.push("research");
  if (/\b(rewrite|reword|polish|improve this writing)\b/.test(text)) intents.push("rewriting");
  if (/\b(summarize|summary|condense)\b/.test(text)) intents.push("summarization");
  if (/\b(translate|translation)\b/.test(text)) intents.push("translation");
  if (/\b(write|draft|script|email copy|proposal|article|post|caption)\b/.test(text)) intents.push("writing");
  if (/\b(plan|strategy|roadmap|architecture|checklist|steps|todo)\b/.test(text)) intents.push("planning");
  if (/\b(why|how|compare|analyze|reason|explain|should)\b/.test(text)) intents.push("reasoning");
  if (/\b(who|what|when|where|which)\b/.test(text)) intents.push("factual_answer");
  return Array.from(new Set(intents));
}

function choosePrimaryIntent(candidates: StreamsPrimaryIntent[]): StreamsPrimaryIntent {
  const precedence: StreamsPrimaryIntent[] = [
    "connected_action",
    "repository_action",
    "generation",
    "troubleshooting",
    "coding",
    "image_analysis",
    "file_analysis",
    "research",
    "rewriting",
    "summarization",
    "translation",
    "writing",
    "planning",
    "reasoning",
    "factual_answer",
  ];
  return precedence.find((intent) => candidates.includes(intent)) || "conversation";
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
  const candidates = collectIntentCandidates(text, hasFiles, hasImages);
  const primaryIntent = choosePrimaryIntent(candidates);
  const secondaryIntents = candidates.filter((intent) => intent !== primaryIntent);
  const requestedDepth = resolveDepth(text);
  const requestedFormat = detectFormatContract(input.userMessage);
  const needsCurrentInformation = detectCurrentInformation(text) || primaryIntent === "research";
  const needsTools = needsCurrentInformation || ["repository_action", "connected_action", "generation", "artifact_edit"].includes(primaryIntent);
  const needsArtifact = Boolean(input.hasSelectedArtifact) || ["artifact_edit", "generation"].includes(primaryIntent) || /\b(canvas|workspace|artifact|document|spreadsheet|slides|website|app)\b/.test(text);
  const riskLevel = detectRisk(text, primaryIntent);
  const complexity = resolveComplexity(text, requestedDepth, primaryIntent, hasFiles, hasImages);
  const ambiguousAction = /\b(fix it|do it|change it|update it|remove it|send it)\b/.test(text) && !hasFiles && !hasImages && text.split(/\s+/).length < 8;
  const needsClarification = ambiguousAction && ["repository_action", "connected_action", "coding", "troubleshooting"].includes(primaryIntent);
  const confidence = needsClarification ? 0.55 : candidates.length > 3 ? 0.78 : candidates.length > 0 ? 0.92 : 0.86;
  const signals = [
    primaryIntent,
    ...secondaryIntents.map((intent) => `secondary:${intent}`),
    requestedDepth,
    needsCurrentInformation ? "current_information" : "stable_information",
    hasFiles ? "files" : "no_files",
    hasImages ? "images" : "no_images",
    needsTools ? "tools" : "no_tools",
    riskLevel,
    complexity,
  ];

  return {
    primaryIntent,
    secondaryIntents,
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
    confidence,
    signals,
  };
}
