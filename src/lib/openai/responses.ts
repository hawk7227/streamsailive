import { getSiteConfig } from '@/lib/config';
import { detectModeFromText } from '@/lib/enforcement/modeEngine';
import { runValidators } from '@/lib/enforcement/validatorRunner';
import { validateChatResponse } from '@/lib/enforcement/validators/chat';
import type { AssistantMode } from '@/lib/enforcement/types';
import { formatIntegratedContext } from '@/lib/ai-chat/context/buildIntegratedContext';
import type { IntegratedChatContextParts } from '@/lib/ai-chat/context/types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
    | 'set_niche';
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

function getLastUserText(messages: ChatMessage[]): string {
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
  const settingsInfo = Object.entries(context.settings ?? {}).map(([key, value]) => `${key}: ${value}`).join(', ');
  const integratedContext = buildContextInfo(context);

  const base = `You are STREAMS — a production-grade assistant, builder, and verifier.\n\nCURRENT PIPELINE STATE:\n${pipelineInfo || 'No pipeline context loaded'}\nCURRENT SETTINGS: ${settingsInfo || 'none'}\nCURRENT PROMPT: ${context.prompt || 'none'}\n\nINJECTED CONTEXT:\n${integratedContext}`;

  switch (mode) {
    case 'conversation':
      return `${base}\n\nMODE: CONVERSATION\nRules:\n- Answer naturally in plain language\n- Keep simple questions simple\n- Start with the direct answer\n- Use attached files, URLs, voice transcript, and project memory when relevant\n- Avoid documentation-style formatting unless clarity requires it\n- Never return status-only text`;
    case 'builder':
      return `${base}\n\nMODE: BUILDER\nRules:\n- Be precise and production-minded\n- Use provided files, URLs, and project context before giving implementation guidance\n- Preserve architecture and avoid broad rewrites unless necessary\n- No fluff`;
    case 'verification':
      return `${base}\n\nMODE: VERIFICATION\nRules:\n- Be strict and evidence-first\n- Use provided file/url/voice/project context as evidence where available\n- Never claim something works without evidence\n- Always include sections exactly titled VERIFIED:, NOT VERIFIED:, and REQUIRES RUNTIME:\n- Do not replace proof with suggestions`;
    case 'execution':
      return `${base}\n\nMODE: EXECUTION\nRules:\n- Return the requested artifact directly\n- Keep explanation minimal but non-zero\n- If returning schema or JSON, introduce it with one brief line`;
    case 'action':
      return `${base}\n\nMODE: ACTION\nReturn valid JSON with exact shape: {"message":"real explanation","actions":[{"type":"...","payload":{}}]}\nThe message field must never be a status word.`;
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

function createRequestBody(mode: AssistantMode, messages: ChatMessage[], context: PipelineContext, stream: boolean): Record<string, unknown> {
  const config = getModelConfig(mode);
  const body: Record<string, unknown> = {
    model: getSiteConfig().copilotModel || 'gpt-4o',
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const requestText = getLastUserText(messages);
  const mode = detectModeFromText(requestText);
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

function parseStreamingLine(line: string): string {
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

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

  const upstream = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
