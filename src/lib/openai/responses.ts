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

  const pipelineInfo = [
    context.nicheId ? `Active niche: ${context.nicheId}` : "",
    context.pipelineType ? `Pipeline type: ${context.pipelineType}` : "",
    context.rulesetVersion ? `Ruleset: ${context.rulesetVersion}` : "",
    context.brandTone ? `Brand tone: ${context.brandTone}` : "",
    context.approvedFacts?.length ? `Approved facts: ${context.approvedFacts.join("; ")}` : "",
    context.bannedPhrases?.length ? `Banned phrases: ${context.bannedPhrases.slice(0, 8).join(", ")}` : "",
    context.currentStepId ? `Current step: ${context.currentStepId}` : "",
    context.selectedConceptId ? `Selected concept: ${context.selectedConceptId}` : "",
    context.stepStates ? `Step states: ${JSON.stringify(context.stepStates)}` : "",
    context.intakeAnalysis ? `Intake analysis: ${context.intakeAnalysis}` : "",
    context.strategyOutput ? `Strategy output available: yes` : "",
    context.copyOutput ? `Copy output available: yes` : "",
    context.validatorStatus ? `Validator status: ${context.validatorStatus}` : "",
    context.imageUrl ? `Image available: ${context.imageUrl}` : "",
    context.videoUrl ? `Video available: ${context.videoUrl}` : "",
  ].filter(Boolean).join("\n");

  return `You are STREAMS — an expert AI pipeline director for telehealth content production.

You help users build compliant, premium telehealth ad campaigns through a 7-step pipeline.

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

AVAILABLE ACTIONS (include in your response as needed):
- update_strategy_prompt / update_copy_prompt / update_validator_prompt / update_image_prompt / update_i2v_prompt / update_qa_instruction — update a step's prompt
- generate_image — trigger image generation (pass: prompt, conceptId?)
- generate_video — trigger video generation (pass: prompt, conceptId?)
- generate_i2v — trigger image-to-video (pass: prompt, imageUrl, conceptId?)
- run_step — run a specific pipeline step (pass: stepId)
- run_pipeline — run the full pipeline
- select_concept — select active concept (pass: conceptId)
- approve_output — approve an output for workspace (pass: type, url)
- open_step_config — open the step config panel (pass: stepId)
- set_niche — change active niche (pass: nicheId)
- update_prompt — update current prompt
- update_settings — update a setting (key, value)

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
