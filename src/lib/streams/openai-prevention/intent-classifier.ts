import type { RequestIntent } from '@/lib/streams/ai-prevention/types';
export function classifyIntent(input: string): RequestIntent {
  const t=input.toLowerCase();
  if(/build|implement|wire|complete|fix/.test(t)) return 'build';
  if(/patch/.test(t)) return 'patch'; if(/debug|error|fail/.test(t)) return 'debug';
  if(/image|video|media/.test(t)) return 'media'; if(/editor/.test(t)) return 'editor';
  if(/file|upload/.test(t)) return 'file_analysis'; if(/status|changed files/.test(t)) return 'repo_status';
  if(/proof/.test(t)) return 'proof_status'; if(/open|show|list|download|copy/.test(t)) return 'tool_action';
  return t.trim()? 'normal_chat':'unknown';
}
