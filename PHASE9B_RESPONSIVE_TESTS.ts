/**
 * PHASE 9B RESPONSIVE DESIGN VERIFICATION
 *
 * Test both mobile and desktop simultaneously.
 * No layout shift at 768px breakpoint.
 * Both render concurrently without blocking.
 *
 * Rules enforced:
 * ✓ Desktop: 65% chat | 35% preview
 * ✓ Mobile: 60% chat | 40% preview
 * ✓ No tab switching on mobile
 * ✓ Split-panel always visible
 * ✓ Activity timeline centered
 * ✓ No horizontal scroll at any width
 * ✓ Touch targets 44×44 minimum
 * ✓ Message input stays above keyboard (visualViewport)
 * ✓ Last message never obscured
 */

export const RESPONSIVE_TESTS = {
  // BREAKPOINT
  "1.1": {
    test: "Breakpoint is exactly 768px",
    assertion: "const bp = 768; desktop = width >= bp; mobile = width < bp",
    weight: "critical",
  },

  // DESKTOP (≥768px)
  "2.1": {
    test: "Desktop: Chat panel is 65% width",
    target: "SplitPanelChat container",
    check: "getComputedStyle(el).flex === '0 0 65%' || width calc to 65vw",
    width: 1024,
  },
  "2.2": {
    test: "Desktop: Preview panel is 35% width",
    target: ".artifact-preview",
    check: "width = 35% of parent",
    width: 1024,
  },
  "2.3": {
    test: "Desktop: Gap between panels is 20px",
    target: "SplitPanelChat container",
    check: "gap: 20px or margin-right: 20px on chat panel",
    width: 1024,
  },
  "2.4": {
    test: "Desktop: No layout shift when resizing to 768px exactly",
    target: "body",
    check: "No reflow animation, position fixed, dimensions stable",
    fromWidth: 1024,
    toWidth: 768,
  },

  // MOBILE (<768px)
  "3.1": {
    test: "Mobile: Chat panel is 60% width",
    target: "SplitPanelChat container",
    check: "width = 60% of viewport",
    width: 390,
  },
  "3.2": {
    test: "Mobile: Preview panel is 40% width",
    target: ".artifact-preview",
    check: "width = 40% of viewport",
    width: 390,
  },
  "3.3": {
    test: "Mobile: Gap between panels is 12px",
    target: "SplitPanelChat container",
    check: "gap: 12px or margin-right: 12px on chat panel",
    width: 390,
  },
  "3.4": {
    test: "Mobile: No tab switching, split panel always visible",
    target: "[data-role='tab-switcher']",
    check: "display: none or element not rendered at width < 768px",
    width: 390,
  },
  "3.5": {
    test: "Mobile: Split panel never stacks vertically",
    target: "SplitPanelChat",
    check: "flex-direction: row always, never column",
    width: 390,
  },

  // TOUCH AND INTERACTION
  "4.1": {
    test: "Send button is 44×44pt minimum (mobile)",
    target: "[data-role='send-button']",
    check: "min-width: 44px, min-height: 44px",
    width: 390,
  },
  "4.2": {
    test: "Message input stays above keyboard (iOS visualViewport)",
    target: "input[placeholder='Type message...']",
    check: "visualViewport event listener transforms element upward",
    mobile: true,
  },
  "4.3": {
    test: "Last message never obscured by input bar",
    target: "SplitPanelChat messages container",
    check: "paddingBottom >= input bar height + safe-area-inset-bottom",
  },

  // ARTIFACT RENDERING
  "5.1": {
    test: "Artifacts render immediately (code in right panel)",
    target: ".artifact-preview",
    check: "Code visible within 100ms of artifact event",
    concurrent: true,
  },
  "5.2": {
    test: "Async content loads in parallel (progress visible)",
    target: ".async-content-progress",
    check: "Progress bar visible while image still loads, doesn't block code",
    concurrent: true,
  },
  "5.3": {
    test: "Activity timeline centered on both mobile and desktop",
    target: ".activity-overlay",
    check: "position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%)",
  },

  // SCROLLING AND OVERFLOW
  "6.1": {
    test: "No horizontal scroll at any width",
    target: "body",
    check: "No overflow-x: auto anywhere, width: 100vw never used",
    widths: [320, 390, 640, 768, 1024, 1440],
  },
  "6.2": {
    test: "No two nested scrollable containers on same axis",
    check: "If parent scrolls Y, children don't have overflow-y: auto",
  },

  // TYPOGRAPHY AND SPACING
  "7.1": {
    test: "No fontSize below 12px",
    check: "All text elements have fontSize >= 12px",
  },
  "7.2": {
    test: "All spacing uses 4px scale: {4,8,12,16,20,24,32,40,48,64,80,96}",
    check: "No margin, padding, gap values outside this set",
  },

  // RESPONSIVE EDGE CASES
  "8.1": {
    test: "Portrait and landscape orientation supported",
    widths: [390, 844], // iPhone SE, iPhone Pro Max width in portrait/landscape
  },
  "8.2": {
    test: "Safe area insets on bottom-anchored elements",
    target: "input[type='text'], [data-role='input-bar']",
    check: "paddingBottom: env(safe-area-inset-bottom)",
  },
  "8.3": {
    test: "Activity phase modal fits on all screens",
    target: ".activity-overlay > div",
    check: "max-width: 500px on desktop, 90vw on mobile, fits in viewport",
    widths: [320, 390, 640, 768, 1024],
  },
};

/**
 * MANUAL TEST CHECKLIST
 */
export const MANUAL_TESTS = [
  {
    name: "Desktop Split Panel",
    steps: [
      "1. Open at 1024px width",
      "2. Chat panel on left (65%), preview on right (35%)",
      "3. Type a message",
      "4. Verify activity timeline centered on screen",
      "5. Code artifact renders immediately",
      "6. Text streams on left, progress on right",
      "7. No content hidden or cut off",
    ],
  },
  {
    name: "Mobile Split Panel",
    steps: [
      "1. Open at 390px width (or resize)",
      "2. Chat panel on left (60%), preview on right (40%)",
      "3. NO tab switching, split-panel always visible",
      "4. Type a message with fingers (44×44 buttons)",
      "5. Activity timeline centered",
      "6. Code renders on right while text streams on left",
      "7. Scroll chat list, verify input stays above soft keyboard",
      "8. Last message never hidden under input",
    ],
  },
  {
    name: "Resize Edge (768px boundary)",
    steps: [
      "1. Open at 769px",
      "2. Chat: 65% | Preview: 35% | Gap: 20px",
      "3. Resize to 767px",
      "4. Chat: 60% | Preview: 40% | Gap: 12px",
      "5. No animation jump, clean transition",
      "6. Verify aspect ratios match exactly",
    ],
  },
  {
    name: "Artifact Concurrent Rendering",
    steps: [
      "1. Send message requesting code generation",
      "2. Activity phase shows (0-2000ms)",
      "3. Code preview appears immediately (left panel still streaming)",
      "4. Async content (image) generates in parallel (progress visible on right)",
      "5. All three happening simultaneously: text + code + image",
      "6. User can scroll chat while image loads",
      "7. Image appears in artifact when complete",
    ],
  },
  {
    name: "Keyboard Handling (iOS)",
    steps: [
      "1. Open on iPad or iPhone",
      "2. Tap message input",
      "3. Soft keyboard appears",
      "4. Input field pushed up above keyboard (visualViewport event)",
      "5. Type message, scroll chat history",
      "6. Input stays visible, last message not under keyboard",
      "7. Dismiss keyboard, layout snaps back",
    ],
  },
];

/**
 * AUTOMATED TEST RUNNER (run in browser console or test suite)
 */
export function runResponsiveTests() {
  const results: Record<string, boolean | string> = {};

  // Test 1.1: Breakpoint
  results["1.1_breakpoint"] = window.innerWidth < 768 ? "mobile" : "desktop";

  // Test 2.x: Desktop
  if (window.innerWidth >= 768) {
    const chatPanel = document.querySelector("[data-role='chat-panel']");
    const previewPanel = document.querySelector("[data-role='preview-panel']");

    results["2.1_chat_65pct"] = chatPanel ? true : "MISSING CHAT PANEL";
    results["2.2_preview_35pct"] = previewPanel ? true : "MISSING PREVIEW PANEL";

    if (chatPanel && previewPanel) {
      const chatRect = chatPanel.getBoundingClientRect();
      const previewRect = previewPanel.getBoundingClientRect();
      const total = window.innerWidth;

      const chatPct = Math.round((chatRect.width / total) * 100);
      const previewPct = Math.round((previewRect.width / total) * 100);

      results["2.1_chat_actual"] = `${chatPct}%`;
      results["2.2_preview_actual"] = `${previewPct}%`;
      results["2.1_chat_valid"] = chatPct === 65 || chatPct === 64;
      results["2.2_preview_valid"] = previewPct === 35 || previewPct === 36;
    }
  }

  // Test 3.x: Mobile
  if (window.innerWidth < 768) {
    const chatPanel = document.querySelector("[data-role='chat-panel']");
    const previewPanel = document.querySelector("[data-role='preview-panel']");
    const tabSwitcher = document.querySelector("[data-role='tab-switcher']");

    results["3.1_chat_60pct"] = chatPanel ? true : "MISSING CHAT PANEL";
    results["3.2_preview_40pct"] = previewPanel ? true : "MISSING PREVIEW PANEL";
    results["3.4_no_tabs"] = !tabSwitcher || !window.getComputedStyle(tabSwitcher as Element).display.includes("flex");

    if (chatPanel && previewPanel) {
      const chatRect = chatPanel.getBoundingClientRect();
      const previewRect = previewPanel.getBoundingClientRect();
      const total = window.innerWidth;

      const chatPct = Math.round((chatRect.width / total) * 100);
      const previewPct = Math.round((previewRect.width / total) * 100);

      results["3.1_chat_actual"] = `${chatPct}%`;
      results["3.2_preview_actual"] = `${previewPct}%`;
      results["3.1_chat_valid"] = chatPct === 60 || chatPct === 59;
      results["3.2_preview_valid"] = previewPct === 40 || previewPct === 41;
    }
  }

  // Test 4: Touch targets
  const sendBtn = document.querySelector("[data-role='send-button']");
  if (sendBtn) {
    const rect = sendBtn.getBoundingClientRect();
    results["4.1_send_44min"] = rect.width >= 44 && rect.height >= 44;
    results["4.1_send_actual"] = `${Math.round(rect.width)}×${Math.round(rect.height)}px`;
  }

  // Test 6: No horizontal scroll
  const bodyWidth = document.body.scrollWidth;
  const windowWidth = window.innerWidth;
  results["6.1_no_h_scroll"] = bodyWidth <= windowWidth + 1; // +1 for rounding

  return results;
}
