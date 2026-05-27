type OpenAIEditorOptions = {
  system?: string;
  temperature?: number;
};

function getEditorModel() {
  return process.env.OPENAI_EDITOR_MODEL || process.env.OPENAI_MODEL || "gpt-4.1";
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;

  const parts = Array.isArray(data?.output)
    ? data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    : [];

  return parts.map((part: any) => part?.text || "").join("").trim();
}

export async function callOpenAIForEditor(prompt: string, options: OpenAIEditorOptions = {}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for editor actions.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getEditorModel(),
      temperature: options.temperature ?? 0.2,
      input: [
        {
          role: "system",
          content:
            options.system ||
            "You are the STREAMS editor. Return only the requested artifact. Do not include markdown fences or explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI editor request failed.");
  }

  const output = extractOutputText(data);

  if (!output) {
    throw new Error("OpenAI editor returned empty output.");
  }

  return output.trim();
}

export function stripCodeFences(value: string) {
  return String(value || "")
    .replace(/^```[a-zA-Z0-9_-]*\s*/, "")
    .replace(/```$/g, "")
    .trim();
}

export function assertCompleteHtml(value: string) {
  const html = stripCodeFences(value);

  if (!/<!doctype html|<html[\s>]/i.test(html)) {
    throw new Error("OpenAI editor output was not a complete HTML document.");
  }

  if (/```/.test(html)) {
    throw new Error("OpenAI editor output included markdown fences.");
  }

  return html;
}

export function assertLikelyTsx(value: string) {
  const tsx = stripCodeFences(value);

  if (!/export\s+default|function\s+[A-Z]|const\s+[A-Z][A-Za-z0-9_]*\s*=|<[A-Za-z][\s\S]*>/m.test(tsx)) {
    throw new Error("OpenAI editor output was not a complete TSX/JSX candidate.");
  }

  if (/```/.test(tsx)) {
    throw new Error("OpenAI editor output included markdown fences.");
  }

  return tsx;
}
