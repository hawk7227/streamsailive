export type StreamsRouteTier = 'mini' | 'primary';

export interface StreamsModelRouteInput {
  userText: string;
  hasFileContext?: boolean;
}

export interface StreamsModelRoute {
  model: string;
  tier: StreamsRouteTier;
  reasons: string[];
}

const BUILD_RE = /\b(build|code|component|tsx|jsx|react|api|route|debug|fix|implement|compile|repo|file|function|typescript|javascript|css|html|database|supabase|worker|deploy)\b/i;
const MEDIA_RE = /\b(image|photo|picture|video|audio|voice|music|generation|generate|edit|render)\b/i;
const COMPLEX_RE = /\b(analyze|architecture|orchestrator|streaming|pipeline|integration|production|refactor|audit|end[- ]to[- ]end)\b/i;

export function routeModel(input: StreamsModelRouteInput): StreamsModelRoute {
  const text = input.userText || '';
  const reasons: string[] = [];

  if (input.hasFileContext) reasons.push('file_context');
  if (BUILD_RE.test(text)) reasons.push('build_or_code_intent');
  if (MEDIA_RE.test(text)) reasons.push('media_or_generation_intent');
  if (COMPLEX_RE.test(text)) reasons.push('complex_reasoning_intent');

  const usePrimary = reasons.length > 0;

  return {
    tier: usePrimary ? 'primary' : 'mini',
    model: usePrimary
      ? process.env.OPENAI_MODEL || 'gpt-4.1'
      : process.env.OPENAI_MINI_MODEL || 'gpt-4o-mini',
    reasons: reasons.length ? reasons : ['simple_conversation'],
  };
}
