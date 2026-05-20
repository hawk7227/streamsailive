import { describe, expect, it, vi } from "vitest";
import { sendStreamsChatMessage } from "./streamsChatClient";

function response(body, headers = { "content-type": "application/json" }, status = 200) {
  return new Response(body, { status, headers });
}

function sse(chunks) {
  return new Response(chunks.join(""), {
    status: 200,
    headers: { "content-type": "text/event-stream" }
  });
}

describe("streamsChatClient", () => {
  it("posts to the streams chat backend and emits JSON assistant text", async () => {
    const originalFetch = globalThis.fetch;
    const onEvent = vi.fn();

    globalThis.fetch = vi.fn(async () =>
      response(JSON.stringify({ text: "Hello from backend." }))
    );

    const result = await sendStreamsChatMessage({
      message: "hello",
      onEvent,
    });

    const [, options] = globalThis.fetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/streams-ai/messages",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(body.message).toBe("hello");
    expect(body.input).toBe("hello");
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(result.text).toBe("Hello from backend.");
    expect(onEvent).toHaveBeenCalledWith({ type: "text_delta", delta: "Hello from backend." });
    expect(onEvent).toHaveBeenCalledWith({
      type: "response",
      token: "Hello from backend.",
      text: "Hello from backend.",
      data: { token: "Hello from backend.", text: "Hello from backend." },
    });
    expect(onEvent).toHaveBeenCalledWith({ type: "done", data: { text: "Hello from backend." } });

    globalThis.fetch = originalFetch;
  });

  it("consumes streams chat SSE response events", async () => {
    const originalFetch = globalThis.fetch;
    const onEvent = vi.fn();

    globalThis.fetch = vi.fn(async () =>
      sse([
        'event: activity\n',
        'data: {"phase":"thinking","mode":"conversation","statusText":"Thinking…"}\n\n',
        'event: response\n',
        'data: {"token":"Hello"}\n\n',
        'event: response\n',
        'data: {"token":"!"}\n\n',
        'event: complete\n',
        'data: {"elapsedMs":12}\n\n',
      ])
    );

    const result = await sendStreamsChatMessage({
      message: "hello",
      onEvent,
    });

    expect(result.text).toBe("Hello!");
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "activity",
      phase: "thinking",
      mode: "conversation"
    }));
    expect(onEvent).toHaveBeenCalledWith({ type: "text_delta", delta: "Hello" });
    expect(onEvent).toHaveBeenCalledWith({
      type: "response",
      token: "Hello",
      text: "Hello",
      data: { token: "Hello", text: "Hello" },
    });
    expect(onEvent).toHaveBeenCalledWith({ type: "text_delta", delta: "!" });
    expect(onEvent).toHaveBeenCalledWith({
      type: "response",
      token: "!",
      text: "!",
      data: { token: "!", text: "!" },
    });
    expect(onEvent).toHaveBeenCalledWith({ type: "done", data: { elapsedMs: 12 } });

    globalThis.fetch = originalFetch;
  });

  it("throws clearly when backend is not ok", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn(async () =>
      response(JSON.stringify({ error: "missing OpenAI key" }), { "content-type": "application/json" }, 500)
    );

    await expect(
      sendStreamsChatMessage({ message: "hello" })
    ).rejects.toThrow("Chat backend failed with 500: missing OpenAI key");

    globalThis.fetch = originalFetch;
  });
});
