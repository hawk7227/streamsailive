"use client";

// Confidence-audit branch: composer positioning is now owned by normal ChatPanel
// layout and composer CSS. This bridge intentionally does not mutate layout,
// poll the DOM, or force inline styles.
export default function StreamsAIEmptyComposerPositionBridge() {
  return null;
}
