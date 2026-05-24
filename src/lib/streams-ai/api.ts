import { NextResponse } from "next/server";
import { StreamsAIAuthError } from "./auth";

export function streamsAIJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function streamsAIError(error: unknown) {
  console.error("[streams-ai-api-error]", error);
  const message = error instanceof Error ? error.message : "Unknown STREAMS AI error";
  const status = error instanceof StreamsAIAuthError ? error.status : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function readJsonBody<T extends Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}
