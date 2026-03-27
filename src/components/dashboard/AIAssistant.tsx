'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AIAssistantShell } from '@/components/ai-chat/AIAssistantShell';
import { AssistantMessageList } from '@/components/ai-chat/AssistantMessageList';
import type { AssistantMessageShape } from '@/components/ai-chat/AssistantMessage';
import { AttachmentRail } from '@/components/ai-chat/AttachmentRail';
import { ContextChips } from '@/components/ai-chat/ContextChips';
import { VoiceBar } from '@/components/ai-chat/VoiceBar';
import { useAssistantContextBridge } from '@/components/ai-chat/useAssistantContextBridge';
import type { AssistantMode } from '@/lib/enforcement/types';

interface Action { type: string; payload: Record<string, unknown>; }
interface AIAssistantProps {
  context: Record<string, unknown>;
  onApplyPrompt?: (prompt: string) => void;
  onUpdateSettings?: (key: string, value: string) => void;
  onGenerateImage?: (conceptId?: string, prompt?: string) => void;
  onGenerateVideo?: (conceptId?: string, prompt?: string) => void;
  onRunPipeline?: () => void;
  onRunStep?: (stepId: string, data?: Record<string, unknown>) => void;
  onSelectConcept?: (conceptId: string) => void;
  onApproveOutput?: (type: string, url: string) => void;
  onOpenStepConfig?: (stepId: string) => void;
  onSetNiche?: (nicheId: string) => void;
  onUpdateImagePrompt?: (value: string) => void;
  onUpdateVideoPrompt?: (value: string) => void;
  onUpdateStrategyPrompt?: (value: string) => void;
  onUpdateCopyPrompt?: (value: string) => void;
  onUpdateI2VPrompt?: (value: string) => void;
  onUpdateQAInstruction?: (value: string) => void;
}

const INITIAL_MESSAGE: AssistantMessageShape = {
  role: 'assistant',
  mode: 'conversation',
  content: [{ type: 'text', text: 'Hi. I can use chat, files, URLs, and voice context to help you build, verify, and refine work.' }],
};

function detectMedia(fullText: string): import('@/components/ai-chat/AssistantMessage').MsgContent[] {
  const blocks: import('@/components/ai-chat/AssistantMessage').MsgContent[] = [];
  const imageMatch = fullText.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i);
  const videoMatch = fullText.match(/https?:\/\/\S+\.(mp4|webm|mov)/i);
  if (imageMatch) blocks.push({ type: 'image_url', image_url: { url: imageMatch[0] } });
  if (videoMatch) blocks.push({ type: 'video_url', image_url: { url: videoMatch[0] } });
  return blocks;
}

export default function AIAssistant(props: AIAssistantProps) {
  const [messages, setMessages] = useState<AssistantMessageShape[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingMode, setStreamingMode] = useState<AssistantMode>('conversation');
  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem('streams_conv_id') ?? undefined;
  });
  const abortRef = useRef<AbortController | null>(null);
  const {
    attachments,
    voiceTranscript,
    setVoiceTranscript,
    addAttachment,
    removeAttachment,
    clearAttachments,
    clearVoiceTranscript,
    requestContext,
  } = useAssistantContextBridge(undefined, conversationId);

  const performAction = useCallback((action: Action) => {
    switch (action.type) {
      case 'update_prompt': props.onApplyPrompt?.(String(action.payload.new_prompt ?? action.payload.value ?? '')); break;
      case 'update_settings': props.onUpdateSettings?.(String(action.payload.key ?? ''), String(action.payload.value ?? '')); break;
      case 'update_image_prompt': props.onUpdateImagePrompt?.(String(action.payload.value ?? '')); break;
      case 'update_video_prompt': props.onUpdateVideoPrompt?.(String(action.payload.value ?? '')); break;
      case 'update_strategy_prompt': props.onUpdateStrategyPrompt?.(String(action.payload.value ?? '')); break;
      case 'update_copy_prompt': props.onUpdateCopyPrompt?.(String(action.payload.value ?? '')); break;
      case 'update_i2v_prompt': props.onUpdateI2VPrompt?.(String(action.payload.value ?? '')); break;
      case 'update_qa_instruction': props.onUpdateQAInstruction?.(String(action.payload.value ?? '')); break;
      case 'generate_image': props.onGenerateImage?.(action.payload.conceptId as string | undefined, action.payload.prompt as string | undefined); break;
      case 'generate_video': props.onGenerateVideo?.(action.payload.conceptId as string | undefined, action.payload.prompt as string | undefined); break;
      case 'run_pipeline': props.onRunPipeline?.(); break;
      case 'run_step': props.onRunStep?.(String(action.payload.stepId ?? ''), action.payload.data as Record<string, unknown> | undefined); break;
      case 'select_concept': props.onSelectConcept?.(String(action.payload.conceptId ?? '')); break;
      case 'approve_output': props.onApproveOutput?.(String(action.payload.type ?? ''), String(action.payload.url ?? '')); break;
      case 'open_step_config': props.onOpenStepConfig?.(String(action.payload.stepId ?? '')); break;
      case 'set_niche': props.onSetNiche?.(String(action.payload.nicheId ?? '')); break;
      default: break;
    }
  }, [props]);

  const sendMessage = useCallback(async (rawMessage: string) => {
    const message = rawMessage.trim();
    if ((!message && !attachments.length && !voiceTranscript.trim()) || pending) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const parts: Array<any> = [];
    if (message) parts.push({ type: 'text', text: message });
    if (attachments.length) parts.push({ type: 'text', text: `[context attachments: ${attachments.map((a) => `${a.kind}:${a.label}`).join(', ')}]` });
    if (voiceTranscript.trim()) parts.push({ type: 'text', text: `[voice transcript]
${voiceTranscript.trim()}` });

    const userMessage: AssistantMessageShape = { role: 'user', content: parts };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setPending(true);
    setStreamingText('');
    setStreamingMode('conversation');

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ messages: nextMessages, context: { ...props.context, conversationId }, requestContext }),
      });
      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => 'Assistant failed');
        throw new Error(errorText || 'Assistant failed');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let mode: AssistantMode = 'conversation';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const line = chunk.split('\n').find((entry) => entry.startsWith('data: '));
          if (!line) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; delta?: string; action?: Action; message?: string; conversationId?: string; mode?: AssistantMode; };
            if (event.type === 'text' && event.delta) {
              fullText += event.delta;
              setStreamingText(fullText);
            } else if (event.type === 'action' && event.action) {
              performAction(event.action);
            } else if (event.type === 'done') {
              if (event.conversationId) {
                setConversationId(event.conversationId);
                if (typeof window !== 'undefined') localStorage.setItem('streams_conv_id', event.conversationId);
              }
              if (event.mode) mode = event.mode;
              setStreamingMode(mode);
            } else if (event.type === 'error' && event.message) {
              fullText += `

${event.message}`;
              setStreamingText(fullText);
            }
          } catch {
            // ignore malformed SSE frame
          }
        }
      }

      const assistantMessage: AssistantMessageShape = {
        role: 'assistant',
        mode,
        content: [{ type: 'text', text: fullText || 'I completed the request, but no user-facing response text was returned.' }, ...detectMedia(fullText)],
      };
      setMessages((current) => [...current, assistantMessage]);
      clearAttachments();
      clearVoiceTranscript();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Assistant failed';
      setMessages((current) => [...current, { role: 'assistant', mode: 'verification', content: [{ type: 'text', text: `VERIFIED:
- The request reached the assistant layer.

NOT VERIFIED:
- The response could not be completed.

REQUIRES RUNTIME:
- Inspect the failed request path.

RISKS:
- ${messageText}` }] }]);
    } finally {
      setPending(false);
      setStreamingText('');
      abortRef.current = null;
    }
  }, [attachments, clearAttachments, clearVoiceTranscript, conversationId, messages, pending, performAction, props.context, requestContext, voiceTranscript]);

  const footer = useMemo(() => (
    <div className="grid gap-3">
      <AttachmentRail onAdd={addAttachment} />
      <VoiceBar onTranscript={setVoiceTranscript} speakText={streamingText && !pending ? streamingText : undefined} />
      <ContextChips attachments={attachments} voiceTranscript={voiceTranscript} onRemoveAttachment={removeAttachment} onClearVoice={clearVoiceTranscript} />
      <form onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }} className="flex items-end gap-3">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask naturally, build precisely, or demand proof." rows={1} className="max-h-40 min-h-[52px] flex-1 resize-none rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35" />
        <button type="submit" disabled={(!input.trim() && !attachments.length && !voiceTranscript.trim()) || pending} className="h-[52px] rounded-[22px] bg-white px-5 text-sm font-semibold text-[#0A0C10] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Working' : 'Send'}</button>
      </form>
    </div>
  ), [addAttachment, attachments, clearVoiceTranscript, input, pending, removeAttachment, sendMessage, setVoiceTranscript, streamingText, voiceTranscript]);

  return (
    <AIAssistantShell title="AI chat" subtitle="Floating, governed, streaming, multimodal" onClose={() => undefined} footer={footer}>
      <AssistantMessageList messages={messages} streamingText={streamingText} streamingMode={streamingMode} pending={pending} />
    </AIAssistantShell>
  );
}
