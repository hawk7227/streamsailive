#!/usr/bin/env node

/**
 * Wires ChatTab directly to StreamsChatSurface v3.
 * Fails loudly if the expected ChatTab file is not present.
 */

import fs from 'node:fs';
import path from 'node:path';

const chatTabPath = path.join(process.cwd(), 'src/components/streams/tabs/ChatTab.tsx');

if (!fs.existsSync(chatTabPath)) {
  console.error('[streams-chat-surface] ChatTab.tsx not found at src/components/streams/tabs/ChatTab.tsx');
  process.exit(1);
}

let source = fs.readFileSync(chatTabPath, 'utf8');

source = source.replace(
  'import { UnifiedChatPanel } from "../UnifiedChatPanel";',
  'import { StreamsChatSurface } from "../StreamsChatSurface";'
);
source = source.replace(
  "import { UnifiedChatPanel } from '../UnifiedChatPanel';",
  "import { StreamsChatSurface } from '../StreamsChatSurface';"
);
source = source.replaceAll('UnifiedChatPanel', 'StreamsChatSurface');
source = source.replace('NEW: ChatTab → StreamsChatSurface (1 efficient layer)', 'NEW: ChatTab → StreamsChatSurface (v3 direct surface)');

if (!source.includes('StreamsChatSurface')) {
  console.error('[streams-chat-surface] Failed to wire StreamsChatSurface into ChatTab.tsx');
  process.exit(1);
}

fs.writeFileSync(chatTabPath, source);
console.log('[streams-chat-surface] ChatTab.tsx now renders StreamsChatSurface');
