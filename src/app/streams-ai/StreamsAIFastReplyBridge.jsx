"use client";

import { useEffect } from "react";

function encodeSseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function messageFromBody(init) {
  try {
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : {};
    return String(body?.message || body?.input || body?.prompt || body?.text || body?.content || "").trim();
  } catch {
    return "";
  }
}

function isSimpleGreeting(message) {
  const text = String(message || "").toLowerCase().replace(/[!?.\s]+$/g, "").trim();
  return /^(hi|hello|hey|yo|sup|gm|good morning|good afternoon|good evening|test)$/.test(text);
}

function replyFor(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("test")) return "I’m here and responding.";
  return "Hey — I’m here. What do you want to build, create, or fix next?";
}

function isStreamsMessagePost(input, init) {
  const raw = typeof input === "string" ? input : input?.url || "";
  let pathname = raw;
  try { pathname = new URL(raw, window.location.origin).pathname; } catch {}
  const method = String(init?.method || "GET").toUpperCase();
  return method === "POST" && pathname === "/api/streams-ai/messages";
}

function makeFastSseResponse(message) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const answer = replyFor(message);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSseEvent("activity", { phase: "fast_reply.started", statusText: "Replying…", source: "streams-ai-client-fast-reply", startedAt })));
      controller.enqueue(encoder.encode(encodeSseEvent("response", { token: answer })));
      controller.enqueue(encoder.encode(encodeSseEvent("complete", { ok: true, provider: "client", providerStatus: "ok", source: "streams-ai-client-fast-reply", elapsedMs: Date.now() - startedAt })));
      controller.close();
    }
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}

export default function StreamsAIFastReplyBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.__streamsAIFastReplyBridgeInstalled) return undefined;

    const originalFetch = window.fetch.bind(window);
    window.__streamsAIFastReplyBridgeInstalled = true;

    window.fetch = async (input, init = {}) => {
      if (isStreamsMessagePost(input, init)) {
        const message = messageFromBody(init);
        if (isSimpleGreeting(message)) return makeFastSseResponse(message);
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
      window.__streamsAIFastReplyBridgeInstalled = false;
    };
  }, []);

  return null;
}
