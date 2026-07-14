import type { StreamsIntentDecision } from "../runtime/intent-engine";

export const STREAMS_LITERAL_HEADING_ENFORCER_VERSION = "streams-literal-heading-enforcer-v1";

function normalizeComparable(value: string) {
  return String(value || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/^\s*(?:\d+[.)]|[A-Za-z][.)]|[IVXLCDM]+[.)])\s+/i, "")
    .replace(/\*\*/g, "")
    .replace(/__+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function literalLine(value: string) {
  return String(value || "").replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").replace(/__+/g, "").trim();
}

export function enforceLiteralRequestedHeadings(responseText: string, intent: StreamsIntentDecision) {
  const requested = Array.isArray(intent.requestedFormat.headings)
    ? intent.requestedFormat.headings.map((heading) => String(heading || "").trim()).filter(Boolean)
    : [];
  if (!requested.length || intent.requestedFormat.json || intent.requestedFormat.xml || intent.requestedFormat.csv) {
    return { content: String(responseText || ""), changed: false, version: STREAMS_LITERAL_HEADING_ENFORCER_VERSION };
  }

  const lines = String(responseText || "").replace(/\r\n/g, "\n").split("\n");
  const used = new Set<number>();
  let changed = false;

  for (const exactHeading of requested) {
    const exact = literalLine(exactHeading);
    const exactIndex = lines.findIndex((line, index) => !used.has(index) && literalLine(line) === exact);
    if (exactIndex >= 0) {
      used.add(exactIndex);
      continue;
    }

    const body = normalizeComparable(exactHeading);
    const bodyIndex = lines.findIndex((line, index) => !used.has(index) && normalizeComparable(line) === body);
    if (bodyIndex >= 0) {
      lines[bodyIndex] = exactHeading;
      used.add(bodyIndex);
      changed = true;
    }
  }

  return {
    content: lines.join("\n"),
    changed,
    version: STREAMS_LITERAL_HEADING_ENFORCER_VERSION,
  };
}
