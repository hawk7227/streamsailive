import type { StreamsIntentDecision } from "../runtime/intent-engine";

export const STREAMS_EVIDENCE_VALIDATOR_VERSION = "streams-evidence-validator-v2";

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

function requestedCurrentItemCount(instruction: string) {
  const match = String(instruction || "").match(/\b(?:top|latest|most important)?\s*(\d+)\s+(?:headlines?|announcements?|changes?|items?|examples?|sources?)\b/i);
  return match ? Number(match[1]) : null;
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

  if (input.intent.needsCurrentInformation && !input.webSearchUsed && !currentRefusal) {
    defects.push({ code: "CURRENT_INFO_WITHOUT_SEARCH", message: "Current information was presented without a verified live search or an explicit statement that it could not be verified." });
  }

  if (input.intent.needsCurrentInformation && input.webSearchUsed && input.citationCount < 1) {
    defects.push({ code: "SEARCH_WITHOUT_CITATIONS", message: "Current research completed, but no provider-backed citation annotation supports the answer." });
  }

  const requestedCount = requestedCurrentItemCount(input.intent.requestedOutcome);
  if (input.intent.needsCurrentInformation && input.webSearchUsed && requestedCount && input.citationCount < requestedCount) {
    defects.push({ code: "INSUFFICIENT_CITATION_COVERAGE", message: `The request asks for ${requestedCount} current items, but only ${input.citationCount} citation annotations were available.` });
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

  const critical = defects.some((defect) => ["CURRENT_INFO_WITHOUT_SEARCH", "ACTION_WITHOUT_VERIFIED_RECEIPT", "SEARCH_WITHOUT_CITATIONS"].includes(defect.code));
  return { version: STREAMS_EVIDENCE_VALIDATOR_VERSION, accepted: defects.length === 0, critical, defects };
}
