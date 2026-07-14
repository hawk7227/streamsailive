import type { StreamsIntentDecision } from "../runtime/intent-engine";

export const STREAMS_EVIDENCE_VALIDATOR_VERSION = "streams-evidence-validator-v1";

export type StreamsEvidenceValidation = {
  version: string;
  accepted: boolean;
  critical: boolean;
  defects: Array<{ code: string; message: string }>;
};

export function validateStreamsEvidence(input: {
  intent: StreamsIntentDecision;
  responseText: string;
  webSearchUsed: boolean;
  citationCount: number;
  verifiedToolEvidenceCount: number;
}) : StreamsEvidenceValidation {
  const defects: StreamsEvidenceValidation["defects"] = [];
  const text = String(input.responseText || "");

  if (input.intent.needsCurrentInformation && !input.webSearchUsed) {
    defects.push({ code: "CURRENT_INFO_WITHOUT_SEARCH", message: "Current information was requested but no verified web search completed." });
  }
  if (input.intent.needsCurrentInformation && input.webSearchUsed && input.citationCount < 1) {
    defects.push({ code: "SEARCH_WITHOUT_CITATIONS", message: "Web research completed but the response has no provider citation annotations." });
  }
  if (input.intent.needsTools && ["repository_action", "connected_action", "artifact_edit", "generation"].includes(input.intent.primaryIntent) && input.verifiedToolEvidenceCount < 1) {
    defects.push({ code: "ACTION_WITHOUT_VERIFIED_RECEIPT", message: "The response concerns an action but no server-verified tool receipt is present." });
  }
  if (/\b(?:according to|source|sources|citation|cited)\b/i.test(text) && input.citationCount < 1 && input.webSearchUsed) {
    defects.push({ code: "CITATION_LANGUAGE_WITHOUT_ANNOTATION", message: "The response refers to sources without provider citation evidence." });
  }

  const critical = defects.some((defect) => ["CURRENT_INFO_WITHOUT_SEARCH", "ACTION_WITHOUT_VERIFIED_RECEIPT"].includes(defect.code));
  return {
    version: STREAMS_EVIDENCE_VALIDATOR_VERSION,
    accepted: defects.length === 0,
    critical,
    defects,
  };
}
