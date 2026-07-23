export const CHAT_MARKDOWN_SEMANTIC_COLORS = Object.freeze({
  responseText: "#dbe7f7",
  headingText: "#67e8f9",
  strongText: "#f0abfc",
  emphasisText: "#c4b5fd",
  markerText: "#a78bfa",
  linkText: "#7dd3fc",
  quoteText: "#c7d2fe",
  codeLabel: "#fbbf24",
  tableHeading: "#93c5fd",
});

export const CHAT_MARKDOWN_STYLE_VARS = Object.freeze({
  "--chat-response-text": CHAT_MARKDOWN_SEMANTIC_COLORS.responseText,
  "--chat-heading-text": CHAT_MARKDOWN_SEMANTIC_COLORS.headingText,
  "--chat-strong-text": CHAT_MARKDOWN_SEMANTIC_COLORS.strongText,
  "--chat-emphasis-text": CHAT_MARKDOWN_SEMANTIC_COLORS.emphasisText,
  "--chat-marker-text": CHAT_MARKDOWN_SEMANTIC_COLORS.markerText,
  "--chat-link-text": CHAT_MARKDOWN_SEMANTIC_COLORS.linkText,
  "--chat-quote-text": CHAT_MARKDOWN_SEMANTIC_COLORS.quoteText,
  "--chat-code-label": CHAT_MARKDOWN_SEMANTIC_COLORS.codeLabel,
  "--chat-table-heading": CHAT_MARKDOWN_SEMANTIC_COLORS.tableHeading,
});
