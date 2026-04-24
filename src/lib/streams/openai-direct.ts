/**
 * src/lib/streams/openai-direct.ts
 *
 * Direct browser → OpenAI streaming.
 * Reads the OpenAI key from sessionStorage (set by SettingsTab on save).
 * Zero Vercel hop — browser calls OpenAI directly.
 */

import { getProviderKey } from "./provider-keys";

export type StreamChunkHandler = (delta: string) => void;
export type StreamDoneHandler  = () => void;
export type StreamErrorHandler = (err: string) => void;

export interface DirectStreamOptions {
  message:  string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  onDelta:  StreamChunkHandler;
  onDone:   StreamDoneHandler;
  onError:  StreamErrorHandler;
  signal?:  AbortSignal;
}

const SYSTEM_PROMPT = `You are Streams AI — a creative assistant for generating images, videos, voice and code.
Help users craft prompts, explain results, debug issues, and guide creative decisions.
Be concise and direct. When asked to generate something, guide the user to use the Generate tab.
Never fabricate generation results — you cannot generate media directly in chat.`;

export async function streamDirectFromOpenAI(opts: DirectStreamOptions): Promise<void> {
  const apiKey = getProviderKey("openai");
  if (!apiKey) {
    opts.onError("OpenAI key not set — go to Settings → API Keys, paste your key and save.");
    return;
  }

  const messages = [
    { role: "system" as const,    content: SYSTEM_PROMPT },
    ...(opts.history ?? []),
    { role: "user" as const,      content: opts.message },
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "gpt-4o",
        messages,
        stream:      true,
        max_tokens:  2048,
        temperature: 0.7,
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => `HTTP ${res.status}`);
      opts.onError(`OpenAI error ${res.status}: ${err.slice(0, 200)}`);
      return;
    }
    if (!res.body) { opts.onError("No response body from OpenAI"); return; }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") {
          if (trimmed === "data: [DONE]") { opts.onDone(); return; }
          continue;
        }
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const json  = JSON.parse(trimmed.slice(6)) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) opts.onDelta(delta);
          if (json.choices?.[0]?.finish_reason === "stop") { opts.onDone(); return; }
        } catch { /* malformed chunk — skip */ }
      }
    }
    opts.onDone();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    opts.onError(err instanceof Error ? err.message : "Stream error");
  }
}
