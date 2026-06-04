import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAISettingsRepository } from "@/lib/streams-ai/repositories/settings-repository";
import type { StreamsSettingsCategory } from "@/lib/streams-ai/settings-policy";

const settings = new StreamsAISettingsRepository();

function safeSettingsError(error: unknown) {
  console.error("[streams-ai-settings-api-error]", error);
  const raw = error instanceof Error ? error.message : "Settings are not available yet.";
  const message = raw
    .replace(/\bAPI\b/g, "account control")
    .replace(/schema cache/gi, "account setup")
    .replace(/streams_ai_[a-z_]+/gi, "account record")
    .replace(/backend/gi, "account system");

  return streamsAIJson({ ok: false, message }, 503);
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const category = request.nextUrl.searchParams.get("category") as StreamsSettingsCategory | null;
    const state = await settings.list(scope, category);
    return streamsAIJson(state);
  } catch (error) {
    return safeSettingsError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{ category?: string; key?: string; value?: string | boolean | number | null }>(request);
    const result = await settings.update(scope, body);
    return streamsAIJson(result);
  } catch (error) {
    return safeSettingsError(error);
  }
}
