export type ResponseStructureValidation = {
  valid: boolean;
  missing: string[];
};

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
  const value = String(text || "").trim();
  if (!value) return false;
  return /\b(review|analy[sz]e|describe|inspect|summari[sz]e)\b[\s\S]{0,80}\b(attached|screenshot|image|file|dashboard)\b/i.test(value)
    || /\b(attached|screenshot|image|dashboard)\b[\s\S]{0,80}\b(review|analy[sz]e|describe|inspect|summari[sz]e)\b/i.test(value)
    || /^review the attached files?\.?$/i.test(value);
}

function hasMarkdownTable(text: string) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index];
    const divider = lines[index + 1];
    if (/^\s*\|.*\|\s*$/.test(header) && /^\s*\|?\s*:?-{3,}/.test(divider) && divider.includes("|")) return true;
  }
  return false;
}

function hasRequestedColumn(content: string, column: string) {
  return content.toLowerCase().includes(column.trim().toLowerCase());
}

function requestedColumns(instruction: string) {
  const match = instruction.match(/columns?\s*:?\s*\n?\s*([^\n]+)/i);
  if (!match) return [];
  const line = match[1];
  if (!line.includes("|")) return [];
  return line.split("|").map((value) => value.trim()).filter(Boolean);
}

function screenshotColumns() {
  return ["Visible claim", "Verified by screenshot?", "Evidence still required"];
}

function hasScreenshotAttribution(output: string) {
  return /\b(the screenshot shows|the screenshot displays|the visible interface (?:shows|states|displays))\b/i.test(output);
}

function hasVerificationLanguage(output: string) {
  return /\bdoes not (?:independently )?verify\b|\bnot independently verified\b|\bverification requires\b/i.test(output);
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
    || requestedColumns(request).length > 0;
}

export function validateResponseStructure(instruction: string, response: string): ResponseStructureValidation {
  const request = String(instruction || "");
  const output = String(response || "");
  const missing: string[] = [];
  const screenshotReview = isScreenshotReviewRequest(request);

  if (!output.trim()) missing.push("non-empty response");
  if ((asksForTable(request) || screenshotReview) && !hasMarkdownTable(output)) missing.push("Markdown table");
  if ((asksForCodeBlock(request) || screenshotReview) && !/```[\s\S]*?```/.test(output)) missing.push("fenced code block");
  if ((asksForBlockquote(request) || screenshotReview) && !/(^|\n)\s*>\s+\S/.test(output)) missing.push("blockquote");
  if (asksForNumberedSections(request) && !/(^|\n)\s*1[.)]\s+/.test(output)) missing.push("numbered sections");

  const columns = requestedColumns(request);
  const expectedColumns = columns.length ? columns : screenshotReview ? screenshotColumns() : [];
  for (const column of expectedColumns) {
    if (!hasRequestedColumn(output, column)) missing.push(`table column: ${column}`);
  }

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
