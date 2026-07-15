export const STREAMS_VISIONS_EXPERIENCE_CONTRACT = Object.freeze({
  route: "/streams-ai/Visions",
  messagesApi: "/api/streams-ai/Visions/messages",
  conversationsApi: "/api/streams-ai/Visions/conversations",
  storage: Object.freeze({
    conversation: "streams-visions.conversation.v1",
    mode: "streams-visions.mode.v1",
  }),
  events: Object.freeze({
    messageStarted: "visions:message-started",
    messageComplete: "visions:message-complete",
    previewRevealing: "visions:preview-revealing",
    previewReady: "visions:preview-ready",
    previewFailed: "visions:preview-failed",
    previewCancelled: "visions:preview-cancelled",
  }),
  persistence: Object.freeze({
    conversationsTable: "streams_visions_conversations",
    messagesTable: "streams_visions_messages",
    activePreviewField: "active_preview",
  }),
  reveal: Object.freeze({
    minimumMs: 4200,
    maximumMs: 8000,
    defaultMs: 5200,
    ambientClass: "ambientDream",
    futureSelfClass: "futureSelf",
    reducedMotionSupported: true,
    visibleGeneratorIndicators: false,
  }),
  isolation: Object.freeze({
    importsCurrentChatRuntime: false,
    usesMainStreamsMessagesApi: false,
    usesMainStreamsAssetCache: false,
  }),
  publicErrors: Object.freeze({
    providerFailure: "Visions could not shape that scene",
    exposesProviderDetails: false,
  }),
});
