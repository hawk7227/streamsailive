export function createStatusMessage({
  id,
  role = "assistant",
  content,
  phase = "thinking",
  mode = "chat",
  createdAt = new Date().toISOString(),
}) {
  return {
    id,
    role,
    content,
    isStreaming: true,
    isStatusOnly: true,
    status: phase,
    mode,
    chunks: [],
    toolCalls: [],
    artifacts: [],
    createdAt,
  };
}

export function updateStatusMessage(messages, id, patch = {}) {
  return messages.map((message) => {
    if (message.id !== id) return message;

    return {
      ...message,
      ...patch,
      isStatusOnly: patch.isStatusOnly ?? message.isStatusOnly,
      isStreaming: patch.isStreaming ?? message.isStreaming,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function completeStatusMessage(messages, id, finalContent, extra = {}) {
  return messages.map((message) => {
    if (message.id !== id) return message;

    return {
      ...message,
      ...extra,
      content: finalContent,
      isStatusOnly: false,
      isStreaming: false,
      status: "complete",
      updatedAt: new Date().toISOString(),
    };
  });
}

export function failStatusMessage(messages, id, errorText, extra = {}) {
  return messages.map((message) => {
    if (message.id !== id) return message;

    return {
      ...message,
      ...extra,
      content: errorText,
      isStatusOnly: false,
      isStreaming: false,
      status: "error",
      updatedAt: new Date().toISOString(),
    };
  });
}

export function ensureSingleActiveStatus(messages, id, content, options = {}) {
  const exists = messages.some((message) => message.id === id);

  if (exists) {
    return updateStatusMessage(messages, id, {
      content,
      isStatusOnly: true,
      isStreaming: true,
      status: options.phase || "thinking",
      mode: options.mode || "chat",
    });
  }

  return [
    ...messages,
    createStatusMessage({
      id,
      content,
      phase: options.phase || "thinking",
      mode: options.mode || "chat",
    }),
  ];
}
