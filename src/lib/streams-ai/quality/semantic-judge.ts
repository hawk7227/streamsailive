import type { StreamsIntentDecision } from "../runtime/intent-engine";

export const STREAMS_SEMANTIC_JUDGE_VERSION = "streams-semantic-judge-v3";

export type StreamsSemanticJudgment = {
  version: string;
  overallScore: number;
  accepted: boolean;
  repairable: boolean;
  criticalDefect: boolean;
  dimensions: { intentMatch: number; factualCoverage: number; instructionAdherence: number; structure: number; tone: number; uncertainty: number; grounding: number; citationIntegrity: number; toolTruthfulness: number; concisionFit: number };
  defects: Array<{ code: string; severity: "info" | "warning" | "critical"; message: string; repairHint?: string }>;
};

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function genericOpening(text: string) { return /^(certainly|of course|absolutely|great question|i'd be happy to help|as an ai)/i.test(text.trim()); }
function genericClosing(text: string) { return /(please let me know|let me know if|if you need anything|if you want,? i can|happy to help further)\.?\s*$/i.test(text.trim()); }
function unsupportedActionClaim(text: string, toolEvidenceCount: number) { if (toolEvidenceCount > 0) return false; return /\b(i (?:have )?(?:updated|changed|deleted|sent|deployed|committed|pushed|created the event|modified the file)|done|completed successfully|is now live)\b/i.test(text); }
function screenshotOverclaim(text: string, hasImages: boolean) { if (!hasImages) return false; const operationalClaim = /\b(deployment|commit|integration|environment variable|logs?|api|build|production|ready|live)\b/i.test(text); const hasQualification = /\b(the screenshot shows|the screenshot displays|the visible interface states|may indicate|does not independently verify|cannot verify)\b/i.test(text); return operationalClaim && !hasQualification; }

function normalizeLine(value: string) { return String(value || "").replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").replace(/__+/g, "").replace(/\s+/g, " ").trim(); }
function exactHeadingPositions(text: string, headings: string[]) { const lines = String(text || "").replace(/\r\n/g, "\n").split("\n").map(normalizeLine); return headings.map((heading) => lines.findIndex((line) => line === normalizeLine(heading))); }
function literalHeadingDefects(text: string, intent: StreamsIntentDecision) {
  const defects: StreamsSemanticJudgment["defects"] = [];
  const headings = intent.requestedFormat.headings || [];
  if (!headings.length) return defects;
  const positions = exactHeadingPositions(text, headings);
  headings.forEach((heading, index) => { if (positions[index] < 0) defects.push({ code: "MISSING_LITERAL_HEADING", severity: "critical", message: `The response did not reproduce the exact requested heading: ${heading}`, repairHint: `Insert the literal heading exactly as written, including its numbering or letter prefix: ${heading}` }); });
  if (intent.requestedFormat.requestedOrder && positions.every((position) => position >= 0)) {
    for (let index = 1; index < positions.length; index += 1) if (positions[index] <= positions[index - 1]) { defects.push({ code: "WRONG_LITERAL_HEADING_ORDER", severity: "critical", message: "The exact requested headings were not kept in the requested order.", repairHint: `Use these headings in this exact order:\n${headings.join("\n")}` }); break; }
  }
  return defects;
}

function conflictingExactFormats(intent: StreamsIntentDecision) { return intent.requestedFormat.exact && [intent.requestedFormat.json, intent.requestedFormat.xml, intent.requestedFormat.csv, intent.requestedFormat.table].filter(Boolean).length > 1; }
function explainsConflict(text: string) { return /\b(?:cannot|can't|mutually exclusive|conflicting requirements|choose one|which format)\b/i.test(text); }

function formatDefects(text: string, intent: StreamsIntentDecision) {
  const defects: StreamsSemanticJudgment["defects"] = [];
  const format = intent.requestedFormat;
  if (conflictingExactFormats(intent)) {
    if (!explainsConflict(text)) defects.push({ code: "CONFLICTING_EXACT_FORMATS", severity: "critical", message: "The request contains mutually exclusive exact formats.", repairHint: "Explain the conflict and ask which single exact format should control." });
    return defects;
  }
  if (format.table && !/\|[^\n]+\|/.test(text)) defects.push({ code: "MISSING_TABLE", severity: "critical", message: "The response omitted the requested table.", repairHint: "Add the requested table with the exact columns and order." });
  if (format.json) { try { JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, "")); } catch { defects.push({ code: "INVALID_JSON", severity: "critical", message: "The response is not valid JSON.", repairHint: "Return only valid JSON matching the requested shape." }); } }
  if (format.xml && !/^\s*<[^>]+>[\s\S]*<\/[^>]+>\s*$/.test(text)) defects.push({ code: "INVALID_XML", severity: "critical", message: "The response is not valid XML.", repairHint: "Return well-formed XML only." });
  if (format.csv && !/^[^\n,]+(?:,[^\n,]+)+/m.test(text)) defects.push({ code: "INVALID_CSV", severity: "warning", message: "The response does not appear to be CSV.", repairHint: "Return the requested comma-separated rows." });
  if (format.codeBlock && !/```[\s\S]*```/.test(text)) defects.push({ code: "MISSING_CODE_BLOCK", severity: "critical", message: "The response omitted the requested fenced code block.", repairHint: "Wrap the requested content in a fenced code block." });
  if (format.blockquote && !/^>\s+/m.test(text)) defects.push({ code: "MISSING_BLOCKQUOTE", severity: "warning", message: "The response omitted the requested blockquote.", repairHint: "Add the requested blockquote." });
  if (format.numberedSections && !/^\s*(?:#{1,6}\s*)?1[.)]\s+/m.test(text)) defects.push({ code: "MISSING_NUMBERED_STRUCTURE", severity: "critical", message: "The response omitted the requested numbered structure.", repairHint: "Use the exact numbered section headings in the requested order." });
  defects.push(...literalHeadingDefects(text, intent));
  return defects;
}

export function judgeStreamsResponse(input: { userInstruction: string; responseText: string; intent: StreamsIntentDecision; hasImages?: boolean; hasFiles?: boolean; toolEvidenceCount?: number; citationCount?: number }): StreamsSemanticJudgment {
  const text = String(input.responseText || "").trim();
  const defects: StreamsSemanticJudgment["defects"] = [];
  if (!text) defects.push({ code: "EMPTY_RESPONSE", severity: "critical", message: "The response is empty." });
  if (genericOpening(text)) defects.push({ code: "GENERIC_OPENING", severity: "info", message: "The response begins with generic filler.", repairHint: "Begin with the answer or result." });
  if (genericClosing(text)) defects.push({ code: "GENERIC_CLOSING", severity: "warning", message: "The response ends with a generic follow-up offer.", repairHint: "Remove the automatic follow-up closing." });
  if (unsupportedActionClaim(text, input.toolEvidenceCount || 0)) defects.push({ code: "UNSUPPORTED_ACTION_CLAIM", severity: "critical", message: "The response claims an action completed without verified tool evidence.", repairHint: "State only what verified evidence proves." });
  if (screenshotOverclaim(text, Boolean(input.hasImages))) defects.push({ code: "IMAGE_OVERCLAIM", severity: "critical", message: "The response treats screenshot content as independently verified operational fact.", repairHint: "Attribute visible claims to the screenshot and state verification limits." });
  if (input.intent.requestedDepth === "exhaustive" && text.length < 1200) defects.push({ code: "UNDER_ANSWERED_EXHAUSTIVE", severity: "warning", message: "The response is too short for an exhaustive request.", repairHint: "Expand every required area without omitting material details." });
  if (input.intent.requestedDepth === "minimal" && text.length > 1600) defects.push({ code: "OVERLONG_MINIMAL", severity: "warning", message: "The response is much longer than the requested concise answer.", repairHint: "Condense to the direct answer." });
  defects.push(...formatDefects(text, input.intent));

  const criticalCount = defects.filter((defect) => defect.severity === "critical").length;
  const warningCount = defects.filter((defect) => defect.severity === "warning").length;
  const infoCount = defects.filter((defect) => defect.severity === "info").length;
  const base = clamp(1 - (criticalCount * 0.28 + warningCount * 0.1 + infoCount * 0.03));
  const formatPenalty = defects.some((defect) => /TABLE|JSON|XML|CSV|CODE_BLOCK|BLOCKQUOTE|NUMBERED|HEADING|FORMAT/.test(defect.code)) ? 0.35 : 0;
  const dimensions = {
    intentMatch: clamp(text ? 0.95 - (defects.some((defect) => defect.code === "UNDER_ANSWERED_EXHAUSTIVE") ? 0.18 : 0) : 0),
    factualCoverage: clamp(text ? 0.9 - criticalCount * 0.15 : 0),
    instructionAdherence: clamp(1 - formatPenalty - warningCount * 0.04),
    structure: clamp(1 - formatPenalty - (genericOpening(text) ? 0.05 : 0)),
    tone: clamp(0.95 - (genericOpening(text) ? 0.08 : 0) - (genericClosing(text) ? 0.08 : 0)),
    uncertainty: clamp(0.95 - (defects.some((defect) => defect.code === "IMAGE_OVERCLAIM") ? 0.5 : 0)),
    grounding: clamp(0.95 - (defects.some((defect) => defect.code === "UNSUPPORTED_ACTION_CLAIM") ? 0.8 : 0)),
    citationIntegrity: clamp(input.intent.needsCurrentInformation && (input.citationCount || 0) === 0 ? 0.65 : 0.95),
    toolTruthfulness: clamp(defects.some((defect) => defect.code === "UNSUPPORTED_ACTION_CLAIM") ? 0 : 1),
    concisionFit: clamp(0.95 - (defects.some((defect) => ["OVERLONG_MINIMAL", "UNDER_ANSWERED_EXHAUSTIVE"].includes(defect.code)) ? 0.3 : 0)),
  };
  const overallScore = clamp((Object.values(dimensions).reduce((sum, value) => sum + value, 0) / Object.keys(dimensions).length) * 0.65 + base * 0.35);
  const criticalDefect = criticalCount > 0;
  const threshold = input.intent.riskLevel === "high" || input.intent.complexity === "critical" ? 0.95 : 0.9;
  return { version: STREAMS_SEMANTIC_JUDGE_VERSION, overallScore, accepted: overallScore >= threshold && !criticalDefect, repairable: text.length > 0 && defects.every((defect) => defect.code !== "UNSUPPORTED_ACTION_CLAIM" || Boolean(input.toolEvidenceCount)), criticalDefect, dimensions, defects };
}
