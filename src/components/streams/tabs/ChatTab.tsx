"use client";

/**
 * src/components/streams/tabs/ChatTab.tsx
 *
 * Clean Streams chat tab.
 * TEMP TEST MODE:
 * - Uses a deterministic test user id so /streams can open without login during DO frontend testing.
 * - Does not render old sidebar, mode chips, activity cards, avatars, or bubble/card UI.
 * - Re-enable authenticated user wiring before production lock-down.
 */

import { UnifiedChatPanel } from "../UnifiedChatPanel";

const TEST_PROJECT_ID = "streams-test-project";
const TEST_USER_ID = "streams-test-user";

export default function ChatTab() {
  return (
    <UnifiedChatPanel
      projectId={TEST_PROJECT_ID}
      userId={TEST_USER_ID}
    />
  );
}
