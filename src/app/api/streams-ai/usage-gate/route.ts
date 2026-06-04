import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIUsageRepository } from "@/lib/streams-ai/repositories/usage-repository";
import { STREAMS_AI_USAGE_MESSAGES, type StreamsAIFeatureCostKey } from "@/lib/streams-ai/usage-policy";

const usage = new StreamsAIUsageRepository();

function setupUnavailable(error: unknown) {
  console.error("[streams-ai-usage-precheck-error]", error);
  return streamsAIJson(
    {
      ok: false,
      allowed: false,
      code: "usage_setup_unavailable",
      message: STREAMS_AI_USAGE_MESSAGES.backendSetupUnavailable,
    },
    503,
  );
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      featureKey?: StreamsAIFeatureCostKey;
      stage?: "draft" | "final";
      credits?: number;
      relatedJobId?: string | null;
      relatedSessionId?: string | null;
      confirmPaidUsage?: boolean;
    }>(request);

    const result = await usage.gate(scope, body);
    return streamsAIJson(result, result.allowed ? 200 : 409);
  } catch (error) {
    return setupUnavailable(error);
  }
}
