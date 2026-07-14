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

export function validateResponseStructure(instruction: string, response: string): ResponseStructureValidation {
  const request = String(instruction || "");
  const output = String(response || "");
  const missing: string[] = [];

  if (!output.trim()) missing.push("non-empty response");
  if (asksForTable(request) && !hasMarkdownTable(output)) missing.push("Markdown table");
  if (asksForCodeBlock(request) && !/```[\s\S]*?```/.test(output)) missing.push("fenced code block");
  if (asksForBlockquote(request) && !/(^|\n)\s*>\s+\S/.test(output)) missing.push("blockquote");
  if (asksForNumberedSections(request) && !/(^|\n)\s*1[.)]\s+/.test(output)) missing.push("numbered sections");

  for (const column of requestedColumns(request)) {
    if (!hasRequestedColumn(output, column)) missing.push(`table column: ${column}`);
  }

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
