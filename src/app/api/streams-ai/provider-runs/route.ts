import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIProviderRunsRepository } from "@/lib/streams-ai/repositories/provider-runs-repository";

const providerRuns = new StreamsAIProviderRunsRepository();

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const jobId = request.nextUrl.searchParams.get("jobId");
    const data = await providerRuns.list(scope, { jobId });
    return streamsAIJson({ ok: true, providerRuns: data });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      jobId?: string | null;
      provider?: string;
      model?: string | null;
      status?: string;
      requestJson?: Record<string, unknown>;
      responseJson?: Record<string, unknown> | null;
      outputAssetId?: string | null;
      error?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
    }>(request);

    if (!body.provider?.trim()) {
      return streamsAIJson({ ok: false, error: "provider is required" }, 400);
    }

    const providerRun = await providerRuns.create(scope, {
      jobId: body.jobId,
      provider: body.provider,
      model: body.model,
      status: body.status,
      requestJson: body.requestJson,
      responseJson: body.responseJson,
      outputAssetId: body.outputAssetId,
      error: body.error,
      startedAt: body.startedAt,
      completedAt: body.completedAt,
    });

    return streamsAIJson({ ok: true, providerRun }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}
