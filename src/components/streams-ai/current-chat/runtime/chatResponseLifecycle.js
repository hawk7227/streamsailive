const TERMINAL_STATES = new Set(["complete", "error", "failed", "cancelled"]);

export function createChatTurnIdentity({ turnId, clientRequestId, assistantMessageId, sessionId = "" }) {
  return {
    turnId: String(turnId || ""),
    clientRequestId: String(clientRequestId || ""),
    assistantMessageId: String(assistantMessageId || ""),
    sessionId: String(sessionId || ""),
    serverMessageId: "",
    state: "created",
    completed: false,
  };
}

export function beginChatTurn(turn) {
  if (!turn || turn.state !== "created") return turn;
  return { ...turn, state: "streaming" };
}

export function acceptChatCompletion(turn, payload = {}) {
  if (!turn || turn.completed || TERMINAL_STATES.has(turn.state)) {
    return { accepted: false, turn };
  }

  const payloadTurnId = String(payload.turnId || "");
  if (payloadTurnId && payloadTurnId !== turn.turnId) {
    return { accepted: false, turn };
  }

  return {
    accepted: true,
    turn: {
      ...turn,
      state: "complete",
      completed: true,
      serverMessageId: String(payload.assistantMessageId || turn.serverMessageId || ""),
    },
  };
}

function messageIdKeys(message = {}) {
  return [message.id, message.serverMessageId]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function messagesMatch(left, right) {
  const leftIds = new Set(messageIdKeys(left));
  if (messageIdKeys(right).some((key) => leftIds.has(key))) return true;
  const leftTurnId = String(left?.turnId || "").trim();
  const rightTurnId = String(right?.turnId || "").trim();
  return Boolean(leftTurnId && leftTurnId === rightTurnId && left?.role === right?.role);
}

export function reconcileChatMessages(currentMessages = [], incomingMessages = []) {
  const reconciled = [...currentMessages];

  for (const incoming of incomingMessages) {
    const index = reconciled.findIndex((current) => messagesMatch(current, incoming));
    if (index === -1) {
      reconciled.push(incoming);
      continue;
    }

    const current = reconciled[index];
    reconciled[index] = {
      ...current,
      ...incoming,
      id: current.id || incoming.id,
      serverMessageId: incoming.serverMessageId || incoming.id || current.serverMessageId || "",
      turnId: incoming.turnId || current.turnId || "",
      isStreaming: incoming.status === "complete" ? false : current.isStreaming,
    };
  }

  return reconciled.filter((message, index, all) =>
    all.findIndex((candidate) => messagesMatch(candidate, message)) === index
  );
}

export function isActiveChatTurn(activeTurn, turnId, clientRequestId) {
  if (!activeTurn || activeTurn.completed) return false;
  if (turnId && activeTurn.turnId !== turnId) return false;
  if (clientRequestId && activeTurn.clientRequestId !== clientRequestId) return false;
  return true;
}
