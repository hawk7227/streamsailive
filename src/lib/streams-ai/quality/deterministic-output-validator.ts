import type { StreamsIntentDecision } from "../runtime/intent-engine";
import { enforceSupplement2Response, validateSupplement2Request } from "../runtime/authorized-supplement-2-policy";

export const STREAMS_DETERMINISTIC_OUTPUT_VALIDATOR_VERSION = "streams-deterministic-output-validator-v3-supplement-2";

export type StreamsDeterministicDefect = {
  code: string;
  message: string;
  repairHint: string;
};

export type StreamsDeterministicValidation = {
  version: string;
  accepted: boolean;
  critical: boolean;
  defects: StreamsDeterministicDefect[];
};

function stripFence(value: string, language?: string) {
  let text = String(value || "").trim();
  const opening = language ? new RegExp("^```" + language + "\\s*", "i") : /^```[a-zA-Z0-9_-]*\s*/;
  text = text.replace(opening, "").replace(/\s*```$/, "");
  return text.trim();
}

function requestedJsonKeys(instruction: string) {
  const block = String(instruction || "").match(/\{[\s\S]*?\}/)?.[0];
  return block ? Array.from(block.matchAll(/["']([^"']+)["']\s*:/g)).map((match) => match[1]) : [];
}

function requestedTableColumns(instruction: string) {
  const lines = String(instruction || "").replace(/\r\n/g, "\n").split("\n");
  const marker = lines.findIndex((line) => /columns?\s*(?:in\s+this\s+order)?\s*:?\s*$/i.test(line.trim()));
  const candidates = marker >= 0 ? lines.slice(marker + 1) : lines;
  const row = candidates.find((line) => line.includes("|") && !/^\s*\|?\s*:?-{3,}/.test(line));
  return row ? row.split("|").map((value) => value.trim()).filter(Boolean) : [];
}

function requestedDataRowCount(instruction: string) {
  const match = String(instruction || "").match(/(?:include|with|return)?\s*exactly\s+(\d+)\s+(?:data\s+)?rows?\b/i);
  return match ? Number(match[1]) : null;
}

function parseMarkdownTable(response: string) {
  const lines = String(response || "").replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim());
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].includes("|") || !/^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) continue;
    const columns = lines[index].split("|").map((value) => value.trim()).filter(Boolean);
    const rows: string[][] = [];
    let cursor = index + 2;
    for (; cursor < lines.length && lines[cursor].includes("|"); cursor += 1) rows.push(lines[cursor].split("|").map((value) => value.trim()).filter(Boolean));
    return { columns, rows, start: index, end: cursor, allLines: lines };
  }
  return null;
}

function sameList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value.trim().toLowerCase() === right[index]?.trim().toLowerCase());
}

function countFormatKinds(intent: StreamsIntentDecision) {
  return [intent.requestedFormat.json, intent.requestedFormat.xml, intent.requestedFormat.csv, intent.requestedFormat.table].filter(Boolean).length;
}

function explainsFormatConflict(response: string) {
  return /\b(?:cannot|can't|mutually exclusive|conflicting requirements|choose one|which format)\b/i.test(response);
}

export function validateDeterministicStreamsOutput(input: { instruction: string; responseText: string; intent: StreamsIntentDecision }): StreamsDeterministicValidation {
  const instruction = String(input.instruction || "");
  const trimmed = String(input.responseText || "").trim();
  const format = input.intent.requestedFormat;
  const defects: StreamsDeterministicDefect[] = [];

  if (!trimmed) defects.push({ code: "EMPTY_RESPONSE", message: "The response is empty.", repairHint: "Return a complete response." });

  const supplementRequest = validateSupplement2Request({
    userMessage: instruction,
    hasFiles: Boolean(input.intent.needsFiles),
    hasImages: Boolean(input.intent.needsImages),
    imageEditTargetPresent: Boolean(input.intent.needsImages),
    currentInformation: Boolean(input.intent.needsCurrentInformation),
  });
  if (!supplementRequest.accepted) {
    defects.push({ code: supplementRequest.code, message: supplementRequest.message, repairHint: "Ask the user to upload or identify the exact image target. Do not claim an edit was performed." });
  }

  const supplementResponse = enforceSupplement2Response({ userMessage: instruction, responseText: trimmed });
  for (const code of supplementResponse.defects) {
    defects.push({
      code,
      message: code === "LANGUAGE_INCONSISTENCY" ? "The response does not remain in the user’s language." : "The response violates an authorized supplement output boundary.",
      repairHint: code === "LANGUAGE_INCONSISTENCY" ? "Rewrite the complete response in the user’s language." : "Remove hidden operational disclosure and unsupported future or background promises.",
    });
  }
  if (supplementResponse.content !== trimmed) {
    defects.push({
      code: "SUPPLEMENT_OUTPUT_NORMALIZATION_REQUIRED",
      message: "The response contains a generic offer ending or a raw internal source identifier.",
      repairHint: "Remove generic offer-to-help endings and replace raw internal reference IDs with rendered citations or natural source references.",
    });
  }

  const conflictingFormats = format.exact && countFormatKinds(input.intent) > 1;
  if (conflictingFormats && !explainsFormatConflict(trimmed)) {
    defects.push({ code: "CONFLICTING_EXACT_FORMATS", message: "The request requires mutually exclusive exact output formats.", repairHint: "Explain that both exact formats cannot be satisfied simultaneously and ask which format should control." });
  }
  if (conflictingFormats && explainsFormatConflict(trimmed)) return { version: STREAMS_DETERMINISTIC_OUTPUT_VALIDATOR_VERSION, accepted: defects.length === 0, critical: defects.length > 0, defects };

  if (format.json) {
    const raw = stripFence(trimmed, "json");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { defects.push({ code: "INVALID_JSON", message: "The response is not valid JSON.", repairHint: "Return valid JSON only, with no Markdown fence or surrounding prose." }); }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const expectedKeys = requestedJsonKeys(instruction);
      const actualKeys = Object.keys(parsed as Record<string, unknown>);
      if (expectedKeys.length && !sameList(actualKeys, expectedKeys)) defects.push({ code: "WRONG_JSON_KEYS", message: "The JSON keys or key order do not match the requested structure.", repairHint: `Use exactly these keys in order: ${expectedKeys.join(", ")}.` });
    }
    if (/return\s+only\s+valid\s+json|do\s+not\s+include\s+markdown|no\s+text\s+outside/i.test(instruction) && raw !== trimmed) defects.push({ code: "JSON_HAS_WRAPPER", message: "The JSON response includes a Markdown fence or surrounding text.", repairHint: "Return the raw JSON object only." });
  }

  if (format.table) {
    const table = parseMarkdownTable(trimmed);
    if (!table) defects.push({ code: "MISSING_MARKDOWN_TABLE", message: "The requested Markdown table is missing or malformed.", repairHint: "Return a valid Markdown table with a header row and divider row." });
    else {
      const expectedColumns = requestedTableColumns(instruction);
      if (expectedColumns.length && !sameList(table.columns, expectedColumns)) defects.push({ code: "WRONG_TABLE_COLUMNS", message: "The table columns or their order do not match the request.", repairHint: `Use exactly these columns in order: ${expectedColumns.join(" | ")}.` });
      const expectedRows = requestedDataRowCount(instruction);
      if (expectedRows !== null && table.rows.length !== expectedRows) defects.push({ code: "WRONG_TABLE_ROW_COUNT", message: `The table has ${table.rows.length} data rows instead of ${expectedRows}.`, repairHint: `Return exactly ${expectedRows} data rows.` });
      if (/return\s+only\s+(?:a\s+)?markdown\s+table/i.test(instruction) && (table.start !== 0 || table.end !== table.allLines.length)) defects.push({ code: "TABLE_HAS_WRAPPER", message: "Text appears outside the table even though only a table was requested.", repairHint: "Return only the Markdown table." });
    }
  }

  if (format.codeBlock && !/```[\s\S]*```/.test(trimmed)) defects.push({ code: "MISSING_CODE_BLOCK", message: "The requested fenced code block is missing.", repairHint: "Wrap the requested code in a fenced code block." });
  if (format.blockquote && !/(^|\n)\s*>\s+\S/.test(trimmed)) defects.push({ code: "MISSING_BLOCKQUOTE", message: "The requested blockquote is missing.", repairHint: "Use Markdown blockquote syntax for the requested content." });

  return { version: STREAMS_DETERMINISTIC_OUTPUT_VALIDATOR_VERSION, accepted: defects.length === 0, critical: defects.length > 0, defects };
}
