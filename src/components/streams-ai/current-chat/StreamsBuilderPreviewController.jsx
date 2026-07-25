"use client";

import { useEffect, useRef } from "react";

const OPEN_EVENT = "streams:open-builder-preview";
const ACTIVE_KEY = "streams-ai:active-builder-preview";
const PREVIEW_URL_PATTERN = /\/streams-builder\/preview\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i;

function previewCompletionFromMessage(message = {}) {
  const metadata = message?.metadata || message?.meta || {};
  const failure = message?.failure || metadata?.failure || {};
  if (message?.status === "failed" || failure?.code) return null;

  const contentMatch = String(message?.content || "").match(PREVIEW_URL_PATTERN);
  const previewId = String(
    message?.previewId
      || message?.preview_id
      || metadata?.previewId
      || metadata?.preview_id
      || contentMatch?.[1]
      || "",
  ).trim();
  const previewUrl = String(
    message?.previewUrl
      || message?.preview_url
      || metadata?.previewUrl
      || metadata?.preview_url
      || contentMatch?.[0]
      || (previewId ? `/streams-builder/preview/${previewId}` : ""),
  ).trim();

  if (!previewId || !previewUrl) return null;

  return {
    previewId,
    previewUrl,
    operationId: String(
      message?.operationId
        || message?.operation_id
        || metadata?.operationId
        || metadata?.operation_id
        || previewId,
    ).trim(),
    artifacts: message?.artifacts || metadata?.artifacts || [],
  };
}

function persistHandoff(value) {
  try {
    window.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(value));
  } catch {}
}

/**
 * Current chat owns only completion detection and handoff.
 * Preview rendering, source editing, GitHub controls, diffs, logs, Codex status,
 * and follow-up builder work live exclusively in /streams-ai/streams-builder.
 */
export default function StreamsBuilderPreviewController({ chatRuntime }) {
  const lastKey = useRef("");

  useEffect(() => {
    const messages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
    const sessionId = String(chatRuntime?.sessionId || "").trim();
    if (!messages.length || !sessionId) return;

    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message?.role === "assistant");
    const completion = previewCompletionFromMessage(latestAssistant);
    if (!completion) return;

    const key = `${sessionId}:${latestAssistant?.id || messages.length}:${completion.previewId}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const handoff = {
      ...completion,
      sessionId,
      open: true,
      targetPane: "frontend",
      source: "builder-runtime",
      reason: "completed_builder_operation",
    };

    persistHandoff(handoff);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: handoff }));
  }, [chatRuntime?.messages, chatRuntime?.sessionId]);

  return null;
}
