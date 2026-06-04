import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIUsageRepository } from "@/lib/streams-ai/repositories/usage-repository";
import { STREAMS_AI_USAGE_MESSAGES } from "@/lib/streams-ai/usage-policy";

const usage = new StreamsAIUsageRepository();

function accountControlUnavailable(error: unknown) {
  console.error("[streams-ai-usage-api-error]", error);
  return streamsAIJson(
    {
      ok: false,
      code: "usage_setup_unavailable",
      message: STREAMS_AI_USAGE_MESSAGES.backendSetupUnavailable,
    },
    503,
  );
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const state = await usage.getUsageState(scope);
    return streamsAIJson(state);
  } catch (error) {
    return accountControlUnavailable(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      paidUsageEnabled?: boolean;
      autoReloadEnabled?: boolean;
      reloadThresholdUsd?: number;
      reloadTopUpUsd?: number;
      monthlySpendLimitUsd?: number | null;
    }>(request);

    const state = await usage.updateSettings(scope, body);
    return streamsAIJson(state);
  } catch (error) {
    return accountControlUnavailable(error);
  }
}
