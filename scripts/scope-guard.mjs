#!/usr/bin/env node
import { execSync } from 'node:child_process';

const allowed = new Set([
  'src/components/streams/StreamsPanel.tsx',
  'src/components/streams/tabs/ChatTab.tsx',
  'src/components/streams/UnifiedChatPanel.tsx',
  'docs/streams-current-status.md',
  'docs/merge-policies/chat-ui-slice.md',
  '.github/workflows/ci.yml',
  '.github/workflows/test-and-report.yml',
  'scripts/scope-guard.mjs',
  'scripts/generated-file-guard.mjs',
  'scripts/check-pr-ready.mjs',
  'package.json',
]);

const changed = execSync('git status --short', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((line) => line.slice(3).trim());

const forbidden = changed.filter((f) => !allowed.has(f));
if (forbidden.length) {
  console.error('scope-guard: forbidden files changed:');
  forbidden.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log('scope-guard: pass');
