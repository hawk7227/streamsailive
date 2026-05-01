'use client';

/**
 * UnifiedChatPanel
 * Clean replacement for the three chat-runtime behaviors:
 * 1. ChatGPT-style thought/status row
 * 2. calm phrase-by-phrase response rendering
 * 3. bottom-aware auto-scroll + Future Grid activity card for generation/build work
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityMode } from './ActivityGenerationCard';
import { useCalmStream } from './useCalmStream';
import { useSmartAutoScroll } from './useSmartAutoScroll';
import { C, CT } from './tokens';
import { isImageGenerationPrompt } from '@/lib/assistant-ui/imageIntent';
import {
  createStreamsChatSession,
  getLatestStreamsChatSession,
  getStreamsChatMessages,
  persistStreamsChatMessage,
} from '@/lib/streams/chat/chat-history-client';

export interface ChatArtifact {
  id: string;
  code: string;
  type: 'react' | 'html' | 'svg';
  title?: string;
  language?: string;
}

interface ChatActivity {
  mode: ActivityMode;
  phase?: string;
  label?: string;
  title?: string;
  subtitle?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts?: ChatArtifact[];
  isStreaming?: boolean;
  statusText?: string;
  activity?: ChatActivity | null;
  error?: boolean;
  elapsedMs?: number;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  generationId?: string;
  artifactId?: string;
}

interface UnifiedChatPanelProps {
  projectId?: string;
  userId?: string;
  onArtifactGenerated?: (artifactId: string) => void;
}

type StreamEventName = 'activity' | 'response' | 'artifact' | 'complete' | 'error' | 'message';

type StreamPayload = {
  token?: string;
  mode?: ActivityMode;
  phase?: string;
  label?: string;
  title?: string;
  subtitle?: string;
  statusText?: string;
  elapsedMs?: number;
  message?: string;
  id?: string;
  code?: string;
  type?: 'react' | 'html' | 'svg';
  language?: string;
};

const CHAT_MAX_WIDTH = 'min(1120px, calc(100vw - 320px))';
const USER_BUBBLE_MAX_WIDTH = 'min(620px, 72%)';
const CHAT_TEXT_FONT_SIZE = 16;
const CHAT_TEXT_LINE_HEIGHT = 1.65;
const CHAT_META_FONT_SIZE = 13;
const COMPOSER_FONT_SIZE = 16;
const MOBILE_BREAKPOINT = 768;

function formatElapsedStatus(elapsedMs?: number): string {
  if (!elapsedMs || elapsedMs < 900) return 'Thought briefly ›';
  if (elapsedMs < 4500) return 'Thought for a couple of seconds ›';
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  return `Thought for ${seconds} seconds ›`;
}

function formatCompleteStatus(mode: ActivityMode | undefined, elapsedMs?: number, hasArtifact?: boolean): string {
  const seconds = Math.max(1, Math.round((elapsedMs ?? 0) / 1000));
  if (hasArtifact || mode === 'build' || mode === 'code') return `Built code in ${seconds} seconds ›`;
  if (mode === 'image') return `Generated image in ${seconds} seconds ›`;
  if (mode === 'image-edit') return `Edited image in ${seconds} seconds ›`;
  if (mode === 'file') return `Analyzed file in ${seconds} seconds ›`;
  return formatElapsedStatus(elapsedMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVideoGenerationPrompt(message: string): boolean {
  const normalized = message.toLowerCase();
  return /\b(video|clip|footage|animate)\b/.test(normalized) && /\b(generate|create|make|render)\b/.test(normalized);
}

function parseSseChunk(buffer: string): { events: Array<{ event: StreamEventName; data: StreamPayload }>; rest: string } {
  const events: Array<{ event: StreamEventName; data: StreamPayload }> = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';

  for (const part of parts) {
    const lines = part.split('\n');
    let event: StreamEventName = 'message';
    const dataLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (line.startsWith('event:')) event = line.slice(6).trim() as StreamEventName;
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }

    const dataRaw = dataLines.join('\n');
    if (!dataRaw) continue;

    try {
      events.push({ event, data: JSON.parse(dataRaw) as StreamPayload });
    } catch {
      events.push({ event, data: { message: dataRaw } });
    }
  }

  return { events, rest };
}

function inlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('**')) {
      nodes.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          style={{
            padding: '1px 4px',
            borderRadius: 4,
            background: CT.statusBg,
            fontSize: '0.92em',
            fontFamily: 'IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`${match.index}-link`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            style={{ color: C.blueLink, textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            {linkMatch[1]}
          </a>
        );
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function MarkdownMessage({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const result: Array<{ type: 'text' | 'code'; value: string; lang?: string }> = [];
    const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
      result.push({ type: 'code', lang: match[1] || 'text', value: match[2] || '' });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) result.push({ type: 'text', value: content.slice(lastIndex) });
    return result;
  }, [content]);

  if (!content) return null;

  return (
    <div
      style={{
        color: CT.t1,
        fontSize: CHAT_TEXT_FONT_SIZE,
        lineHeight: CHAT_TEXT_LINE_HEIGHT,
      }}
    >
      {blocks.map((block, blockIndex) => {
        if (block.type === 'code') {
          return (
            <pre
              key={`code-${blockIndex}`}
              style={{
                margin: '12px 0',
                padding: 14,
                overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
                borderRadius: 12,
                background: '#0d1228',
                color: '#f0f2ff',
                fontSize: 14,
                lineHeight: 1.6,
                fontFamily: 'IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              <code>{block.value.trim()}</code>
            </pre>
          );
        }

        const lines = block.value.split('\n');
        const nodes: React.ReactNode[] = [];
        let listItems: string[] = [];

        const flushList = () => {
          if (!listItems.length) return;
          nodes.push(
            <ul key={`ul-${blockIndex}-${nodes.length}`} style={{ margin: '8px 0 8px 20px', padding: 0 }}>
              {listItems.map((item, itemIndex) => (
                <li key={itemIndex} style={{ margin: '4px 0', paddingLeft: 2 }}>
                  {inlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
          listItems = [];
        };

        lines.forEach((line, lineIndex) => {
          const trimmed = line.trim();
          if (!trimmed) {
            flushList();
            return;
          }

          const bullet = trimmed.match(/^[-*]\s+(.+)$/);
          if (bullet) {
            listItems.push(bullet[1]);
            return;
          }

          flushList();

          const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
          if (heading) {
            const size = heading[1].length === 1 ? 20 : heading[1].length === 2 ? 17 : 15;
            nodes.push(
              <div
                key={`h-${blockIndex}-${lineIndex}`}
                style={{
                  margin: lineIndex === 0 ? '0 0 8px' : '14px 0 8px',
                  fontSize: size,
                  lineHeight: 1.25,
                  fontWeight: 650,
                  color: CT.t1,
                }}
              >
                {inlineMarkdown(heading[2])}
              </div>
            );
            return;
          }

          nodes.push(
            <p key={`p-${blockIndex}-${lineIndex}`} style={{ margin: nodes.length === 0 ? 0 : '10px 0 0' }}>
              {inlineMarkdown(trimmed)}
            </p>
          );
        });

        flushList();
        return <React.Fragment key={`text-${blockIndex}`}>{nodes}</React.Fragment>;
      })}
    </div>
  );
}

function AssistantStatusRow({ text, active }: { text?: string; active?: boolean }) {
  if (!text) return null;
  return (
    <button
      type="button"
      aria-label={text.replace('›', '').trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        padding: 0,
        margin: '0 0 8px 0',
        border: 'none',
        background: 'transparent',
        color: active ? CT.t2 : CT.t3,
        fontSize: 14,
        lineHeight: '20px',
        fontWeight: 400,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        cursor: 'default',
      }}
    >
      <span>{text}</span>
      {active && (
        <span
          aria-hidden="true"
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: CT.t4,
            opacity: 0.75,
            animation: 'streamsThoughtPulse 1.2s ease-in-out infinite',
          }}
        />
      )}
    </button>
  );
}

export function UnifiedChatPanel({ projectId, userId, onArtifactGenerated }: UnifiedChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ type: 'image' | 'video'; url: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantMsgIdRef = useRef<string | null>(null);
  const activeActivityRef = useRef<ChatActivity | null>(null);
  const activeArtifactRef = useRef<ChatArtifact | null>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);

  const { containerRef, bottomRef, onScroll, scrollToBottom } = useSmartAutoScroll<HTMLDivElement>({
    bottomThresholdPx: 112,
    throttleMs: 100,
  });

  const updateAssistantMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((message) => (message.id === id ? { ...message, ...patch } : message))
      );
      scrollToBottom();
    },
    [scrollToBottom]
  );

  const revealActiveGeneration = useCallback(
    (force = false) => {
      scrollToBottom({ force, behavior: force ? 'smooth' : 'auto' });
    },
    [scrollToBottom],
  );

  const ensureChatSession = useCallback(
    async (firstMessage?: string): Promise<string | null> => {
      if (sessionId) return sessionId;
      if (!userId) return null;

      const title =
        firstMessage && firstMessage.trim()
          ? firstMessage.trim().slice(0, 80)
          : 'New conversation';

      const createdSessionId = await createStreamsChatSession({
        userId,
        workspaceId: projectId || 'streams-public-test',
        title,
      });
      if (createdSessionId) setSessionId(createdSessionId);
      return createdSessionId;
    },
    [projectId, sessionId, userId],
  );

  const hydrateLatestSession = useCallback(async () => {
    if (!userId) {
      setSessionHydrated(true);
      return;
    }
    try {
      const workspaceId = projectId || 'streams-public-test';
      const latestSessionId = await getLatestStreamsChatSession({ userId, workspaceId });
      if (!latestSessionId) return;
      setSessionId(latestSessionId);
      const persistedMessages = await getStreamsChatMessages({ userId, sessionId: latestSessionId });
      const hydrated = persistedMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
          const metadata = (m.metadata ?? {}) as Record<string, unknown>;
          const artifactIds = Array.isArray(m.artifact_ids) ? m.artifact_ids : [];
          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content || '',
            generatedImageUrl:
              typeof metadata.generatedImageUrl === 'string'
                ? metadata.generatedImageUrl
                : typeof metadata.artifactUrl === 'string'
                  ? metadata.artifactUrl
                  : undefined,
            generatedVideoUrl:
              typeof metadata.generatedVideoUrl === 'string'
                ? metadata.generatedVideoUrl
                : typeof metadata.kind === 'string' && metadata.kind === 'generated_video' && typeof metadata.artifactUrl === 'string'
                  ? metadata.artifactUrl
                  : undefined,
            generationId: typeof metadata.generationId === 'string' ? metadata.generationId : undefined,
            artifactId:
              artifactIds[0] ??
              (typeof metadata.artifactId === 'string' ? metadata.artifactId : undefined),
          } as ChatMessage;
        });
      setMessages(hydrated);
      setTimeout(() => revealActiveGeneration(true), 40);
    } finally {
      setSessionHydrated(true);
    }
  }, [projectId, revealActiveGeneration, userId]);

  useEffect(() => {
    hydrateLatestSession();
  }, [hydrateLatestSession]);

  const calmStream = useCalmStream(
    (visibleText) => {
      const id = assistantMsgIdRef.current;
      if (!id) return;
      updateAssistantMessage(id, { content: visibleText });
    },
    {
      tickMs: 45,
      minCharsPerTick: 6,
      maxCharsPerTick: 22,
      maxWordsPerTick: 4,
      commaPauseMs: 60,
      periodPauseMs: 120,
      paragraphPauseMs: 160,
    }
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>('textarea')?.focus();
      }
      if (e.key === 'Escape') {
        if (abortControllerRef.current && isLoading) abortControllerRef.current.abort();
        document.activeElement instanceof HTMLElement && document.activeElement.blur();
      }
    };

    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  }, [isLoading]);

  useEffect(() => {
    if (!iframeRef.current) return;
    try {
      iframeRef.current.srcdoc = '<html><body style="margin:0;padding:12px;font-family:system-ui;background:#ffffff;color:#18181b;"></body></html>';
    } catch (error) {
      console.error('Failed to initialize iframe:', error);
    }
  }, []);

  // Rule 3.1 - keep bottom-anchored input above iOS software keyboard
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const handler = () => {
      const offset = window.innerHeight - vv.height;
      if (inputBarRef.current) {
        inputBarRef.current.style.transform = offset > 0 ? `translateY(-${offset}px)` : '';
      }
    };
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);

  const latestArtifact = messages
    .filter((message) => message.artifacts && message.artifacts.length > 0)
    .reverse()[0]?.artifacts?.[0];

  const writeArtifactToIframe = useCallback((artifact: ChatArtifact) => {
    if (!iframeRef.current) return;
    try {
      if (artifact.type === 'html' || artifact.type === 'svg') {
        iframeRef.current.srcdoc = artifact.code;
        return;
      }

      const escaped = artifact.code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      iframeRef.current.srcdoc = `<html><body style="margin:0;padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#ffffff;color:#18181b;"><pre style="white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5;margin:0;"><code>${escaped}</code></pre></body></html>`;
    } catch (error) {
      console.error('Failed to write artifact preview:', error);
    }
  }, []);

  const handleStreamEvent = useCallback(
    (event: StreamEventName, data: StreamPayload) => {
      const id = assistantMsgIdRef.current;
      if (!id) return;

      if (event === 'activity') {
        const mode = data.mode ?? activeActivityRef.current?.mode ?? 'conversation';
        activeActivityRef.current = {
          mode,
          phase: data.phase,
          label: data.label,
          title: data.title,
          subtitle: data.subtitle,
        };

        const phaseText =
          data.statusText ??
          (data.phase === 'responding'
            ? 'Responding…'
            : data.phase === 'tool' || data.phase === 'using_tools'
              ? 'Using tools…'
              : data.phase === 'generating'
                ? 'Generating…'
                : 'Thinking…');

        updateAssistantMessage(id, {
          activity: null,
          statusText: phaseText,
          isStreaming: true,
        });
        return;
      }

      if (event === 'response') {
        if (data.token) calmStream.enqueue(data.token);
        updateAssistantMessage(id, { isStreaming: true });
        return;
      }

      if (event === 'artifact' && data.code) {
        const artifact: ChatArtifact = {
          id: data.id ?? `artifact-${Date.now()}`,
          code: data.code,
          type: data.type ?? 'react',
          title: data.title ?? 'Generated Code',
          language: data.language,
        };
        activeArtifactRef.current = artifact;
        writeArtifactToIframe(artifact);
        onArtifactGenerated?.(artifact.id);
        updateAssistantMessage(id, { artifacts: [artifact] });
        return;
      }

      if (event === 'complete') {
        calmStream.flush();
        const mode = activeActivityRef.current?.mode;
        const hasArtifact = Boolean(activeArtifactRef.current);
        updateAssistantMessage(id, {
          isStreaming: false,
          activity: null,
          elapsedMs: data.elapsedMs,
          statusText: formatCompleteStatus(mode, data.elapsedMs, hasArtifact),
        });
        setIsLoading(false);
        revealActiveGeneration(true);
        return;
      }

      if (event === 'error') {
        calmStream.flush();
        updateAssistantMessage(id, {
          isStreaming: false,
          activity: null,
          error: true,
          statusText: 'The action failed.',
          content: data.message ? `Error: ${data.message}` : 'Error: The request failed.',
        });
        setIsLoading(false);
      }
    },
    [calmStream, onArtifactGenerated, revealActiveGeneration, updateAssistantMessage, writeArtifactToIframe]
  );

  const handleGenerateImageMessage = useCallback(
    async (message: string, assistantMessageId: string, abortController: AbortController, chatSessionId: string | null) => {
      const startedAt = Date.now();

      updateAssistantMessage(assistantMessageId, {
        content: '',
        statusText: 'Submitting to provider…',
        isStreaming: true,
        activity: null,
      });
      revealActiveGeneration(true);

      const generationRes = await fetch('/api/streams/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message,
          model: 'kontext',
          aspectRatio: '1:1',
          numImages: 1,
          userId,
          sessionId: chatSessionId,
        }),
        signal: abortController.signal,
      });

      if (!generationRes.ok) {
        const errorText = await generationRes.text().catch(() => 'Image generation request failed.');
        throw new Error(errorText || 'Image generation request failed.');
      }

      const generationData = (await generationRes.json()) as {
        generationId?: string;
        responseUrl?: string;
        error?: string;
      };

      if (!generationData.generationId || !generationData.responseUrl) {
        throw new Error(generationData.error || 'Image generation did not return a valid job.');
      }

      updateAssistantMessage(assistantMessageId, {
        generationId: generationData.generationId,
        statusText: 'Generation is running…',
        isStreaming: true,
      });
      revealActiveGeneration();

      const maxPolls = 90;
      for (let attempt = 0; attempt < maxPolls; attempt += 1) {
        if (abortController.signal.aborted) {
          throw new DOMException('Image generation aborted.', 'AbortError');
        }

        await sleep(2000);

        const statusRes = await fetch('/api/streams/video/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationId: generationData.generationId,
            responseUrl: generationData.responseUrl,
            userId,
            sessionId: chatSessionId,
          }),
          signal: abortController.signal,
        });

        if (!statusRes.ok) {
          const errorText = await statusRes.text().catch(() => 'Image status check failed.');
          throw new Error(errorText || 'Image status check failed.');
        }

        const statusData = (await statusRes.json()) as {
          status?: string;
          artifactUrl?: string;
          artifactPersisted?: boolean;
          mimeType?: string;
          artifact?: {
            id?: string;
            preview_url?: string;
            download_url?: string;
            type?: string;
            session_id?: string | null;
            created_by_chat?: boolean;
          } | null;
          error?: string;
        };

        if (statusData.status === 'completed' && statusData.artifactUrl) {
          const artifactId = statusData.artifact?.id;
          const elapsedMs = Date.now() - startedAt;
          updateAssistantMessage(assistantMessageId, {
            isStreaming: false,
            activity: null,
            elapsedMs,
            content: '',
            generatedImageUrl: statusData.artifactUrl,
            generationId: generationData.generationId,
            artifactId,
            statusText: formatCompleteStatus('image', elapsedMs, false),
          });
          if (chatSessionId && userId) {
            await persistStreamsChatMessage({
              userId,
              workspaceId: projectId || 'streams-public-test',
              sessionId: chatSessionId,
              role: 'assistant',
              content: '',
              artifactIds: artifactId ? [artifactId] : [],
              metadata: {
                kind: 'generated_image',
                generatedImageUrl: statusData.artifactUrl,
                artifactUrl: statusData.artifactUrl,
                artifactId,
                generationId: generationData.generationId,
                artifactPersisted: Boolean(statusData.artifactPersisted),
                mimeType: statusData.mimeType,
              },
            });
          }
          setIsLoading(false);
          revealActiveGeneration(true);
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Image generation failed.');
        }

        updateAssistantMessage(assistantMessageId, {
          statusText: attempt > 0 ? 'Generation is running…' : 'Preparing generation…',
          isStreaming: true,
        });
        revealActiveGeneration();
      }

      throw new Error('Image generation timed out.');
    },
    [projectId, revealActiveGeneration, updateAssistantMessage, userId]
  );

  const handleGenerateVideoMessage = useCallback(
    async (message: string, assistantMessageId: string, abortController: AbortController, chatSessionId: string | null) => {
      const startedAt = Date.now();
      updateAssistantMessage(assistantMessageId, {
        content: '',
        statusText: 'Submitting to provider…',
        isStreaming: true,
        activity: null,
      });
      revealActiveGeneration(true);

      const generationRes = await fetch('/api/streams/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message,
          mode: 't2v',
          model: 'pro',
          duration: 5,
          aspectRatio: '16:9',
          userId,
          sessionId: chatSessionId,
        }),
        signal: abortController.signal,
      });

      if (!generationRes.ok) throw new Error((await generationRes.text()) || 'Video generation request failed.');
      const generationData = (await generationRes.json()) as { generationId?: string; responseUrl?: string; error?: string };
      if (!generationData.generationId || !generationData.responseUrl) {
        throw new Error(generationData.error || 'Video generation did not return a valid job.');
      }

      updateAssistantMessage(assistantMessageId, {
        generationId: generationData.generationId,
        statusText: 'Generation is running…',
        isStreaming: true,
      });
      revealActiveGeneration();

      for (let attempt = 0; attempt < 120; attempt += 1) {
        if (abortController.signal.aborted) throw new DOMException('Video generation aborted.', 'AbortError');
        await sleep(2500);
        const statusRes = await fetch('/api/streams/video/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationId: generationData.generationId,
            responseUrl: generationData.responseUrl,
            userId,
            sessionId: chatSessionId,
          }),
          signal: abortController.signal,
        });
        if (!statusRes.ok) throw new Error((await statusRes.text()) || 'Video status check failed.');
        const statusData = (await statusRes.json()) as {
          status?: string; artifactUrl?: string; artifactPersisted?: boolean; mimeType?: string; artifact?: { id?: string } | null; error?: string;
        };
        if (statusData.status === 'completed' && statusData.artifactUrl) {
          const artifactId = statusData.artifact?.id;
          const elapsedMs = Date.now() - startedAt;
          updateAssistantMessage(assistantMessageId, {
            isStreaming: false,
            activity: null,
            elapsedMs,
            content: '',
            generatedVideoUrl: statusData.artifactUrl,
            generationId: generationData.generationId,
            artifactId,
            statusText: formatCompleteStatus('conversation', elapsedMs, false),
          });
          if (chatSessionId && userId) {
            await persistStreamsChatMessage({
              userId,
              workspaceId: projectId || 'streams-public-test',
              sessionId: chatSessionId,
              role: 'assistant',
              content: '',
              artifactIds: artifactId ? [artifactId] : [],
              metadata: {
                kind: 'generated_video',
                generatedVideoUrl: statusData.artifactUrl,
                artifactUrl: statusData.artifactUrl,
                artifactId,
                generationId: generationData.generationId,
                artifactPersisted: Boolean(statusData.artifactPersisted),
                mimeType: statusData.mimeType,
              },
            });
          }
          setIsLoading(false);
          revealActiveGeneration(true);
          return;
        }
        updateAssistantMessage(assistantMessageId, {
          statusText: attempt > 0 ? 'Generation is running…' : 'Preparing generation…',
          isStreaming: true,
        });
        revealActiveGeneration();
        if (statusData.status === 'failed') throw new Error(statusData.error || 'Video generation failed.');
      }
      throw new Error('Video generation timed out.');
    },
    [projectId, revealActiveGeneration, updateAssistantMessage, userId],
  );

  const handleSendMessage = useCallback(
    async (message: string, fileData?: { name: string; type: string; content: string }) => {
      const normalizedMessage = message.trim();
      if (!normalizedMessage || !userId || isLoading) return;

      const isDirectVideoRequest = !fileData && isVideoGenerationPrompt(normalizedMessage);
      const isDirectImageRequest = !fileData && !isDirectVideoRequest && isImageGenerationPrompt(normalizedMessage);
      const now = Date.now();
      const userMsg: ChatMessage = {
        id: `msg-${now}`,
        role: 'user',
        content: normalizedMessage,
      };
      const assistantMsg: ChatMessage = {
        id: `msg-${now}-assistant`,
        role: 'assistant',
        content: '',
        statusText: isDirectImageRequest ? 'Generating image…' : isDirectVideoRequest ? 'Generating video…' : 'Thinking…',
        isStreaming: true,
        activity: null,
      };

      assistantMsgIdRef.current = assistantMsg.id;
      activeActivityRef.current = {
        mode: isDirectImageRequest ? 'image' : isDirectVideoRequest ? 'image' : fileData ? 'file' : 'conversation',
        phase: isDirectImageRequest || isDirectVideoRequest ? 'generating' : 'thinking',
      };
      activeArtifactRef.current = null;
      calmStream.reset('');

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      revealActiveGeneration(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const chatSessionId = await ensureChatSession(normalizedMessage);
        if (chatSessionId) {
          await persistStreamsChatMessage({
            userId,
            workspaceId: projectId || 'streams-public-test',
            sessionId: chatSessionId,
            role: 'user',
            content: normalizedMessage,
              metadata: {
                hasFile: Boolean(fileData),
                directImageRequest: isDirectImageRequest,
                directVideoRequest: isDirectVideoRequest,
              },
          });
        }

        if (isDirectImageRequest) {
          await handleGenerateImageMessage(normalizedMessage, assistantMsg.id, abortController, chatSessionId);
          return;
        }
        if (isDirectVideoRequest) {
          await handleGenerateVideoMessage(normalizedMessage, assistantMsg.id, abortController, chatSessionId);
          return;
        }
        const response = await fetch('/api/streams/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            projectId: projectId || null,
            userId,
            sessionId: chatSessionId,
            file: fileData
              ? {
                  name: fileData.name,
                  type: fileData.type,
                  content: fileData.content,
                }
              : null,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) throw new Error(`Chat API error: ${response.statusText}`);
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseChunk(buffer);
          buffer = parsed.rest;
          parsed.events.forEach(({ event, data }) => handleStreamEvent(event, data));
        }

        if (buffer.trim()) {
          const parsed = parseSseChunk(`${buffer}\n\n`);
          parsed.events.forEach(({ event, data }) => handleStreamEvent(event, data));
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          const id = assistantMsgIdRef.current;
          if (id) {
            calmStream.flush();
            updateAssistantMessage(id, {
              isStreaming: false,
              activity: null,
              statusText: 'Stopped.',
              content: calmStream.getVisibleText() || 'Stopped.',
            });
          }
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Chat error:', error);
          const id = assistantMsgIdRef.current;
          if (id) {
            updateAssistantMessage(id, {
              isStreaming: false,
              activity: null,
              error: true,
              statusText: 'The action failed.',
              content: `Error: ${errorMessage}`,
            });
          }
        }
        setIsLoading(false);
      }
    },
    [calmStream, ensureChatSession, handleGenerateImageMessage, handleGenerateVideoMessage, handleStreamEvent, isLoading, projectId, revealActiveGeneration, updateAssistantMessage, userId]
  );

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    let fileData: { name: string; type: string; content: string } | undefined;
    if (uploadedFile && fileInputRef.current?.files?.[0]) {
      const file = fileInputRef.current.files[0];
      try {
        const content = await file.text();
        fileData = { name: file.name, type: file.type, content };
      } catch (error) {
        console.error('Failed to read file:', error);
      }
    }

    const outgoing = inputValue;
    setInputValue('');
    setUploadedFile(null);
    await handleSendMessage(outgoing, fileData);
  }, [handleSendMessage, inputValue, isLoading, uploadedFile]);

  const activeChatMaxWidth = isMobile ? '100%' : CHAT_MAX_WIDTH;

  const copyToClipboard = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, []);

  const renderMediaActions = (url: string, type: 'image' | 'video', artifactId?: string) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      <button type="button" onClick={() => setPreviewMedia({ type, url })} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${CT.border}`, background: CT.bg, color: CT.t2 }}>Preview</button>
      <a href={url} download target="_blank" rel="noreferrer" style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${CT.border}`, background: CT.bg, color: CT.t2, textDecoration: 'none' }}>Download</a>
      <button type="button" onClick={() => copyToClipboard(url)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${CT.border}`, background: CT.bg, color: CT.t2 }}>Copy URL</button>
      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
        <button type="button" onClick={() => navigator.share({ url }).catch(() => null)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${CT.border}`, background: CT.bg, color: CT.t2 }}>Share</button>
      ) : null}
      {artifactId ? (
        <button type="button" onClick={() => copyToClipboard(artifactId)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${CT.border}`, background: CT.bg, color: CT.t2 }}>Inspect</button>
      ) : null}
    </div>
  );

  const renderGenerationActivityCard = (statusText?: string) => (
    <div style={{ marginTop: 12, borderRadius: 16, padding: 14, overflow: 'hidden', position: 'relative', border: `1px solid ${CT.border}`, background: 'linear-gradient(120deg, rgba(124,58,237,.18), rgba(14,165,233,.16), rgba(16,185,129,.14))' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent 0, transparent 22px, rgba(255,255,255,.08) 22px, rgba(255,255,255,.08) 23px)', animation: 'streamsShimmer 2.2s linear infinite' }} />
      <div style={{ position: 'relative', zIndex: 1, color: CT.t2, fontSize: 13, lineHeight: 1.4 }}>{statusText || 'Preparing generation…'}</div>
    </div>
  );

  const renderMessage = (msg: ChatMessage) => {
    if (msg.role === 'user') {
      return (
        <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', margin: '0 0 28px' }}>
          <div
            style={{
              maxWidth: USER_BUBBLE_MAX_WIDTH,
              color: CT.t1,
              fontSize: CHAT_TEXT_FONT_SIZE,
              lineHeight: CHAT_TEXT_LINE_HEIGHT,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textAlign: 'right',
            }}
          >
            {msg.content}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', margin: '0 0 30px' }}>
        <div style={{ maxWidth: activeChatMaxWidth, width: '100%' }}>
          <AssistantStatusRow text={msg.statusText} active={msg.isStreaming && !msg.content} />
          {msg.content ? <MarkdownMessage content={msg.content} /> : null}
          {msg.isStreaming && !msg.generatedImageUrl && !msg.generatedVideoUrl ? renderGenerationActivityCard(msg.statusText) : null}
          {msg.generatedImageUrl ? (
            <div style={{ marginTop: msg.content ? 12 : 0, border: `1px solid ${CT.border}`, borderRadius: 18, padding: 10, background: CT.bg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: CT.t3 }}>IMAGE</span>
                <span style={{ fontSize: 12, color: CT.t4 }}>{msg.artifactId ? 'saved' : 'generated'}</span>
              </div>
              <img
                src={msg.generatedImageUrl}
                alt="Generated image"
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  borderRadius: 18,
                  border: `1px solid ${CT.border}`,
                  background: '#ffffff',
                }}
              />
              {renderMediaActions(msg.generatedImageUrl, 'image', msg.artifactId)}
            </div>
          ) : null}
          {msg.generatedVideoUrl ? (
            <div style={{ marginTop: msg.content || msg.generatedImageUrl ? 12 : 0, border: `1px solid ${CT.border}`, borderRadius: 18, padding: 10, background: CT.bg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: CT.t3 }}>VIDEO</span>
                <span style={{ fontSize: 12, color: CT.t4 }}>{msg.artifactId ? 'saved' : 'generated'}</span>
              </div>
              <video
                src={msg.generatedVideoUrl}
                controls
                playsInline
                style={{
                  display: 'block',
                  width: '100%',
                  borderRadius: 18,
                  border: `1px solid ${CT.border}`,
                  background: '#000000',
                }}
              />
              {renderMediaActions(msg.generatedVideoUrl, 'video', msg.artifactId)}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const artifactPanel = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        backgroundColor: C.bg2,
        borderRadius: 12,
        padding: 12,
        border: `1px solid ${C.bdr}`,
        minWidth: 0,
        overflowY: 'auto',
        color: C.t1,
      }}
    >
      {latestArtifact ? (
        <>
<div style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center' }}>
            <button
              onClick={() => console.log('Regenerate clicked')}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: C.acc,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              ↻ Regenerate
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(latestArtifact.code)}
              style={{
                padding: '8px 12px',
                backgroundColor: C.bg3,
                color: C.t1,
                border: `1px solid ${C.bdr}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              Copy
            </button>
          </div>

          <iframe
            ref={iframeRef}
            style={{
              flex: 1,
              border: `1px solid ${C.bdr}`,
              borderRadius: 12,
              backgroundColor: '#fff',
              minHeight: 300,
            }}
            title="artifact-preview"
          />

          <pre
            style={{
              maxHeight: 200,
              overflow: 'auto',
              margin: 0,
              padding: 10,
              backgroundColor: C.bg3,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
              color: C.t2,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {latestArtifact.code.substring(0, 600)}
            {latestArtifact.code.length > 600 && '...'}
          </pre>
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: C.t4,
            textAlign: 'center',
            fontSize: 13,
            lineHeight: 1.6,
            minHeight: 260,
          }}
        >
          <p style={{ margin: 0 }}>Generated code and previews appear here</p>
        </div>
      )}
    </div>
  );

  const composer = (
    <div
      style={{
        width: '100%',
        maxWidth: activeChatMaxWidth,
        margin: isMobile ? 0 : '0 auto',
        padding: isMobile ? '8px 12px calc(12px + env(safe-area-inset-bottom))' : '10px 0 14px',
      }}
    >
      {uploadedFile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            padding: '8px 10px',
            backgroundColor: CT.statusBg,
            border: `1px solid ${CT.border}`,
            borderRadius: 12,
            fontSize: 13,
            color: CT.t2,
          }}
        >
          <span>📎</span>
          <span>{uploadedFile.name}</span>
          <button
            onClick={() => setUploadedFile(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: CT.t3, cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        ref={inputBarRef}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          minHeight: 58,
          padding: '8px 12px',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
          background: CT.bg,
          border: `1px solid ${CT.inputBorder}`,
          borderRadius: 20,
          boxShadow: '0 10px 32px rgba(0,0,0,0.10)',
        }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            border: `1px solid ${CT.inputBorder}`,
            background: '#fff',
            color: CT.t2,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: '32px',
            flexShrink: 0,
          }}
        >
          +
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.xlsx,.docx,.txt,.doc"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setUploadedFile({ name: file.name, type: file.type });
          }}
          style={{ display: 'none' }}
        />
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message Streams..."
          rows={1}
          style={{
            flex: 1,
            minHeight: 38,
            maxHeight: 112,
            padding: '8px 4px',
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            color: CT.t1,
            fontSize: COMPOSER_FONT_SIZE,
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          aria-label="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: 'none',
            background: isLoading || !inputValue.trim() ? CT.chipBorder : C.orange,
            color: '#fff',
            cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
            fontSize: 18,
            fontWeight: 500,
            lineHeight: '40px',
            flexShrink: 0,
            boxShadow: isLoading || !inputValue.trim() ? 'none' : '0 8px 22px rgba(249,115,22,0.28)',
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: CT.bg,
        color: CT.t1,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes streamsThoughtPulse {
          0%, 100% { opacity: .35; transform: scale(.82); }
          50% { opacity: .85; transform: scale(1); }
        }
        @keyframes streamsShimmer {
          0% { transform: translateX(-40px); }
          100% { transform: translateX(40px); }
        }
        .streams-chat-scroll::-webkit-scrollbar { width: 10px; }
        .streams-chat-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 999px; border: 3px solid transparent; background-clip: content-box; }
        .streams-chat-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {!isMobile ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: latestArtifact ? 'minmax(0, 65%) minmax(340px, 35%)' : 'minmax(0, 1fr)',
            gap: latestArtifact ? 18 : 0,
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <div
              ref={containerRef}
              onScroll={onScroll}
              className="streams-chat-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '48px clamp(48px, 8vw, 160px) 32px',
              }}
            >
              <div role="log" aria-live="polite" style={{ maxWidth: activeChatMaxWidth, margin: isMobile ? 0 : '0 auto', width: '100%' }}>{messages.map(renderMessage)}</div>
              <div ref={bottomRef} aria-hidden="true" style={{ height: 1 }} />
            </div>
            <div style={{ borderTop: `1px solid ${CT.border}`, background: CT.bg }}>{composer}</div>
          </div>
          {latestArtifact && <div style={{ padding: '16px 16px 16px 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>{artifactPanel}</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div
            ref={containerRef}
            onScroll={onScroll}
            className="streams-chat-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 16px 24px',
            }}
          >
            <div role="log" aria-live="polite" style={{ maxWidth: activeChatMaxWidth, margin: isMobile ? 0 : '0 auto', width: '100%' }}>{messages.map(renderMessage)}</div>
            {latestArtifact && <div style={{ margin: '16px 0' }}>{artifactPanel}</div>}
            <div ref={bottomRef} aria-hidden="true" style={{ height: 1 }} />
          </div>
          <div style={{ borderTop: `1px solid ${CT.border}`, background: CT.bg }}>{composer}</div>
        </div>
      )}
      {previewMedia ? (
        <div onClick={() => setPreviewMedia(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(96vw, 1080px)', maxHeight: '90vh', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
            {previewMedia.type === 'image' ? (
              <img src={previewMedia.url} alt="Preview" style={{ width: '100%', height: 'auto', display: 'block' }} />
            ) : (
              <video src={previewMedia.url} controls playsInline autoPlay style={{ width: '100%', display: 'block' }} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default UnifiedChatPanel;
