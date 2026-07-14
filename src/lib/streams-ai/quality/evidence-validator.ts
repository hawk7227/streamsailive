import type { StreamsIntentDecision } from "../runtime/intent-engine";
import { countVisibleMarkdownCitations } from "../research/provider-citation-renderer";

export const STREAMS_EVIDENCE_VALIDATOR_VERSION = "streams-evidence-validator-v6";

export type StreamsEvidenceValidation = {
  version: string;
  accepted: boolean;
  critical: boolean;
  defects: Array<{ code: string; message: string }>;
};

function claimsCompletedAction(text: string) {
  return /\b(?:i|we|streams)\s+(?:have\s+)?(?:successfully\s+)?(?:deployed|sent|created|updated|deleted|committed|pushed|merged|published|scheduled|booked|cancelled|modified|generated)\b/i.test(text)
    || /\b(?:done|completed successfully|is now live|has been deployed|has been sent|was successfully created)\b/i.test(text);
}

function explicitlyDeclinesUnverifiedCurrentClaim(text: string) {
  return /\b(?:cannot|can't|unable to)\s+(?:verify|confirm)\b|\bwithout (?:a )?(?:live |current )?(?:search|source|verification)\b|\bnot verified as current\b/i.test(text);
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const ITEM_WORD = /^(?:headline|headlines|announcement|announcements|change|changes|item|items|example|examples|source|sources)$/i;

function parseCountToken(token: string | undefined) {
  const value = String(token || "").toLowerCase();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NUMBER_WORDS[value] || null;
}

export function requestedCurrentItemCount(instruction: string) {
  const words = String(instruction || "")
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (let index = 0; index < words.length; index += 1) {
    const count = parseCountToken(words[index]);
    if (count === null) continue;
    const lookahead = words.slice(index + 1, index + 9);
    if (lookahead.some((word) => ITEM_WORD.test(word))) return count;
  }
  return null;
}

export function validateStreamsEvidence(input: {
  intent: StreamsIntentDecision;
  responseText: string;
  webSearchUsed: boolean;
  citationCount: number;
  verifiedToolEvidenceCount: number;
}): StreamsEvidenceValidation {
  const defects: StreamsEvidenceValidation["defects"] = [];
  const text = String(input.responseText || "");
  const currentRefusal = explicitlyDeclinesUnverifiedCurrentClaim(text);
  const visibleCitationCount = countVisibleMarkdownCitations(text);

  if (input.intent.needsCurrentInformation && !input.webSearchUsed && !currentRefusal) {
    defects.push({ code: "CURRENT_INFO_WITHOUT_SEARCH", message: "Current information was presented without a verified live search or an explicit statement that it could not be verified." });
  }

  if (input.intent.needsCurrentInformation && input.webSearchUsed && input.citationCount < 1) {
    defects.push({ code: "SEARCH_WITHOUT_CITATIONS", message: "Current research completed, but no provider-backed citation annotation supports the answer." });
  }

  if (input.intent.needsCurrentInformation && input.webSearchUsed && input.citationCount > 0 && visibleCitationCount < 1) {
    defects.push({ code: "CITATIONS_NOT_RENDERED", message: "Provider citations were returned but were not rendered into the user-visible answer." });
  }

  const requestedCount = requestedCurrentItemCount(input.intent.requestedOutcome);
  if (input.intent.needsCurrentInformation && input.webSearchUsed && requestedCount && input.citationCount < requestedCount) {
    defects.push({ code: "INSUFFICIENT_CITATION_COVERAGE", message: `The request asks for ${requestedCount} current items, but only ${input.citationCount} provider citations were available.` });
  }
  if (input.intent.needsCurrentInformation && input.webSearchUsed && requestedCount && visibleCitationCount < requestedCount) {
    defects.push({ code: "INSUFFICIENT_VISIBLE_CITATION_COVERAGE", message: `The request asks for ${requestedCount} current items, but only ${visibleCitationCount} distinct citations are visible in the answer.` });
  }

  if (claimsCompletedAction(text) && input.verifiedToolEvidenceCount < 1) {
    defects.push({ code: "ACTION_WITHOUT_VERIFIED_RECEIPT", message: "The response claims a real action completed, but no server-verified receipt supports that claim." });
  }

  if (/\b(?:according to|source|sources|citation|cited)\b/i.test(text) && input.citationCount < 1 && input.webSearchUsed) {
    defects.push({ code: "CITATION_LANGUAGE_WITHOUT_ANNOTATION", message: "The response refers to sources without provider-backed citation annotations." });
  }

  if (/https?:\/\//i.test(text) && input.citationCount < 1 && input.webSearchUsed) {
    defects.push({ code: "UNVERIFIED_RAW_URL", message: "The response contains a raw URL that is not backed by a provider citation annotation." });
  }

  const criticalCodes = new Set([
    "CURRENT_INFO_WITHOUT_SEARCH",
    "ACTION_WITHOUT_VERIFIED_RECEIPT",
    "SEARCH_WITHOUT_CITATIONS",
    "CITATIONS_NOT_RENDERED",
    "INSUFFICIENT_CITATION_COVERAGE",
    "INSUFFICIENT_VISIBLE_CITATION_COVERAGE",
  ]);
  const critical = defects.some((defect) => criticalCodes.has(defect.code));
  return { version: STREAMS_EVIDENCE_VALIDATOR_VERSION, accepted: defects.length === 0, critical, defects };
}
