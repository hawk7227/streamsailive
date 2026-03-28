import { getSiteConfig } from '@/lib/config';
import { detectModeFromText } from '@/lib/enforcement/modeEngine';
import { runValidators } from '@/lib/enforcement/validatorRunner';
import { validateChatResponse } from '@/lib/enforcement/validators/chat';
import type { AssistantMode } from '@/lib/enforcement/types';
import { formatIntegratedContext } from '@/lib/ai-chat/context/buildIntegratedContext';
import type { IntegratedChatContextParts } from '@/lib/ai-chat/context/types';

// ── Provider routing ─────────────────────────────────────────────────────────
// URL and auth header are determined by the active model, not hardcoded.
// Set AI_PROVIDER_COPILOT=anthropic or copilotModel=claude-* to route to Anthropic.
// Defaults to OpenAI if no model prefix matches.

export function getProviderConfig(model: string): { url: string; authHeader: (key: string) => Record<string, string> } {
  if (model.startsWith('claude-')) {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      authHeader: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    };
  }
  // Default: OpenAI-compatible endpoint (works for gpt-*, o1-*, and any OpenAI-compatible API)
  return {
    url: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1/chat/completions',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  };
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
  tool_call_id?: string;
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
  provider?: string;
  extraKeys?: Record<string, string>;
  integratedContext?: IntegratedChatContextParts;
}

export interface AssistantAction {
  type:
    | 'update_prompt'
    | 'update_settings'
    | 'update_strategy_prompt'
    | 'update_copy_prompt'
    | 'update_validator_prompt'
    | 'update_image_prompt'
    | 'update_i2v_prompt'
    | 'update_qa_instruction'
    | 'generate_image'
    | 'generate_video'
    | 'generate_i2v'
    | 'run_step'
    | 'run_pipeline'
    | 'select_concept'
    | 'approve_output'
    | 'open_step_config'
    | 'set_niche'
    | 'run_verification'
    | 'save_to_brain';
  payload: Record<string, unknown>;
}

export interface AssistantResponse {
  message: string;
  actions: AssistantAction[];
  mode: AssistantMode;
  reply: string;
  action?: AssistantAction;
  ledger?: unknown;
}

function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content.filter((block): block is { type: 'text'; text: string } => block.type === 'text').map((block) => block.text).join(' ');
}

export function getLastUserText(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  return lastUser ? extractTextContent(lastUser.content) : '';
}

function buildPipelineInfo(context: PipelineContext): string {
  return [
    context.nicheId ? `Active niche: ${context.nicheId}` : '',
    context.currentStepId ? `Current step: ${context.currentStepId}` : '',
    context.selectedConceptId ? `Selected concept: ${context.selectedConceptId}` : '',
    context.stepStates ? `Step states: ${JSON.stringify(context.stepStates)}` : '',
    context.intakeAnalysis ? 'Intake analysis present' : '',
    context.strategyOutput ? 'Strategy output present' : '',
    context.copyOutput ? 'Copy output present' : '',
    context.imageUrl ? `Image available: ${context.imageUrl}` : '',
    context.videoUrl ? `Video available: ${context.videoUrl}` : '',
  ].filter(Boolean).join('\n');
}

function buildContextInfo(context: PipelineContext): string {
  const integrated = context.integratedContext ? formatIntegratedContext(context.integratedContext) : '';
  if (!integrated.trim()) return 'No file, URL, voice, or project context injected.';
  return integrated;
}

function buildSystemPrompt(mode: AssistantMode, context: PipelineContext): string {
  const pipelineInfo = buildPipelineInfo(context);
  const integratedContext = buildContextInfo(context);

  const core = `You are STREAMS — an assistant, builder, and verifier for an AI media pipeline platform.

RESPONSE STYLE:
- Match depth to the question. Short question = short answer. Complex = structured.
- Default to conversational prose. No bullet lists or headers unless they genuinely help.
- Start with the answer. Never open with a definition or preamble.
- Prefer clarity over completeness.
- Sound like a smart human, not a system.
- Avoid: unnecessary headings, over-formatting, documentation-style output.

PIPELINE STATE:
${pipelineInfo || 'No pipeline context loaded.'}

INJECTED CONTEXT:
${integratedContext}`;

  switch (mode) {
    case 'conversation':
      return `${core}\n\nAnswer directly. Keep it short if the question is short. Use structure only when it genuinely helps.`;

    case 'builder':
      return `${core}\n\nBe precise. Use injected context before guessing. Preserve existing architecture. No broad rewrites unless asked.`;

    case 'verification':
      return `${core}\n\nEvidence-first. Never claim something works without proof. Use exactly these three sections:\nVERIFIED: (confirmed with real evidence)\nNOT VERIFIED: (cannot confirm)\nREQUIRES RUNTIME: (needs a live check)\nDo not replace proof with suggestions.`;

    case 'execution':
      return `${core}\n\nReturn the artifact directly. One brief intro line, then the output.`;

    case 'action':
      return `${core}\n\nReturn ONLY valid JSON: {"message":"brief human explanation","actions":[{"type":"action_type","payload":{}}]}\nAvailable types: update_prompt, update_settings, update_image_prompt, update_video_prompt, update_strategy_prompt, update_copy_prompt, update_i2v_prompt, update_qa_instruction, generate_image, generate_video, generate_i2v, run_step, run_pipeline, select_concept, approve_output, open_step_config, set_niche, save_to_brain.\nThe message field must be a real sentence, never a status word.`;
  }
}

function getModelConfig(mode: AssistantMode) {
  switch (mode) {
    case 'conversation':
      return { temperature: 0.65, max_tokens: 2200, stream: true, response_format: undefined };
    case 'builder':
      return { temperature: 0.35, max_tokens: 2600, stream: true, response_format: undefined };
    case 'verification':
      return { temperature: 0.2, max_tokens: 2200, stream: true, response_format: undefined };
    case 'execution':
      return { temperature: 0.2, max_tokens: 1800, stream: true, response_format: undefined };
    case 'action':
      return { temperature: 0.2, max_tokens: 1200, stream: false, response_format: { type: 'json_object' as const } };
  }
}

export function createRequestBody(mode: AssistantMode, messages: ChatMessage[], context: PipelineContext, stream: boolean): Record<string, unknown> {
  const config = getModelConfig(mode);
  const activeModel = getSiteConfig().copilotModel || 'gpt-4o';
  const body: Record<string, unknown> = {
    model: activeModel,
    messages: [{ role: 'system', content: buildSystemPrompt(mode, context) }, ...messages],
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    stream,
  };
  if (!stream && config.response_format) body.response_format = config.response_format;
  return body;
}

function parseActionPayload(raw: string): { message: string; actions: AssistantAction[] } {
  try {
    const parsed = JSON.parse(raw) as { message?: string; actions?: AssistantAction[] };
    return {
      message: parsed.message?.trim() || 'I completed the action request, but no explanation was returned.',
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return { message: raw.trim() || 'I completed the action request, but no explanation was returned.', actions: [] };
  }
}

export async function createAssistantChatResponse(messages: ChatMessage[], context: PipelineContext): Promise<AssistantResponse> {
  const activeModel2 = getSiteConfig().copilotModel || 'gpt-4o';
  const provider = getProviderConfig(activeModel2);
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('Missing API key (OPENAI_API_KEY or ANTHROPIC_API_KEY)');

  const requestText = getLastUserText(messages);
  const mode = detectModeFromText(requestText);
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: { ...provider.authHeader(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(createRequestBody(mode, messages, context, false)),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Assistant request failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content?.trim() ?? '';
  const { message, actions } = mode === 'action' ? parseActionPayload(raw) : { message: raw, actions: [] as AssistantAction[] };

  const ledger = runValidators('chat', [{ name: 'chat-response', result: validateChatResponse({ mode, requestText, responseText: message, streamed: false }) }], { mode });
  const blocking = ledger.issues.find((issue) => issue.severity === 'error');
  if (blocking) throw new Error(blocking.message);

  return { message, actions, mode, reply: message, action: actions[0], ledger };
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function parseStreamingLine(line: string): string {
  if (!line.startsWith('data: ')) return '';
  const payload = line.slice(6).trim();
  if (!payload || payload === '[DONE]') return '';
  try {
    const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

export async function streamAssistantChatResponse(messages: ChatMessage[], context: PipelineContext): Promise<ReadableStream<Uint8Array>> {
  const activeModel3 = getSiteConfig().copilotModel || 'gpt-4o';
  const streamProvider = getProviderConfig(activeModel3);
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('Missing API key (OPENAI_API_KEY or ANTHROPIC_API_KEY)');

  const requestText = getLastUserText(messages);
  const mode = detectModeFromText(requestText);
  const encoder = new TextEncoder();

  if (mode === 'action') {
    const finalResponse = await createAssistantChatResponse(messages, context);
    return new ReadableStream<Uint8Array>({
      start(controller) {
        const chunks = finalResponse.message.match(/.{1,80}/g) ?? [finalResponse.message];
        for (const chunk of chunks) controller.enqueue(encoder.encode(sse({ type: 'text', delta: chunk })));
        for (const action of finalResponse.actions) controller.enqueue(encoder.encode(sse({ type: 'action', action })));
        controller.enqueue(encoder.encode(sse({ type: 'done', mode }))); controller.close();
      },
    });
  }

  const upstream = await fetch(streamProvider.url, {
    method: 'POST',
    headers: { ...streamProvider.authHeader(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(createRequestBody(mode, messages, context, true)),
  });

  if (!upstream.ok || !upstream.body) {
    const errorBody = await upstream.text().catch(() => 'Unknown upstream error');
    throw new Error(`Assistant stream failed (${upstream.status}): ${errorBody}`);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '';
      let fullText = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const delta = parseStreamingLine(line.trim());
            if (!delta) continue;
            fullText += delta;
            controller.enqueue(encoder.encode(sse({ type: 'text', delta })));
          }
        }

        const ledger = runValidators('chat', [{ name: 'chat-response', result: validateChatResponse({ mode, requestText, responseText: fullText, streamed: true }) }], { mode });
        const blocking = ledger.issues.find((issue) => issue.severity === 'error');
        if (blocking) controller.enqueue(encoder.encode(sse({ type: 'error', message: blocking.message })));
        controller.enqueue(encoder.encode(sse({ type: 'done', mode, ledger })));
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(sse({ type: 'error', message: error instanceof Error ? error.message : String(error) })));
        controller.close();
      }
    },
  });
}
