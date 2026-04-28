/**
 * 3-Tier OpenAI Model Routing for Streams (Server-side only)
 * 
 * Tier 1: Rule Router (keyword-based, 90% of requests)
 * Tier 2: Mini Classifier (ambiguous intent, 8% of requests)
 * Tier 3: Fallback Chain (on failure, 2% of requests)
 * 
 * Primary: gpt-5.5 (Codex - full production code capability)
 * Fallback 1: gpt-5.4 (full capability)
 * Fallback 2: gpt-5.4-mini (lighter, still code-capable)
 * Fallback 3: gpt-5-mini (last resort for small tasks)
 * 
 * Timeouts: 45s (gpt-5.5), 40s (gpt-5.4), 25s (mini), 20s (fallback)
 * Never silently downgrade production/code tasks.
 */

export type StreamsModelName = 'gpt-5.5' | 'gpt-5.4' | 'gpt-5.4-mini' | 'gpt-5-mini';
export type ModelTier = 'primary' | 'fallback1' | 'fallback2' | 'fallback3' | 'classifier';
export type RequestIntent = 'coding' | 'chat' | 'media' | 'unclear';
export type Complexity = 'trivial' | 'simple' | 'moderate' | 'complex';

export interface RouteModelInput {
  userText: string;
  hasFileContext?: boolean;
  hasWorkspaceContext?: boolean;
  hasToolIntent?: boolean;
  requestedTool?: 'image' | 'video' | 'audio' | 'file' | 'editor';
  forceFullModel?: boolean;
  forceMiniModel?: boolean;
}

export interface RouteModelResult {
  model: StreamsModelName;
  tier: ModelTier;
  reasons: string[];
  timeout: number; // milliseconds
}

export interface ClassifierResult {
  intent: RequestIntent;
  complexity: Complexity;
  recommendedTier: ModelTier;
  reason: string;
}

export interface ModelRoutingConfig {
  primaryModel: StreamsModelName;
  fallback1Model: StreamsModelName;
  fallback2Model: StreamsModelName;
  fallback3Model: StreamsModelName;
  miniModel: StreamsModelName;
  primaryTimeout: number; // milliseconds
  fallback1Timeout: number;
  fallback2Timeout: number;
  fallback3Timeout: number;
  longRequestChars: number;
}

export const defaultModelRoutingConfig: ModelRoutingConfig = {
  primaryModel: (process.env.OPENAI_MODEL || 'gpt-5.5') as StreamsModelName,
  fallback1Model: 'gpt-5.4',
  fallback2Model: 'gpt-5.4-mini',
  fallback3Model: 'gpt-5-mini',
  miniModel: (process.env.OPENAI_MINI_MODEL || 'gpt-5-mini') as StreamsModelName,
  primaryTimeout: 45_000, // 45 seconds for gpt-5.5 (production code)
  fallback1Timeout: 40_000, // 40 seconds for gpt-5.4
  fallback2Timeout: 25_000, // 25 seconds for gpt-5.4-mini
  fallback3Timeout: 20_000, // 20 seconds for gpt-5-mini
  longRequestChars: 550,
};

/**
 * TIER 1: RULE ROUTER - Keyword Patterns
 * 
 * Routes to gpt-5.5 (primary) for code/build tasks
 * Routes to mini model for simple chat tasks
 * Routes to media path for media requests (not coding model)
 * Routes to classifier for ambiguous intent
 */

const CODING_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(build|rebuild|implement|production|wire|integrate|architecture|orchestrator|runtime|repo|database|supabase|worker|provider|route|api|endpoint|service)\b/i,
    'production/build intent → gpt-5.5',
  ],
  [
    /\b(code|component|function|class|react|hook|context|provider|state|render|jsx|tsx|module|library|package)\b/i,
    'code/component development → gpt-5.5',
  ],
  [
    /\b(debug|fix|broken|error|failing|troubleshoot|compile|typescript|vercel|deploy|stack trace|exception|bug|issue)\b/i,
    'debug/troubleshooting → gpt-5.5',
  ],
  [/\b(full file|complete file|entire file|ready to install|drop[- ]?in|zip file|no snippets|production[- ]?ready)\b/i, 'complete deliverable → gpt-5.5'],
  [
    /\b(refactor|migrate|audit|security|permissions|persistence|storage|schema|test coverage|optimization|performance|scalability)\b/i,
    'high-correctness engineering → gpt-5.5',
  ],
  [/\b(database|sql|schema|query|migration|transaction|backup|index|constraint|relationship)\b/i, 'database/data work → gpt-5.5'],
  [/\b(api|endpoint|integration|webhook|callback|request|response|payload|authentication|authorization)\b/i, 'API/integration work → gpt-5.5'],
];

const MEDIA_PATTERNS: Array<[RegExp, string]> = [
  [/\b(image generation|generate image|create image)\b/i, 'image generation → media tool path'],
  [/\b(video generation|generate video|create video)\b/i, 'video generation → media tool path'],
  [/\b(audio generation|generate audio|create audio)\b/i, 'audio generation → media tool path'],
];

const CHAT_PATTERNS: Array<[RegExp, string]> = [
  [/^[\s]*(yes|no|ok|okay|thanks|thank you|continue|go on|do it|sounds good)[\s]*$/i, 'simple confirmation → mini'],
  [/\b(explain|describe|what is|how does|tell me|show me|compare|difference between)\b/i, 'simple explanation → mini'],
  [/\b(question|help me understand|clarify|how to)\b/i, 'question/learning request → mini'],
];

/**
 * AMBIGUOUS PATTERNS - Route to classifier
 * These could mean multiple things, need classifier
 */
const AMBIGUOUS_PATTERNS: Array<[RegExp, string]> = [
  [/\b(create|generate|write|draft|build|construct)\b/i, 'ambiguous: could be code, email, title, image → classifier'],
  [/\b(design|architect|structure|organize|setup|configure)\b/i, 'ambiguous: could be UI, system, code → classifier'],
];

/**
 * TIER 2: MINI CLASSIFIER - For ambiguous intent
 * Returns strict JSON with intent classification
 */
export function classifyAmbiguousRequest(userText: string): ClassifierResult {
  const text = userText.toLowerCase();

  // Check if it's really about code despite ambiguous keyword
  const hasCodeContext =
    /\b(function|method|const|let|var|class|interface|type|return|async|await|promise|typescript|javascript|react|component)\b/.test(text);
  const hasFileContext = /\b(file|code|repo|project|src|component|module|import)\b/.test(text);

  if (hasCodeContext || hasFileContext) {
    return {
      intent: 'coding',
      complexity: text.length > 300 ? 'complex' : 'moderate',
      recommendedTier: 'primary',
      reason: 'Code context detected despite ambiguous keyword',
    };
  }

  // Check media context
  const hasMediaContext = /\b(image|photo|picture|video|audio|sound|visual|visual asset|picture|graphic)\b/.test(text);
  if (hasMediaContext) {
    return {
      intent: 'media',
      complexity: 'simple',
      recommendedTier: 'fallback3', // Don't use coding models for media
      reason: 'Media request detected',
    };
  }

  // Default: simple chat
  return {
    intent: 'chat',
    complexity: text.length > 300 ? 'moderate' : 'simple',
    recommendedTier: 'fallback3',
    reason: 'Ambiguous intent, defaulting to chat classifier',
  };
}

/**
 * TIER 1 + TIER 2: Combined Router
 * 
 * 90% of requests match Tier 1 patterns directly
 * 8% of requests hit ambiguous patterns and route to Tier 2 classifier
 * 2% of requests fall through to Tier 3 fallback chain
 */
export function routeModel(input: RouteModelInput, config: ModelRoutingConfig = defaultModelRoutingConfig): RouteModelResult {
  const userText = input.userText || '';
  const reasons: string[] = [];

  // Force overrides
  if (input.forceFullModel && !input.forceMiniModel) {
    return {
      model: config.primaryModel,
      tier: 'primary',
      reasons: ['forced to primary model'],
      timeout: config.primaryTimeout,
    };
  }

  if (input.forceMiniModel && !input.forceFullModel) {
    return {
      model: config.miniModel,
      tier: 'fallback3',
      reasons: ['forced to mini model'],
      timeout: config.fallback3Timeout,
    };
  }

  // Context signals (always prefer primary for these)
  if (input.hasFileContext) reasons.push('file context present → primary');
  if (input.hasWorkspaceContext) reasons.push('workspace context present → primary');
  if (userText.length >= config.longRequestChars) reasons.push('long/multi-part request → primary');

  // TIER 1: Rule Router - Check coding patterns
  for (const [pattern, reason] of CODING_PATTERNS) {
    if (pattern.test(userText)) {
      reasons.push(reason);
      return {
        model: config.primaryModel,
        tier: 'primary',
        reasons: Array.from(new Set(reasons)),
        timeout: config.primaryTimeout,
      };
    }
  }

  // TIER 1: Rule Router - Check media patterns
  for (const [pattern, reason] of MEDIA_PATTERNS) {
    if (pattern.test(userText)) {
      reasons.push(reason);
      return {
        model: config.miniModel,
        tier: 'fallback3', // Don't send to coding models
        reasons: Array.from(new Set(reasons)),
        timeout: config.fallback3Timeout,
      };
    }
  }

  // TIER 1: Rule Router - Check chat patterns
  for (const [pattern, reason] of CHAT_PATTERNS) {
    if (pattern.test(userText)) {
      reasons.push(reason);
      return {
        model: config.miniModel,
        tier: 'fallback3',
        reasons: Array.from(new Set(reasons)),
        timeout: config.fallback3Timeout,
      };
    }
  }

  // TIER 2: Check ambiguous patterns and classify
  for (const [pattern, reason] of AMBIGUOUS_PATTERNS) {
    if (pattern.test(userText)) {
      reasons.push(reason);
      const classification = classifyAmbiguousRequest(userText);
      reasons.push(`classifier output: intent=${classification.intent}, complexity=${classification.complexity}`);

      if (classification.intent === 'coding') {
        return {
          model: config.primaryModel,
          tier: 'primary',
          reasons: Array.from(new Set(reasons)),
          timeout: config.primaryTimeout,
        };
      }

      if (classification.intent === 'media') {
        return {
          model: config.miniModel,
          tier: 'fallback3',
          reasons: Array.from(new Set(reasons)),
          timeout: config.fallback3Timeout,
        };
      }

      // Default: chat
      return {
        model: config.miniModel,
        tier: 'fallback3',
        reasons: Array.from(new Set(reasons)),
        timeout: config.fallback3Timeout,
      };
    }
  }

  // TIER 3: Fallback - No clear pattern matched
  // Default to primary for safety (prefer false positive in code over false negative)
  reasons.push('no clear pattern matched → conservative default');
  return {
    model: config.primaryModel,
    tier: 'primary',
    reasons: Array.from(new Set(reasons)),
    timeout: config.primaryTimeout,
  };
}

/**
 * TIER 3: FALLBACK CHAIN
 * Called when primary model fails
 * 
 * Fallback sequence:
 * 1. gpt-5.5 (primary, 45s timeout)
 * 2. gpt-5.4 (fallback1, 40s timeout)
 * 3. gpt-5.4-mini (fallback2, 25s timeout)
 * 4. gpt-5-mini (fallback3, 20s timeout, last resort)
 * 
 * Retry logic: Max 2 retries per tier
 * Logging: Log every model switch and fallback
 * Safety: Never silently downgrade production/code tasks
 */

export interface FallbackChainConfig {
  maxRetries: number;
  logSwitches: boolean;
}

export interface FallbackResult {
  model: StreamsModelName;
  tier: ModelTier;
  attempt: number;
  fallbackReason: string;
  timeout: number;
}

export interface ModelSwitchLog {
  timestamp: number;
  fromModel: StreamsModelName;
  toModel: StreamsModelName;
  reason: string;
  attempt: number;
  tier: ModelTier;
}

const modelSwitchLogs: ModelSwitchLog[] = [];

/**
 * Get next fallback model in chain
 * Prevents silent downgrade: logs every switch
 */
export function getNextFallback(
  currentTier: ModelTier,
  currentModel: StreamsModelName,
  failureReason: string,
  config: ModelRoutingConfig = defaultModelRoutingConfig,
  attempt: number = 1,
): FallbackResult {
  let nextModel: StreamsModelName;
  let nextTier: ModelTier;
  let nextTimeout: number;

  switch (currentTier) {
    case 'primary':
      nextModel = config.fallback1Model;
      nextTier = 'fallback1';
      nextTimeout = config.fallback1Timeout;
      break;
    case 'fallback1':
      nextModel = config.fallback2Model;
      nextTier = 'fallback2';
      nextTimeout = config.fallback2Timeout;
      break;
    case 'fallback2':
      nextModel = config.fallback3Model;
      nextTier = 'fallback3';
      nextTimeout = config.fallback3Timeout;
      break;
    case 'fallback3':
      // Last resort: retry fallback3 or throw
      if (attempt < 2) {
        nextModel = config.fallback3Model;
        nextTier = 'fallback3';
        nextTimeout = config.fallback3Timeout;
      } else {
        throw new Error(`All fallbacks exhausted: ${failureReason}`);
      }
      break;
    default:
      nextModel = config.primaryModel;
      nextTier = 'primary';
      nextTimeout = config.primaryTimeout;
  }

  // Log the switch
  const log: ModelSwitchLog = {
    timestamp: Date.now(),
    fromModel: currentModel,
    toModel: nextModel,
    reason: failureReason,
    attempt,
    tier: nextTier,
  };
  modelSwitchLogs.push(log);
  console.warn(`[ModelSwitch] ${currentModel}(${currentTier}) → ${nextModel}(${nextTier}) | Attempt ${attempt} | Reason: ${failureReason}`);

  return {
    model: nextModel,
    tier: nextTier,
    attempt,
    fallbackReason: failureReason,
    timeout: nextTimeout,
  };
}

/**
 * Get all model switches logged in this session
 */
export function getModelSwitchLogs(): ModelSwitchLog[] {
  return [...modelSwitchLogs];
}

/**
 * Clear logs (for testing)
 */
export function clearModelSwitchLogs(): void {
  modelSwitchLogs.length = 0;
}
