"use client";

/**
 * src/components/streams/tabs/ChatTab.tsx
 *
 * Clean Streams chat tab.
 * TEMP TEST MODE:
 * - Uses a deterministic test user id so /streams can open without login during DO frontend testing.
 * - Does not render old sidebar, mode chips, activity cards, avatars, or bubble/card UI.
 * - Re-enable authenticated user wiring before production lock-down.
  *
 * Rule 3.1 visualViewport listener: see UnifiedChatPanel.tsx
 * Rule R.11/1.5 safe-area-inset-bottom: see UnifiedChatPanel.tsx
 * Rule ACC.4 aria-live region: see UnifiedChatPanel.tsx
 */

import { UnifiedChatPanel } from "../UnifiedChatPanel";

const TEST_PROJECT_ID = "streams-test-project";
const TEST_USER_ID = "streams-test-user";

export default function ChatTab() {
  return (
    <div style={{ width: "100%", minWidth: 0, maxWidth: "100vw", overflowX: "hidden" }}>
      <UnifiedChatPanel
        projectId={TEST_PROJECT_ID}
        userId={TEST_USER_ID}
      />
    </div>
  );
}
