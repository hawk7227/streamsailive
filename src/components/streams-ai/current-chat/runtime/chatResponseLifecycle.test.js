import { describe, expect, it } from "vitest";
import {
  acceptChatCompletion,
  beginChatTurn,
  createChatTurnIdentity,
  isActiveChatTurn,
  reconcileChatMessages,
} from "./chatResponseLifecycle";

function activeTurn(overrides = {}) {
  return beginChatTurn(createChatTurnIdentity({
    turnId: "turn-1",
    clientRequestId: "request-1",
    assistantMessageId: "assistant-local-1",
    ...overrides,
  }));
}

describe("Streams Chat response lifecycle", () => {
  it("accepts exactly one completion for a turn", () => {
    const first = acceptChatCompletion(activeTurn(), { turnId: "turn-1", assistantMessageId: "assistant-server-1" });
    const second = acceptChatCompletion(first.turn, { turnId: "turn-1", assistantMessageId: "assistant-server-1" });

    expect(first.accepted).toBe(true);
    expect(first.turn).toMatchObject({ state: "complete", completed: true, serverMessageId: "assistant-server-1" });
    expect(second.accepted).toBe(false);
  });

  it("rejects a late completion from an obsolete turn", () => {
    const turn = activeTurn({ turnId: "turn-new", clientRequestId: "request-new" });
    expect(acceptChatCompletion(turn, { turnId: "turn-old", assistantMessageId: "assistant-old" }).accepted).toBe(false);
    expect(isActiveChatTurn(turn, "turn-old", "request-old")).toBe(false);
    expect(isActiveChatTurn(turn, "turn-new", "request-new")).toBe(true);
  });

  it("reconciles an optimistic assistant with its persisted identity", () => {
    const messages = reconcileChatMessages(
      [{ id: "assistant-local-1", role: "assistant", turnId: "turn-1", content: "Hello", status: "streaming", isStreaming: true }],
      [{ id: "assistant-server-1", role: "assistant", turnId: "turn-1", content: "Hello", status: "complete" }],
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ id: "assistant-local-1", serverMessageId: "assistant-server-1", turnId: "turn-1", status: "complete", isStreaming: false });
  });

  it("deduplicates a persisted echo by server message identity", () => {
    const messages = reconcileChatMessages(
      [{ id: "assistant-local-1", serverMessageId: "assistant-server-1", role: "assistant", turnId: "turn-1", content: "Done", status: "complete" }],
      [{ id: "assistant-server-1", role: "assistant", turnId: "turn-1", content: "Done", status: "complete" }],
    );
    expect(messages).toHaveLength(1);
  });

  it("preserves identical response text from distinct turns", () => {
    const messages = reconcileChatMessages([], [
      { id: "assistant-server-1", role: "assistant", turnId: "turn-1", content: "Same answer", status: "complete" },
      { id: "assistant-server-2", role: "assistant", turnId: "turn-2", content: "Same answer", status: "complete" },
    ]);
    expect(messages).toHaveLength(2);
  });

  it("keeps the user and assistant records distinct within one turn", () => {
    const messages = reconcileChatMessages([], [
      { id: "user-server-1", role: "user", turnId: "turn-1", content: "Question", status: "complete" },
      { id: "assistant-server-1", role: "assistant", turnId: "turn-1", content: "Answer", status: "complete" },
    ]);
    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
  });
});
