import { getSiteConfig } from '@/lib/config';

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
}

export interface PipelineContext {
  type: string;
  prompt: string;
  settings: Record<string, string>;
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
  mode: ResponseMode;
  reply: string;
  action?: AssistantAction;
}

type ResponseMode = "conversation" | "action" | "extraction" | "status";

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

// ─── Status-only response detection ──────────────────────────────────────────

const STATUS_ONLY_PATTERNS = [
  /^done\.?$/i,
  /^completed\.?$/i,
  /^finished\.?$/i,
  /^ok\.?$/i,
  /^sure\.?$/i,
  /^alright\.?$/i,
  /^no action needed\.?$/i,
  /^nothing to do\.?$/i,
];

function isStatusOnly(text: string): boolean {
  const t = text.trim();
  return t.length < 20 || STATUS_ONLY_PATTERNS.some(p => p.test(t));
}

// ─── Intent classifier ────────────────────────────────────────────────────────

const ACTION_KEYWORDS = [
  "generate", "create", "make", "run", "trigger", "deploy", "push",
  "approve", "select", "start", "execute", "launch", "build",
];
const STATUS_KEYWORDS = [
  "is it done", "status", "are you done", "finished yet", "complete yet",
];
const EXTRACTION_KEYWORDS = [
  "extract", "parse", "list all", "give me json", "return json",
  "structured output", "schema",
];

function classifyIntent(messages: ChatMessage[]): ResponseMode {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return "conversation";
  const text = (typeof lastUser.content === "string"
    ? lastUser.content
    : lastUser.content.filter((b): b is { type: "text"; text: string } => b.type === "text").map(b => b.text).join(" ")
  ).toLowerCase();

  if (STATUS_KEYWORDS.some(k => text.includes(k))) return "status";
  if (EXTRACTION_KEYWORDS.some(k => text.includes(k))) return "extraction";
  if (ACTION_KEYWORDS.some(k => text.includes(k))) return "action";
  return "conversation";
}

// ─── Provider knowledge ───────────────────────────────────────────────────────

const PROVIDER_KNOWLEDGE = `
KLING T2V: ≤50 words. Subject+Action+Environment+Camera+Mood. Include negative prompt.
KLING I2V: ≤40 words. Motion ONLY — never re-describe the image.
RUNWAY T2V: ≤1000 chars. No separate negative prompts.
TELEHEALTH MOTION BANNED: fast zoom, whip pan, face distortion, lip sync, mouth animation.
TELEHEALTH MOTION ALLOWED: slow push-in, gentle pan, soft parallax, natural blink.
`.trim();

// ─── Mode-specific system prompts ─────────────────────────────────────────────

function buildConversationPrompt(context: PipelineContext, pipelineInfo: string, settingsInfo: string): string {
  return `You are STREAMS — an expert AI assistant and pipeline director for telehealth content production.

You help users understand, debug, plan, and execute their content pipelines.

RESPONSE RULES:
- Answer the user's actual question directly and completely
- Respond the way a strong human expert would in chat — natural, direct, thorough
- Never compress your answer into a status word like "Done." or "Completed."
- Never say "verified", "confirmed", or "working" unless you actually checked through a tool — if you haven't checked, say so explicitly
- Give at minimum: a direct answer, an explanation tied to the question, and uncertainty where it exists
- If the user asks about capabilities, list them fully and honestly
- If the user asks to debug, give structured findings: what exists, what is broken, what is missing, confidence level

HONESTY RULES:
- Never claim to have verified something you did not actually check
- If you do not know, say exactly that
- Separate what you confirmed from what you inferred from what you assumed

CURRENT PIPELINE STATE:
${pipelineInfo || "No pipeline context loaded"}

CURRENT SETTINGS: ${settingsInfo || "none"}
CURRENT PROMPT: ${context.prompt || "none"}

PROVIDER KNOWLEDGE:
${PROVIDER_KNOWLEDGE}

Respond in plain natural language. No JSON envelope. No action wrapper.`;
}

function buildActionPrompt(context: PipelineContext, pipelineInfo: string, settingsInfo: string): string {
  return `You are STREAMS — an expert AI pipeline director for telehealth content production.

CRITICAL: When you see failed concepts or errors in the pipeline state, your FIRST response must:
1. State clearly what failed and exactly why
2. Give the specific fix in plain language
3. Tell the user exactly what to do next

Common errors and their fixes:
- "Unauthorized" from OpenAI → API key is wrong or expired. Fix: check DigitalOcean env vars.
- "gpt-image-1" model error → requires special org access. Revert to dall-e-3.
- "Generation failed" → Check the Logs tab for the specific error message.
- Images look too polished/AI → Realism sanitizer is active. Try regenerating.

PIPELINE STEPS (in order):
1. creativeStrategy — brand and audience strategy
2. copyGeneration — 3 compliant copy variants
3. validator — regulatory compliance check
4. imageryGeneration — image generation
5. imageToVideoStep — image-to-video
6. assetLibrary — organise all outputs
7. qualityAssurance — final compliance QA

PROVIDER KNOWLEDGE:
${PROVIDER_KNOWLEDGE}

CURRENT PIPELINE STATE:
${pipelineInfo || "No pipeline context loaded"}

CURRENT SETTINGS: ${settingsInfo || "none"}
CURRENT PROMPT: ${context.prompt || "none"}

AVAILABLE ACTIONS:
- generate_image — { conceptId?: string }
- generate_video — { conceptId?: string }
- generate_i2v — { prompt, imageUrl, conceptId? }
- run_pipeline — {}
- run_step — { stepId }
- update_image_prompt — { value: string }
- update_strategy_prompt / update_copy_prompt / update_validator_prompt / update_i2v_prompt / update_qa_instruction — { value: string }
- select_concept — { conceptId }
- approve_output — { type, url }
- open_step_config — { stepId }
- set_niche — { nicheId }
- update_prompt — { new_prompt: string }

GOVERNANCE: NO diagnostic claims, NO guaranteed outcomes, NO prescription certainty.

RESPONSE FORMAT — return valid JSON:
{
  "message": "A real human reply explaining what you are doing and why — never a status word",
  "actions": [{ "type": "action_type", "payload": { ... } }]
}

The message field must always be a real explanation to the user, not a status word.
If no action is needed, return empty actions array.`;
}

function buildStatusPrompt(): string {
  return `You are STREAMS. The user asked for a status update. 
Return valid JSON: { "message": "brief status", "actions": [] }
Be short and factual.`;
}

function buildExtractionPrompt(): string {
  return `You are STREAMS. Extract and return structured data as requested.
Return valid JSON with the requested schema.`;
}

// ─── Pipeline info builder ────────────────────────────────────────────────────

function buildPipelineInfo(context: PipelineContext): string {
  const ctx = context as unknown as Record<string, unknown>;
  const conceptErrors = ctx.conceptErrors as Record<string, string | null> | undefined;
  const conceptStatuses = ctx.conceptStatuses as Record<string, string> | undefined;
  const hasFailedConcepts = ctx.hasFailedConcepts as boolean | undefined;
  const imageProvider = ctx.imageProvider as string | undefined;

  const errorSummary = conceptErrors
    ? Object.entries(conceptErrors).filter(([, e]) => e).map(([id, e]) => `${id}: ${e}`).join("; ")
    : "";

  return [
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
}

// ─── Model call config per mode ───────────────────────────────────────────────

function getModelConfig(mode: ResponseMode) {
  switch (mode) {
    case "conversation":
      return { temperature: 0.7, max_tokens: 2000, response_format: undefined };
    case "action":
      return { temperature: 0.4, max_tokens: 1000, response_format: { type: "json_object" as const } };
    case "extraction":
      return { temperature: 0.2, max_tokens: 1200, response_format: { type: "json_object" as const } };
    case "status":
      return { temperature: 0.2, max_tokens: 200, response_format: { type: "json_object" as const } };
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function createAssistantChatResponse(
  messages: ChatMessage[],
  context: PipelineContext
): Promise<AssistantResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  void getSiteConfig(); // keep import live

  const pipelineInfo = buildPipelineInfo(context);
  const settingsInfo = Object.entries(context.settings ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ");

  // Classify intent
  const mode = classifyIntent(messages);

  // Build mode-specific system prompt
  let systemContent: string;
  switch (mode) {
    case "conversation":
      systemContent = buildConversationPrompt(context, pipelineInfo, settingsInfo);
      break;
    case "action":
      systemContent = buildActionPrompt(context, pipelineInfo, settingsInfo);
      break;
    case "status":
      systemContent = buildStatusPrompt();
      break;
    case "extraction":
      systemContent = buildExtractionPrompt();
      break;
  }

  const systemMessage: ChatMessage = { role: "system", content: systemContent };
  const config = getModelConfig(mode);

  const bodyObj: Record<string, unknown> = {
    model: "gpt-4o",
    messages: [systemMessage, ...messages],
    temperature: config.temperature,
    max_tokens: config.max_tokens,
  };
  if (config.response_format) bodyObj.response_format = config.response_format;

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errorBody?.error?.message ?? "OpenAI request failed");
  }

  const payload = await response.json() as { choices: { message: { content: string } }[] };
  const raw = payload.choices?.[0]?.message?.content ?? "";

  let message: string;
  let actions: AssistantAction[] = [];

  if (mode === "conversation") {
    // Plain text — no JSON parsing
    message = raw.trim();
  } else {
    // JSON modes
    try {
      const parsed = JSON.parse(raw) as { message?: string; actions?: AssistantAction[] };
      message = parsed.message ?? raw;
      actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    } catch {
      message = raw;
      actions = [];
    }
  }

  // ── Output rejection gate ─────────────────────────────────────────────────
  // If conversation mode returned a status-only answer, regenerate once
  if (mode === "conversation" && isStatusOnly(message)) {
    const retryBody: Record<string, unknown> = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemContent },
        ...messages,
        { role: "system", content: "Your previous response was too short or a status-only reply. Answer the user's actual question directly and completely in natural language. Give a real explanation." },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    };
    const retryRes = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(retryBody),
    });
    if (retryRes.ok) {
      const retryPayload = await retryRes.json() as { choices: { message: { content: string } }[] };
      const retryRaw = retryPayload.choices?.[0]?.message?.content ?? "";
      if (retryRaw.trim().length > 20) message = retryRaw.trim();
    }
  }

  const firstAction = actions[0];
  return {
    message,
    actions,
    mode,
    reply: message,
    action: firstAction,
  };
}
