'use client';

/**
 * UnifiedChatPanel
 * Clean replacement for the three chat-runtime behaviors:
 * 1. ChatGPT-style thought/status row
 * 2. calm phrase-by-phrase response rendering
 * 3. bottom-aware auto-scroll + Future Grid activity card for generation/build work
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityGenerationCard, ActivityMode } from './ActivityGenerationCard';
import { useCalmStream } from './useCalmStream';
import { useSmartAutoScroll } from './useSmartAutoScroll';
import { C, CT } from './tokens';

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

const CHAT_MAX_WIDTH = 720;
const USER_BUBBLE_MAX_WIDTH = 520;
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

function shouldShowActivityCard(activity?: ChatActivity | null, isStreaming?: boolean): boolean {
  if (!activity || !isStreaming) return false;
  return ['image', 'image-edit', 'build', 'code', 'tool'].includes(activity.mode);
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
            style={{ color: '#0f5bff', textDecoration: 'underline', textUnderlineOffset: 2 }}
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
        fontSize: 15,
        lineHeight: 1.62,
        letterSpacing: '-0.003em',
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
                overflowX: 'auto',
                borderRadius: 10,
                background: '#0d1228',
                color: '#f0f2ff',
                fontSize: 13,
                lineHeight: 1.55,
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

function StreamsAvatar() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #7C3AED, #f97316)',
        color: '#fff',
        fontSize: 12,
        boxShadow: '0 6px 18px rgba(124,58,237,0.24)',
        flexShrink: 0,
      }}
    >
      ✦
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e9e7ff',
        color: '#6d5bd0',
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      ♟
    </div>
  );
}

export function UnifiedChatPanel({ projectId, userId, onArtifactGenerated }: UnifiedChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string } | null>(null);
  const [showActivityTimeline, setShowActivityTimeline] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantMsgIdRef = useRef<string | null>(null);
  const activeActivityRef = useRef<ChatActivity | null>(null);
  const activeArtifactRef = useRef<ChatArtifact | null>(null);

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
        const activity: ChatActivity = {
          mode,
          phase: data.phase,
          label: data.label,
          title: data.title,
          subtitle: data.subtitle,
        };
        activeActivityRef.current = activity;
        updateAssistantMessage(id, {
          activity,
          statusText: data.statusText ?? (data.phase === 'responding' ? 'Responding…' : 'Thinking…'),
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
        setTimeout(() => scrollToBottom({ force: true, behavior: 'smooth' }), 60);
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
    [calmStream, onArtifactGenerated, scrollToBottom, updateAssistantMessage, writeArtifactToIframe]
  );

  const handleSendMessage = useCallback(
    async (message: string, fileData?: { name: string; type: string; content: string }) => {
      if (!message.trim() || !userId || isLoading) return;

      const now = Date.now();
      const userMsg: ChatMessage = {
        id: `msg-${now}`,
        role: 'user',
        content: message.trim(),
      };
      const assistantMsg: ChatMessage = {
        id: `msg-${now}-assistant`,
        role: 'assistant',
        content: '',
        statusText: 'Thinking…',
        isStreaming: true,
        activity: { mode: fileData ? 'file' : 'conversation', phase: 'thinking' },
      };

      assistantMsgIdRef.current = assistantMsg.id;
      activeActivityRef.current = assistantMsg.activity ?? null;
      activeArtifactRef.current = null;
      calmStream.reset('');

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      setTimeout(() => scrollToBottom({ force: true, behavior: 'smooth' }), 40);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch('/api/streams/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            projectId: projectId || null,
            userId,
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
    [calmStream, handleStreamEvent, isLoading, projectId, scrollToBottom, updateAssistantMessage, userId]
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

  const renderMessage = (msg: ChatMessage) => {
    if (msg.role === 'user') {
      return (
        <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', margin: '0 0 28px' }}>
          <div style={{ maxWidth: USER_BUBBLE_MAX_WIDTH, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: CT.t3, fontSize: 12, lineHeight: '16px' }}>
              <span>You</span>
              <UserAvatar />
            </div>
            <div
              style={{
                background: '#f7f7f8',
                border: `1px solid ${CT.border}`,
                borderRadius: '18px 18px 4px 18px',
                padding: '13px 16px',
                color: CT.t1,
                fontSize: 15,
                lineHeight: 1.5,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', margin: '0 0 30px' }}>
        <div style={{ maxWidth: CHAT_MAX_WIDTH, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <StreamsAvatar />
            <span style={{ color: CT.t2, fontSize: 13, lineHeight: '18px', fontWeight: 500 }}>Streams</span>
          </div>
          <div style={{ paddingLeft: 30 }}>
            <AssistantStatusRow text={msg.statusText} active={msg.isStreaming && !msg.content} />
            {shouldShowActivityCard(msg.activity, msg.isStreaming) && (
              <div style={{ margin: msg.content ? '12px 0 16px' : '4px 0 16px' }}>
                <ActivityGenerationCard
                  mode={msg.activity?.mode ?? 'tool'}
                  label={msg.activity?.label}
                  title={msg.activity?.title}
                  subtitle={msg.activity?.subtitle}
                  compact={isMobile}
                />
              </div>
            )}
            <MarkdownMessage content={msg.content} />
          </div>
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
          {isLoading && (
            <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.bdr}` }}>
              <button
                onClick={() => setShowActivityTimeline(!showActivityTimeline)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  color: C.t3,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'left',
                  lineHeight: 1.4,
                }}
              >
                {showActivityTimeline ? '▼' : '▶'} Work steps
              </button>
              {showActivityTimeline && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.t3, paddingLeft: 8, borderLeft: `2px solid ${C.acc}` }}>
                  <div style={{ margin: '4px 0' }}>✓ Thinking</div>
                  <div style={{ margin: '4px 0' }}>✓ Streaming response</div>
                  <div style={{ margin: '4px 0', opacity: 0.72 }}>⏳ Preparing artifact</div>
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <ActivityGenerationCard mode="build" compact label="BUILDING" title="Building your code" subtitle="Preparing the implementation and output." />
          )}

          <div style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center' }}>
            <button
              onClick={() => console.log('Regenerate clicked')}
              style={{
                flex: 1,
                padding: '9px 12px',
                backgroundColor: C.acc,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              ↻ Regenerate
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(latestArtifact.code)}
              style={{
                padding: '9px 12px',
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
              borderRadius: 10,
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
              fontSize: 11,
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
        maxWidth: CHAT_MAX_WIDTH,
        margin: '0 auto',
        padding: isMobile ? '8px 12px calc(12px + env(safe-area-inset-bottom))' : '10px 0 14px',
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, paddingLeft: isMobile ? 0 : 0 }}>
        {[
          ['Chat', '#3b82f6'],
          ['Image', '#7C3AED'],
          ['Video', '#ef4444'],
          ['Build', '#10b981'],
        ].map(([label, color]) => (
          <span
            key={label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 28,
              padding: '0 13px',
              borderRadius: 999,
              background: color,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              lineHeight: '28px',
              boxShadow: '0 8px 18px rgba(0,0,0,0.10)',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {uploadedFile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            padding: '8px 10px',
            backgroundColor: '#f7f7f8',
            border: `1px solid ${CT.border}`,
            borderRadius: 10,
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
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          minHeight: 58,
          padding: '9px 10px',
          background: '#ffffff',
          border: `1px solid ${CT.inputBorder}`,
          borderRadius: 18,
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
            padding: '9px 2px',
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            color: CT.t1,
            fontSize: 15,
            fontFamily: 'inherit',
            lineHeight: 1.45,
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
            background: isLoading || !inputValue.trim() ? '#d4d4d8' : '#f97316',
            color: '#fff',
            cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
            fontSize: 18,
            fontWeight: 700,
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
                padding: '54px 32px 34px',
              }}
            >
              <div style={{ maxWidth: CHAT_MAX_WIDTH, margin: '0 auto' }}>{messages.map(renderMessage)}</div>
              <div ref={bottomRef} aria-hidden="true" style={{ height: 1 }} />
            </div>
            <div style={{ borderTop: `1px solid ${CT.border}`, background: CT.bg }}>{composer}</div>
          </div>
          {latestArtifact && <div style={{ padding: '14px 14px 14px 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>{artifactPanel}</div>}
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
            <div style={{ maxWidth: CHAT_MAX_WIDTH, margin: '0 auto' }}>{messages.map(renderMessage)}</div>
            {latestArtifact && <div style={{ margin: '14px 0' }}>{artifactPanel}</div>}
            <div ref={bottomRef} aria-hidden="true" style={{ height: 1 }} />
          </div>
          <div style={{ borderTop: `1px solid ${CT.border}`, background: CT.bg }}>{composer}</div>
        </div>
      )}
    </div>
  );
}

export default UnifiedChatPanel;
