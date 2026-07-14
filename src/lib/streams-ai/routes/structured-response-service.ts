import { validateResponseStructure } from "./response-structure-validator";

export type CollectedSseResponse = {
  content: string;
  completePayload: Record<string, any> | null;
  errorPayload: Record<string, any> | null;
};

type ParsedSseEvent = { eventName: string; payload: Record<string, any> };

function parseSseBuffer(buffer: string) {
  const events: ParsedSseEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";

  for (const part of parts) {
    let eventName = "message";
    const dataLines: string[] = [];
    for (const rawLine of part.split("\n")) {
      const line = rawLine.trimEnd();
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    const raw = dataLines.join("\n");
    if (!raw) continue;
    try {
      events.push({ eventName, payload: JSON.parse(raw) });
    } catch {
      events.push({ eventName, payload: { message: raw } });
    }
  }

  return { events, rest };
}

export async function collectSseResponse(
  response: Response,
  onActivity?: (payload: Record<string, unknown>) => void,
): Promise<CollectedSseResponse> {
  if (!response.body) throw new Error("Response stream was unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let completePayload: Record<string, any> | null = null;
  let errorPayload: Record<string, any> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;

    for (const event of parsed.events) {
      if (event.eventName === "activity") {
        const statusText = String(event.payload?.statusText || "").trim();
        if (statusText) onActivity?.({ phase: event.payload?.phase || "working", statusText });
      } else if (event.eventName === "response" || event.eventName === "reasoning") {
        content += String(event.payload?.token || event.payload?.delta || event.payload?.text || "");
      } else if (event.eventName === "complete") {
        completePayload = event.payload;
      } else if (event.eventName === "error") {
        errorPayload = event.payload;
      }
    }
  }

  return { content, completePayload, errorPayload };
}

function extractResponseText(json: any) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const parts: string[] = [];
  for (const item of Array.isArray(json?.output) ? json.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) parts.push(content.text.trim());
    }
  }
  return parts.join("\n\n").trim();
}

export async function repairStructuredResponse(input: {
  instruction: string;
  draft: string;
  missing: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Assistant repair service is unavailable");
  const model = process.env.OPENAI_RESPONSES_MODEL_NEXT
    || process.env.OPENAI_RESPONSES_MODEL
    || process.env.OPENAI_SEARCH_MODEL
    || "gpt-4.1-mini";

  const repairInstruction = [
    "Repair the draft so it follows the user's requested output structure exactly.",
    `Missing requirements: ${input.missing.join(", ")}.`,
    "Preserve the draft's supported facts and conclusions. Do not add new factual claims.",
    "For screenshot claims, retain explicit attribution such as 'The screenshot shows' or 'The screenshot displays'.",
    "Return only the complete repaired answer, with no commentary about the repair.",
    "",
    "USER INSTRUCTION:",
    input.instruction,
    "",
    "DRAFT:",
    input.draft,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: repairInstruction }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Structured response repair failed");
  const repaired = extractResponseText(json);
  if (!repaired) throw new Error("Structured response repair returned no text");
  return repaired;
}

export async function validateAndRepairResponse(input: {
  instruction: string;
  draft: string;
  forceRepair?: boolean;
}) {
  let content = input.draft;
  let validation = validateResponseStructure(input.instruction, content);
  let repaired = false;

  if (input.forceRepair || !validation.valid) {
    content = await repairStructuredResponse({
      instruction: input.instruction,
      draft: content,
      missing: validation.missing.length ? validation.missing : ["valid completed response"],
    });
    validation = validateResponseStructure(input.instruction, content);
    repaired = true;
  }

  if (!validation.valid) {
    throw new Error(`Repaired response did not satisfy requested structure: ${validation.missing.join(", ")}`);
  }

  return { content, validation, repaired };
}
