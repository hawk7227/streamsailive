/**
 * OpenAI Model Router with Intelligent Intent Classification
 * 
 * 3-Tier System:
 * 1. Rule-based routing (instant, no latency)
 * 2. LLM classifier (for ambiguous cases)
 * 3. Fallback & resilience (OpenAI only)
 */

export interface RoutingDecision {
  primaryModel: string;
  fallbacks: string[];
  timeout: number;
  intent: 'build' | 'question' | 'debug' | 'analyze' | 'media';
  confidence: number;
  reason: string;
}

export interface ClassifierOutput {
  intent: 'build' | 'question' | 'debug' | 'analyze' | 'media';
  complexity: 'simple' | 'medium' | 'complex';
  recommendedTier: 'gpt-5.5' | 'gpt-4o-mini';
  reason: string;
}

// OpenAI model identifiers
const MODELS = {
  BUILDING: 'gpt-5.5',
  BUILDING_FALLBACK_1: 'gpt-5.4',
  BUILDING_FALLBACK_2: 'gpt-5.4-mini',
  BUILDING_FALLBACK_3: 'gpt-5-mini',
  DISCUSSION: 'gpt-4o-mini',
  DISCUSSION_FALLBACK_1: 'gpt-4o',
  DISCUSSION_FALLBACK_2: 'gpt-5-mini',
};

// Rule-based keywords for intent detection
const INTENT_PATTERNS = {
  build: /build|code|create\s+(?:a\s+)?(?:button|component|feature|function|page|view|screen|endpoint|api|endpoint|form|ui|interface)|implement|write\s+(?:a\s+)?(?:code|function|script)|full\s+file|repo|system|integration|implement|scaffold/gi,
  debug: /error|bug|broken|not\s+working|fix|debug|test|verify|failing|crash|exception|stack\s+trace|issue|problem\s+with/gi,
  general_knowledge: /what\s+is|how\s+does|explain|describe|tell\s+me\s+about|define|meaning\s+of/gi,
  content_writing: /write\s+(?:an?|me)\s+(?:article|email|story|essay|post|letter|blog|content)|draft\s+(?:an?|me)|compose|create\s+(?:an?\s+)?(?:article|post|content)/gi,
  document_analysis: /analyze|summarize|review|examine|extract|read\s+(?:this|the)|what\s+(?:does|is)\s+(?:in|on|this)/gi,
  brainstorm: /brainstorm|ideas|suggestions|options|alternatives|think\s+of|come\s+up\s+with/gi,
  research: /research|find\s+information|search|lookup|recent\s+developments|what\s+are\s+(?:the\s+)?(?:latest|new)/gi,
  question: /compare|difference|why|help\s+me\s+understand|when\s+should|best\s+practice|how\s+to/gi,
  media: /image|video|photo|picture|visual|screenshot|diagram|chart|graph|generate\s+(?:an?\s+)?(?:image|photo)|draw|create\s+(?:an?\s+)?(?:image|visual)/gi,
};

/**
 * Tier 1: Rule-based routing
 * Instant classification without API calls
 */
export function ruleBasedRouter(userInput: string): RoutingDecision | null {
  // Check for media requests first
  if (INTENT_PATTERNS.media.test(userInput)) {
    return {
      primaryModel: 'media-tool',
      fallbacks: [],
      timeout: 10000,
      intent: 'media',
      confidence: 0.9,
      reason: 'Media request detected - route to media tool',
    };
  }

  // Check for build/code intent
  if (INTENT_PATTERNS.build.test(userInput)) {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: 30000,
      intent: 'build',
      confidence: 0.95,
      reason: 'Build/code request detected from keywords',
    };
  }

  // Check for debug intent
  if (INTENT_PATTERNS.debug.test(userInput)) {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: 25000,
      intent: 'debug',
      confidence: 0.92,
      reason: 'Debug/error request detected from keywords',
    };
  }

  // Check for general knowledge intent (new)
  if (INTENT_PATTERNS.general_knowledge.test(userInput)) {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: 15000,
      intent: 'question',
      confidence: 0.90,
      reason: 'General knowledge request detected',
    };
  }

  // Check for content writing intent (new)
  if (INTENT_PATTERNS.content_writing.test(userInput)) {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: 20000,
      intent: 'analyze',
      confidence: 0.93,
      reason: 'Content writing request detected',
    };
  }

  // Check for document analysis intent (new)
  if (INTENT_PATTERNS.document_analysis.test(userInput)) {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: 20000,
      intent: 'analyze',
      confidence: 0.88,
      reason: 'Document analysis request detected',
    };
  }

  // Check for brainstorm intent (new)
  if (INTENT_PATTERNS.brainstorm.test(userInput)) {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: 18000,
      intent: 'analyze',
      confidence: 0.85,
      reason: 'Brainstorming request detected',
    };
  }

  // Check for research intent (new)
  if (INTENT_PATTERNS.research.test(userInput)) {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: 20000,
      intent: 'analyze',
      confidence: 0.87,
      reason: 'Research request detected - web search available',
    };
  }

  // Check for question/discussion intent
  if (INTENT_PATTERNS.question.test(userInput)) {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: 12000,
      intent: 'question',
      confidence: 0.88,
      reason: 'Question/discussion request detected',
    };
  }

  // No strong pattern matched - return null to trigger classifier
  return null;
}

/**
 * Tier 2: LLM Classifier
 * For ambiguous cases when rule-based routing confidence < 75%
 * Uses fast gpt-4o-mini for classification only
 */
export async function classifyWithLLM(userInput: string): Promise<ClassifierOutput> {
  const systemPrompt = `You are a request classifier for a code generation system. Classify the user's request strictly as JSON with no additional text.

Return ONLY valid JSON in this format:
{
  "intent": "build" | "question" | "debug" | "analyze" | "media",
  "complexity": "simple" | "medium" | "complex",
  "recommendedTier": "gpt-5.5" | "gpt-4o-mini",
  "reason": "brief explanation"
}

Categories:
- build: Creating new code, features, components, pages, systems
- question: Explaining concepts, comparisons, general knowledge
- debug: Fixing errors, testing, troubleshooting
- analyze: Data analysis, research, planning (not building)
- media: Image/video requests (not code)

Tiers:
- gpt-5.5: For build, debug, complex tasks
- gpt-4o-mini: For questions, simple tasks`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userInput,
          },
        ],
        temperature: 0,
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Classifier API error:', data);
      throw new Error(`OpenAI API error: ${data.error?.message}`);
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in classifier response');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in classifier response');
    }

    const classified = JSON.parse(jsonMatch[0]) as ClassifierOutput;
    return classified;
  } catch (error) {
    console.error('Classifier error:', error);
    // Fallback to question tier if classifier fails
    return {
      intent: 'question',
      complexity: 'medium',
      recommendedTier: 'gpt-4o-mini',
      reason: 'Classifier failed, defaulting to discussion',
    };
  }
}

/**
 * Main router function
 * Combines rule-based + LLM classification with fallback strategy
 */
export async function routeRequest(userInput: string): Promise<RoutingDecision> {
  // Step 1: Try rule-based routing
  const ruleDecision = ruleBasedRouter(userInput);
  
  if (ruleDecision && ruleDecision.confidence >= 0.75) {
    return ruleDecision;
  }

  // Step 2: Use LLM classifier for ambiguous cases
  const classified = await classifyWithLLM(userInput);

  // Convert classifier output to routing decision
  if (classified.recommendedTier === 'gpt-5.5') {
    return {
      primaryModel: MODELS.BUILDING,
      fallbacks: [MODELS.BUILDING_FALLBACK_1, MODELS.BUILDING_FALLBACK_2, MODELS.BUILDING_FALLBACK_3],
      timeout: classified.complexity === 'complex' ? 45000 : 30000,
      intent: classified.intent as 'build' | 'question' | 'debug' | 'analyze' | 'media',
      confidence: 0.8,
      reason: `Classifier: ${classified.reason}`,
    };
  } else {
    return {
      primaryModel: MODELS.DISCUSSION,
      fallbacks: [MODELS.DISCUSSION_FALLBACK_1, MODELS.DISCUSSION_FALLBACK_2],
      timeout: 10000,
      intent: classified.intent as 'build' | 'question' | 'debug' | 'analyze' | 'media',
      confidence: 0.8,
      reason: `Classifier: ${classified.reason}`,
    };
  }
}

/**
 * Execute request with fallback strategy
 * Retries up to 2 times if primary model fails
 */
export async function executeWithFallback(
  userInput: string,
  executeWithModel: (model: string) => Promise<any>,
  onModelSwitch?: (oldModel: string, newModel: string, reason: string) => void
): Promise<{ result: any; model: string; attempt: number; fallbackUsed: boolean }> {
  const routing = await routeRequest(userInput);
  const models = [routing.primaryModel, ...routing.fallbacks];
  
  let lastError: Error | null = null;
  let attempt = 0;
  let fallbackUsed = false;

  for (const model of models) {
    attempt++;
    
    try {
      // Set timeout for this model
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} timeout after ${routing.timeout}ms`)), routing.timeout)
      );

      const result = await Promise.race([executeWithModel(model), timeoutPromise]);

      return {
        result,
        model,
        attempt,
        fallbackUsed: attempt > 1,
      };
    } catch (error) {
      lastError = error as Error;
      
      // Log and notify fallback
      if (attempt < models.length) {
        const nextModel = models[attempt]; // Next model (already incremented attempt)
        console.warn(`Model ${model} failed (attempt ${attempt}): ${lastError.message}. Falling back to ${nextModel}.`);
        onModelSwitch?.(model, nextModel, lastError.message);
        fallbackUsed = true;
      }
    }
  }

  // All models exhausted
  throw new Error(
    `All models exhausted after ${attempt} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Logging helper for model routing decisions
 */
export interface RoutingLog {
  timestamp: string;
  userInput: string;
  routing: RoutingDecision;
  executedModel: string;
  attempt: number;
  fallbackUsed: boolean;
  latency: number;
  costEstimate: number;
  success: boolean;
}

export function logRoutingDecision(log: RoutingLog): void {
  console.log(
    JSON.stringify({
      event: 'model_routing',
      timestamp: log.timestamp,
      intent: log.routing.intent,
      complexity: log.routing.intent,
      primaryModel: log.routing.primaryModel,
      executedModel: log.executedModel,
      attempt: log.attempt,
      fallbackUsed: log.fallbackUsed,
      latency: log.latency,
      costEstimate: log.costEstimate,
      success: log.success,
    })
  );
}
