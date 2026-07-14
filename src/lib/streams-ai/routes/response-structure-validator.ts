export type ResponseStructureValidation = {
  valid: boolean;
  missing: string[];
};

const ATTACHMENT_ONLY_SENTINEL = "\u200B";

function asksForTable(text: string) {
  return /\b(markdown\s+)?table\b/i.test(text) || /\|\s*[^|]+\s*\|\s*[^|]+\s*\|/.test(text);
}

function asksForCodeBlock(text: string) {
  return /\b(fenced\s+)?code\s+block\b/i.test(text) || /```/.test(text);
}

function asksForBlockquote(text: string) {
  return /\bblockquote\b/i.test(text) || /(^|\n)\s*>\s*/.test(text);
}

function asksForNumberedSections(text: string) {
  return /(?:^|\n)\s*1[.)]\s+/.test(text) && /(?:^|\n)\s*2[.)]\s+/.test(text);
}

function isScreenshotReviewRequest(text: string) {
  const raw = String(text || "");
  const value = raw.trim();
  if (raw === ATTACHMENT_ONLY_SENTINEL || value === ATTACHMENT_ONLY_SENTINEL) return true;
  if (!value) return false;
  return /\b(review|analy[sz]e|describe|inspect|summari[sz]e)\b[\s\S]{0,80}\b(attached|screenshot|image|file|dashboard)\b/i.test(value)
    || /\b(attached|screenshot|image|dashboard)\b[\s\S]{0,80}\b(review|analy[sz]e|describe|inspect|summari[sz]e)\b/i.test(value)
    || /^review the attached files?\.?$/i.test(value)
    || /^(?:what is|what's|describe|review|analy[sz]e|inspect)\s+(?:this|it)\??$/i.test(value);
}

function parseMarkdownTable(text: string) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index];
    const divider = lines[index + 1];
    if (/^\s*\|.*\|\s*$/.test(header) && /^\s*\|?\s*:?-{3,}/.test(divider) && divider.includes("|")) {
      return header.split("|").map((value) => value.trim()).filter(Boolean);
    }
  }
  return null;
}

function requestedColumns(instruction: string) {
  const lines = String(instruction || "").replace(/\r\n/g, "\n").split("\n");
  const marker = lines.findIndex((line) => /columns?\s*(?:in\s+this\s+order)?\s*:?\s*$/i.test(line.trim()));
  const candidates = marker >= 0 ? lines.slice(marker + 1) : lines;
  const row = candidates.find((line) => line.includes("|") && !/^\s*\|?\s*:?-{3,}/.test(line));
  return row ? row.split("|").map((value) => value.trim()).filter(Boolean) : [];
}

function sameColumns(actual: string[], expected: string[]) {
  return actual.length === expected.length && actual.every((value, index) => value.toLowerCase() === expected[index]?.toLowerCase());
}

function hasScreenshotAttribution(output: string) {
  return /\b(the screenshot shows|the screenshot displays|the visible interface (?:shows|states|displays))\b/i.test(output);
}

function hasVerificationLanguage(output: string) {
  return /\bdoes not (?:independently )?verify\b|\bnot independently verified\b|\bverification requires\b|\bcannot independently verify\b/i.test(output);
}

function hasGenericFollowupFiller(output: string) {
  return /\bif you (?:want|need|would like)[\s\S]{0,120}\b(?:let me know|i can help|please ask)\b/i.test(output)
    || /\bplease let me know\b/i.test(output);
}

export function requiresDeterministicStructureCheck(instruction: string) {
  const request = String(instruction || "");
  return isScreenshotReviewRequest(request)
    || asksForTable(request)
    || asksForCodeBlock(request)
    || asksForBlockquote(request)
    || asksForNumberedSections(request)
    || requestedColumns(request).length > 0
    || /\bjson\b|\bxml\b|\bcsv\b/i.test(request);
}

export function validateResponseStructure(instruction: string, response: string): ResponseStructureValidation {
  const request = String(instruction || "");
  const output = String(response || "");
  const missing: string[] = [];
  const screenshotReview = isScreenshotReviewRequest(request);

  if (!output.trim()) missing.push("non-empty response");

  if (asksForTable(request)) {
    const actualColumns = parseMarkdownTable(output);
    if (!actualColumns) missing.push("Markdown table");
    const expectedColumns = requestedColumns(request);
    if (actualColumns && expectedColumns.length && !sameColumns(actualColumns, expectedColumns)) missing.push(`exact table columns in order: ${expectedColumns.join(" | ")}`);
  }

  if (asksForCodeBlock(request) && !/```[\s\S]*?```/.test(output)) missing.push("fenced code block");
  if (asksForBlockquote(request) && !/(^|\n)\s*>\s+\S/.test(output)) missing.push("blockquote");
  if (asksForNumberedSections(request) && !/(^|\n)\s*1[.)]\s+/.test(output)) missing.push("numbered sections");

  if (screenshotReview && !hasScreenshotAttribution(output)) missing.push("screenshot attribution language");
  if (screenshotReview && !hasVerificationLanguage(output)) missing.push("verification note");
  if (screenshotReview && hasGenericFollowupFiller(output)) missing.push("remove generic follow-up filler");

  return { valid: missing.length === 0, missing };
}

export function assertResponseStructure(instruction: string, response: string) {
  const result = validateResponseStructure(instruction, response);
  if (!result.valid) {
    const error = new Error(`RESPONSE_STRUCTURE_INVALID: ${result.missing.join(", ")}`);
    (error as Error & { code?: string; missing?: string[] }).code = "RESPONSE_STRUCTURE_INVALID";
    (error as Error & { code?: string; missing?: string[] }).missing = result.missing;
    throw error;
  }
  return result;
}
