import { getSiteConfig } from '@/lib/config';

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Full pipeline context injected on every call
export interface PipelineContext {
  type: string;
  prompt: string;
  settings: Record<string, string>;
  // Pipeline-specific
  nicheId?: string;
  pipelineType?: string;
  rulesetVersion?: string;
  brandTone?: string;
  approvedFacts?: string[];
  bannedPhrases?: string[];
  selectedConceptId?: string;
  currentStepId?: string;
  stepStates?: Record<string, string>;
  intakeAnalysis?: string;
  strategyOutput?: string;
  copyOutput?: string;
  validatorStatus?: string;
  imageUrl?: string;
  videoUrl?: string;
  sessionId?: string;
}

export interface AssistantAction {
  type: ActionType;
  payload: Record<string, unknown>;
}

export interface AssistantResponse {
  message: string;
  actions: AssistantAction[];
  // Legacy compat
  reply: string;
  action?: AssistantAction;
}

type ActionType =
  | "update_prompt"
  | "update_settings"
  | "update_strategy_prompt"
  | "update_copy_prompt"
  | "update_validator_prompt"
  | "update_image_prompt"
  | "update_i2v_prompt"
  | "update_qa_instruction"
  | "generate_image"
  | "generate_video"
  | "generate_i2v"
  | "run_step"
  | "run_pipeline"
  | "select_concept"
  | "approve_output"
  | "open_step_config"
  | "set_niche";

const PROVIDER_KNOWLEDGE = `
KLING T2V: ≤50 words. Subject+Action+Environment+Camera+Mood. Include negative prompt.
KLING I2V: ≤40 words. Motion ONLY — never re-describe the image.
RUNWAY T2V: ≤1000 chars. No separate negative prompts.
TELEHEALTH MOTION BANNED: fast zoom, whip pan, face distortion, lip sync, mouth animation.
TELEHEALTH MOTION ALLOWED: slow push-in, gentle pan, soft parallax, natural blink.
`.trim();

const buildSystemPrompt = (context: PipelineContext): string => {
  const config = getSiteConfig();
  const settingsInfo = Object.entries(context.settings)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const ctx = context as unknown as Record<string, unknown>;
  const conceptErrors = ctx.conceptErrors as Record<string, string | null> | undefined;
  const conceptStatuses = ctx.conceptStatuses as Record<string, string> | undefined;
  const hasFailedConcepts = ctx.hasFailedConcepts as boolean | undefined;
  const imageProvider = ctx.imageProvider as string | undefined;

  const errorSummary = conceptErrors
    ? Object.entries(conceptErrors)
        .filter(([, e]) => e)
        .map(([id, e]) => `${id}: ${e}`)
        .join("; ")
    : "";

  const pipelineInfo = [
    context.nicheId ? `Active niche: ${context.nicheId}` : "",
    context.currentStepId ? `Current step: ${context.currentStepId}` : "",
    context.selectedConceptId ? `Selected concept: ${context.selectedConceptId}` : "",
    context.stepStates ? `Step states: ${JSON.stringify(context.stepStates)}` : "",
    conceptStatuses ? `Concept statuses: ${JSON.stringify(conceptStatuses)}` : "",
    hasFailedConcepts ? `⚠️ FAILED CONCEPTS DETECTED` : "",
    errorSummary ? `Errors: ${errorSummary}` : "",
    imageProvider ? `Image provider: ${imageProvider}` : "",
    context.intakeAnalysis ? `Intake analysis: ${context.intakeAnalysis}` : "",
    context.imageUrl ? `Image available: ${context.imageUrl}` : "",
    context.videoUrl ? `Video available: ${context.videoUrl}` : "",
  ].filter(Boolean).join("\n");

  return `You are STREAMS — an expert AI pipeline director for telehealth content production.

You help users build compliant, premium telehealth ad campaigns through a 7-step pipeline.

CRITICAL: When you see failed concepts or errors in the pipeline state, your FIRST response must:
1. State clearly what failed and exactly why
2. Give the specific fix in plain language
3. Tell the user exactly what to do next

Common errors and their fixes:
- "Unauthorized" from OpenAI → API key is wrong, expired, or the model requested is not available on this account. Fix: check DigitalOcean env vars, ensure OPENAI_API_KEY is valid.
- "gpt-image-1" model error → This model requires special org access. The pipeline has been reverted to dall-e-3 which works.
- "Generation failed" → Check the Logs tab for the specific OpenAI error message.
- Images look too polished/AI → The realism sanitizer is active. Try regenerating — dall-e-3 varies between runs.

Never say "Done." when there are errors. Always diagnose.

PIPELINE STEPS (in order):
1. creativeStrategy — brand and audience strategy
2. copyGeneration — 3 compliant copy variants
3. validator — regulatory compliance check
4. imageryGeneration — Kling image generation
5. imageToVideoStep — Kling image-to-video
6. assetLibrary — organise all outputs
7. qualityAssurance — final compliance QA

PROVIDER KNOWLEDGE:
${PROVIDER_KNOWLEDGE}

CURRENT PIPELINE STATE:
${pipelineInfo || "No pipeline context loaded"}

CURRENT SETTINGS: ${settingsInfo || "none"}
CURRENT PROMPT: ${context.prompt || "none"}

AVAILABLE ACTIONS — you MUST emit these when the user's intent matches:

ALWAYS emit generate_image when user says: "generate image", "make image", "create image", "test image", "generate a test image", "run image", "generate for concept", or any variation. Use selectedConceptId if no specific concept mentioned.
ALWAYS emit run_pipeline when user says: "run pipeline", "run all", "start pipeline", "generate everything".
ALWAYS emit generate_video when user says: "generate video", "make video", "create video".

Full action list:
- generate_image — { conceptId?: string } — TRIGGER ON ANY IMAGE GENERATION REQUEST
- generate_video — { conceptId?: string } — trigger video generation
- generate_i2v — { prompt, imageUrl, conceptId? } — image-to-video
- run_pipeline — {} — run full pipeline for all concepts
- run_step — { stepId } — run a specific step
- update_image_prompt — { value: string } — update image prompt
- update_strategy_prompt / update_copy_prompt / update_validator_prompt / update_i2v_prompt / update_qa_instruction — { value: string }
- select_concept — { conceptId } — select active concept
- approve_output — { type, url } — approve output for workspace
- open_step_config — { stepId } — open step config panel
- set_niche — { nicheId } — change active niche
- update_prompt — { new_prompt: string } — update current prompt

RULE: When in doubt between responding with text only vs. emitting an action — EMIT THE ACTION.

GOVERNANCE RULES IN EFFECT:
- NO diagnostic claims, NO guaranteed outcomes, NO prescription certainty
- Use only approved facts
- All copy must pass validator before imagery runs
- Motion: no face distortion, no lip sync, no fast zoom

RESPONSE FORMAT — always return valid JSON:
{
  "message": "Your conversational response to the user",
  "actions": [
    { "type": "action_type", "payload": { ... } }
  ]
}

If no action is needed, return empty actions array. Be concise and directive.`;
};

export async function createAssistantChatResponse(
  messages: ChatMessage[],
  context: PipelineContext
): Promise<AssistantResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const systemMessage: ChatMessage = {
    role: "system",
    content: buildSystemPrompt(context),
  };

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [systemMessage, ...messages],
      temperature: 0.4,
      max_tokens: 800,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errorBody?.error?.message ?? "OpenAI request failed");
  }

  const payload = await response.json() as { choices: { message: { content: string } }[] };
  const raw = payload.choices?.[0]?.message?.content ?? "";

  let parsed: { message?: string; actions?: AssistantAction[] };
  try {
    parsed = JSON.parse(raw) as { message?: string; actions?: AssistantAction[] };
  } catch {
    // Fallback: treat raw as plain message with no actions
    parsed = { message: raw, actions: [] };
  }

  const message = parsed.message ?? "";
  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  const firstAction = actions[0];

  return {
    message,
    actions,
    // Legacy compat for any existing callers expecting {reply, action}
    reply: message,
    action: firstAction,
  };
}
