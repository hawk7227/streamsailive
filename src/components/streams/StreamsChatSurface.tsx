'use client';

/**
 * StreamsChatSurface v3
 * Clean, directly wired /streams chat surface.
 *
 * Goals:
 * - Replace the stale restricted chat layout path.
 * - Preserve calm streaming, activity cards, bottom-aware scroll, and artifact output.
 * - Follow the attached Streams build rules: mobile-first, no bubbles, no avatars,
 *   no message cards, safe-area composer, visualViewport keyboard handling.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActivityGenerationCard, { type ActivityMode } from './ActivityGenerationCard';
import { CT } from './tokens';
import './StreamsChatSurface.css';

type StreamEventName = 'activity' | 'response' | 'artifact' | 'complete' | 'error' | 'message';

type ChatMode = 'chat' | 'image' | 'video' | 'build';

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

interface ChatActivity {
  mode: ActivityMode;
  phase?: string;
  label?: string;
  title?: string;
  subtitle?: string;
}

interface ChatArtifact {
  id: string;
  code: string;
  type: 'react' | 'html' | 'svg';
  title?: string;
  language?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  statusText?: string;
  isStreaming?: boolean;
  activity?: ChatActivity | null;
  artifacts?: ChatArtifact[];
  error?: boolean;
  elapsedMs?: number;
}

interface StreamsChatSurfaceProps {
  projectId?: string;
  userId?: string;
  onArtifactGenerated?: (artifactId: string) => void;
}

const MODE_OPTIONS: Array<{ key: ChatMode; label: string }> = [
  { key: 'chat', label: 'Chat' },
  { key: 'image', label: 'Image' },
  { key: 'video', label: 'Video' },
  { key: 'build', label: 'Build' },
];

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function activityModeForChatMode(mode: ChatMode): ActivityMode {
  if (mode === 'image') return 'image';
  if (mode === 'video') return 'tool';
  if (mode === 'build') return 'build';
  return 'conversation';
}

function shouldShowActivityCard(activity?: ChatActivity | null, isStreaming?: boolean): boolean {
  if (!activity || !isStreaming) return false;
  return ['image', 'image-edit', 'build', 'code', 'tool', 'file'].includes(activity.mode);
}

function formatElapsedStatus(elapsedMs?: number): string {
  if (!elapsedMs || elapsedMs < 900) return 'Thought briefly ›';
  if (elapsedMs < 4500) return 'Thought for a couple of seconds ›';
  return `Thought for ${Math.max(1, Math.round(elapsedMs / 1000))} seconds ›`;
}

function formatCompleteStatus(mode: ActivityMode | undefined, elapsedMs?: number, hasArtifact?: boolean): string {
  const seconds = Math.max(1, Math.round((elapsedMs ?? 0) / 1000));
  if (hasArtifact || mode === 'build' || mode === 'code') return `Built code in ${seconds} seconds ›`;
  if (mode === 'image') return `Generated image in ${seconds} seconds ›`;
  if (mode === 'image-edit') return `Edited image in ${seconds} seconds ›`;
  if (mode === 'file') return `Analyzed file in ${seconds} seconds ›`;
  return formatElapsedStatus(elapsedMs);
}

function sanitizeVisibleText(value: string): string {
  return value
    .replace(/OpenAI/gi, 'API provider')
    .replace(/Anthropic/gi, 'model provider')
    .replace(/Claude/gi, 'assistant');
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
    if (match.index > lastIndex) nodes.push(sanitizeVisibleText(text.slice(lastIndex, match.index)));
    const token = match[0];

    if (token.startsWith('**')) {
      nodes.push(<strong key={`${match.index}-strong`}>{sanitizeVisibleText(token.slice(2, -2))}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={`${match.index}-code`}>{sanitizeVisibleText(token.slice(1, -1))}</code>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a key={`${match.index}-link`} href={linkMatch[2]} target="_blank" rel="noreferrer">
            {sanitizeVisibleText(linkMatch[1])}
          </a>
        );
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(sanitizeVisibleText(text.slice(lastIndex)));
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
    <div className="streams-chat-markdown-v3">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'code') {
          return (
            <pre key={`code-${blockIndex}`} className="streams-chat-code-v3">
              <code>{sanitizeVisibleText(block.value.trim())}</code>
            </pre>
          );
        }

        const lines = block.value.split('\n');
        const nodes: React.ReactNode[] = [];
        let listItems: string[] = [];

        const flushList = () => {
          if (!listItems.length) return;
          nodes.push(
            <ul key={`ul-${blockIndex}-${nodes.length}`}>
              {listItems.map((item, itemIndex) => (
                <li key={itemIndex}>{inlineMarkdown(item)}</li>
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
            const HeadingTag = heading[1].length === 1 ? 'h2' : heading[1].length === 2 ? 'h3' : 'h4';
            nodes.push(<HeadingTag key={`h-${blockIndex}-${lineIndex}`}>{inlineMarkdown(heading[2])}</HeadingTag>);
            return;
          }

          nodes.push(<p key={`p-${blockIndex}-${lineIndex}`}>{inlineMarkdown(trimmed)}</p>);
        });

        flushList();
        return <React.Fragment key={`text-${blockIndex}`}>{nodes}</React.Fragment>;
      })}
    </div>
  );
}

function defaultActivityForMode(mode: ChatMode): ChatActivity {
  const activityMode = activityModeForChatMode(mode);
  if (mode === 'image') {
    return {
      mode: activityMode,
      label: 'IMAGE GENERATION',
      title: 'Generating your image',
      subtitle: 'Your image is being created.',
      phase: 'generating',
    };
  }
  if (mode === 'video') {
    return {
      mode: activityMode,
      label: 'VIDEO WORK',
      title: 'Preparing the video request',
      subtitle: 'The generation pipeline is being prepared.',
      phase: 'working',
    };
  }
  if (mode === 'build') {
    return {
      mode: activityMode,
      label: 'BUILDING',
      title: 'Building your code',
      subtitle: 'Preparing the implementation and output.',
      phase: 'building',
    };
  }
  return { mode: activityMode, phase: 'thinking' };
}

export function StreamsChatSurface({ projectId, userId, onArtifactGenerated }: StreamsChatSurfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeMode, setActiveMode] = useState<ChatMode>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [composerHeight, setComposerHeight] = useState(120);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const activeActivityRef = useRef<ChatActivity | null>(null);
  const activeArtifactRef = useRef<ChatArtifact | null>(null);
  const visibleTextRef = useRef('');
  const pendingTextRef = useRef('');
  const calmTimerRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior });
  }, []);

  const updateAssistant = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch } : message)));
      if (isAtBottom) window.requestAnimationFrame(() => scrollToBottom('smooth'));
    },
    [isAtBottom, scrollToBottom]
  );

  const flushPendingText = useCallback(() => {
    const id = activeAssistantIdRef.current;
    if (!id || !pendingTextRef.current) return;
    visibleTextRef.current += pendingTextRef.current;
    pendingTextRef.current = '';
    updateAssistant(id, { content: visibleTextRef.current });
  }, [updateAssistant]);

  const stopCalmTimer = useCallback(() => {
    if (calmTimerRef.current !== null) {
      window.clearInterval(calmTimerRef.current);
      calmTimerRef.current = null;
    }
  }, []);

  const startCalmTimer = useCallback(() => {
    if (calmTimerRef.current !== null) return;
    calmTimerRef.current = window.setInterval(() => {
      const id = activeAssistantIdRef.current;
      if (!id || !pendingTextRef.current) {
        stopCalmTimer();
        return;
      }

      const pending = pendingTextRef.current;
      const chunkSize = Math.min(28, Math.max(8, Math.ceil(pending.length / 8)));
      let take = chunkSize;
      const punctuationIndex = pending.slice(0, chunkSize + 12).search(/[,.!?;:]\s/);
      if (punctuationIndex >= 8) take = punctuationIndex + 2;

      const chunk = pending.slice(0, take);
      pendingTextRef.current = pending.slice(take);
      visibleTextRef.current += chunk;
      updateAssistant(id, { content: visibleTextRef.current, isStreaming: true });
    }, 48);
  }, [stopCalmTimer, updateAssistant]);

  const enqueueCalmText = useCallback(
    (text: string) => {
      pendingTextRef.current += text;
      startCalmTimer();
    },
    [startCalmTimer]
  );

  useEffect(() => {
    return () => {
      stopCalmTimer();
      abortControllerRef.current?.abort();
    };
  }, [stopCalmTimer]);

  useEffect(() => {
    const element = composerRef.current;
    if (!element) return;

    const measure = () => setComposerHeight(Math.ceil(element.getBoundingClientRect().height));
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(Math.ceil(offset));
    };

    updateKeyboardOffset();
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
    };
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setIsAtBottom(distance < 112);
  }, []);

  const handleStreamEvent = useCallback(
    (event: StreamEventName, data: StreamPayload) => {
      const id = activeAssistantIdRef.current;
      if (!id) return;

      if (event === 'activity') {
        const activity: ChatActivity = {
          mode: data.mode ?? activeActivityRef.current?.mode ?? activityModeForChatMode(activeMode),
          phase: data.phase,
          label: data.label,
          title: data.title,
          subtitle: data.subtitle,
        };
        activeActivityRef.current = activity;
        updateAssistant(id, {
          activity,
          statusText: sanitizeVisibleText(data.statusText ?? (data.phase === 'responding' ? 'Responding…' : 'Thinking…')),
          isStreaming: true,
        });
        return;
      }

      if (event === 'response') {
        if (data.token) enqueueCalmText(sanitizeVisibleText(data.token));
        updateAssistant(id, { isStreaming: true });
        return;
      }

      if (event === 'artifact' && data.code) {
        const artifact: ChatArtifact = {
          id: data.id ?? nowId('artifact'),
          code: data.code,
          type: data.type ?? 'react',
          title: data.title ?? 'Generated code',
          language: data.language,
        };
        activeArtifactRef.current = artifact;
        onArtifactGenerated?.(artifact.id);
        updateAssistant(id, { artifacts: [artifact] });
        return;
      }

      if (event === 'complete') {
        flushPendingText();
        stopCalmTimer();
        const mode = activeActivityRef.current?.mode;
        const hasArtifact = Boolean(activeArtifactRef.current);
        updateAssistant(id, {
          activity: null,
          elapsedMs: data.elapsedMs,
          isStreaming: false,
          statusText: formatCompleteStatus(mode, data.elapsedMs, hasArtifact),
        });
        setIsLoading(false);
        window.requestAnimationFrame(() => scrollToBottom('smooth'));
        return;
      }

      if (event === 'error') {
        flushPendingText();
        stopCalmTimer();
        updateAssistant(id, {
          activity: null,
          error: true,
          isStreaming: false,
          statusText: 'The action failed.',
          content: sanitizeVisibleText(data.message ? `Error: ${data.message}` : 'Error: The request failed.'),
        });
        setIsLoading(false);
      }
    },
    [activeMode, enqueueCalmText, flushPendingText, onArtifactGenerated, scrollToBottom, stopCalmTimer, updateAssistant]
  );

  const sendMessage = useCallback(async () => {
    const messageText = inputValue.trim();
    if (!messageText || isLoading || !userId) return;

    const userMessage: ChatMessage = {
      id: nowId('user'),
      role: 'user',
      content: messageText,
    };
    const activity = defaultActivityForMode(activeMode);
    const assistantMessage: ChatMessage = {
      id: nowId('assistant'),
      role: 'assistant',
      content: '',
      statusText: 'Thinking…',
      isStreaming: true,
      activity,
    };

    activeAssistantIdRef.current = assistantMessage.id;
    activeActivityRef.current = activity;
    activeArtifactRef.current = null;
    visibleTextRef.current = '';
    pendingTextRef.current = '';
    stopCalmTimer();

    setInputValue('');
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setIsLoading(true);
    setIsAtBottom(true);
    window.requestAnimationFrame(() => scrollToBottom('smooth'));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/streams/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          mode: activeMode,
          projectId: projectId || null,
          userId,
          file: null,
        }),
        signal: controller.signal,
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
      const id = activeAssistantIdRef.current;
      const aborted = error instanceof Error && error.name === 'AbortError';
      flushPendingText();
      stopCalmTimer();
      if (id) {
        updateAssistant(id, {
          activity: null,
          error: !aborted,
          isStreaming: false,
          statusText: aborted ? 'Stopped.' : 'The action failed.',
          content: aborted
            ? visibleTextRef.current || 'Stopped.'
            : sanitizeVisibleText(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`),
        });
      }
      setIsLoading(false);
    }
  }, [activeMode, flushPendingText, handleStreamEvent, inputValue, isLoading, projectId, scrollToBottom, stopCalmTimer, updateAssistant, userId]);

  const stopResponse = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const onTextareaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const statusLabel = isLoading ? 'Assistant is responding' : 'Assistant is ready';

  return (
    <section
      className="streams-chat-surface-v3"
      aria-label="Streams chat"
      style={
        {
          '--streams-chat-bottom-space': `${composerHeight + 24}px`,
          '--streams-chat-keyboard-offset': `${keyboardOffset}px`,
          '--streams-chat-bg': CT.bg,
          '--streams-chat-surface': CT.sbBg,
          '--streams-chat-surface-2': CT.statusBg,
          '--streams-chat-text': CT.t1,
          '--streams-chat-text-2': CT.t2,
          '--streams-chat-text-3': CT.t3,
          '--streams-chat-text-4': CT.t4,
          '--streams-chat-accent': CT.send,
        } as React.CSSProperties
      }
    >
      <div className="streams-chat-status-v3" aria-live="polite">
        {statusLabel}
      </div>

      <div
        ref={scrollRef}
        className="streams-chat-scroll-v3"
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-busy={isLoading}
      >
        <div className="streams-chat-messages-v3">
          {messages.length === 0 ? (
            <div className="streams-chat-empty-v3">
              <div className="streams-chat-empty-label-v3">Conversation</div>
              <p>Start a request to generate images, video, voice, code, or a normal answer.</p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={message.role === 'user' ? 'streams-chat-message-v3 streams-chat-message-user-v3' : 'streams-chat-message-v3 streams-chat-message-assistant-v3'}
              >
                {message.statusText && message.role === 'assistant' && (
                  <div className="streams-chat-message-status-v3">{sanitizeVisibleText(message.statusText)}</div>
                )}

                {message.role === 'assistant' && shouldShowActivityCard(message.activity, message.isStreaming) && (
                  <div className="streams-chat-activity-v3">
                    <ActivityGenerationCard
                      mode={message.activity?.mode ?? 'tool'}
                      label={message.activity?.label}
                      title={message.activity?.title}
                      subtitle={message.activity?.subtitle}
                      compact={false}
                    />
                  </div>
                )}

                {message.content && <MarkdownMessage content={message.content} />}

                {message.artifacts?.map((artifact) => (
                  <details key={artifact.id} className="streams-chat-artifact-v3">
                    <summary>{sanitizeVisibleText(artifact.title ?? 'Generated code')}</summary>
                    <pre>
                      <code>{artifact.code}</code>
                    </pre>
                  </details>
                ))}
              </article>
            ))
          )}
          <div ref={bottomRef} aria-hidden="true" className="streams-chat-bottom-v3" />
        </div>
      </div>

      <form
        ref={composerRef}
        className="streams-chat-composer-v3"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <div className="streams-chat-modes-v3" role="group" aria-label="Message mode">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={activeMode === option.key ? 'streams-chat-mode-v3 is-active' : 'streams-chat-mode-v3'}
              aria-pressed={activeMode === option.key}
              onClick={() => setActiveMode(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="streams-chat-input-row-v3">
          <label className="streams-chat-input-label-v3" htmlFor="streams-chat-input-v3">
            Message
          </label>
          <textarea
            ref={textareaRef}
            id="streams-chat-input-v3"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={onTextareaKeyDown}
            maxLength={4000}
            rows={1}
            placeholder={activeMode === 'chat' ? 'Message Streams…' : `Describe what to ${activeMode}…`}
            aria-describedby="streams-chat-input-help-v3"
            disabled={isLoading}
          />
          <button
            type={isLoading ? 'button' : 'submit'}
            className="streams-chat-send-v3"
            onClick={isLoading ? stopResponse : undefined}
            disabled={!isLoading && !inputValue.trim()}
          >
            {isLoading ? 'Stop' : 'Send'}
          </button>
        </div>
        <div id="streams-chat-input-help-v3" className="streams-chat-help-v3">
          Press Enter to send. Press Shift Enter for a new line.
        </div>
      </form>
    </section>
  );
}

export default StreamsChatSurface;
