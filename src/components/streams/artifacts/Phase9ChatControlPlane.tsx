'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityTimeline, ActivityStep } from './ActivityTimeline';
import { SplitPanelChat, ChatMessage } from './SplitPanelChat';
import { C } from '../tokens';

interface Artifact {
  id: string;
  code: string;
  type: 'react' | 'html' | 'svg';
  asyncContent?: {
    type: 'image' | 'video' | 'none';
    url?: string;
    progress?: number;
    status: 'idle' | 'loading' | 'complete' | 'error';
  };
}
export interface Phase9ChatControlPlaneProps {
  projectId?: string;
  userId?: string;
  onArtifactGenerated?: (artifactId: string) => void;
}

export function Phase9ChatControlPlane({
  projectId,
  userId,
  onArtifactGenerated,
}: Phase9ChatControlPlaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivityPhase, setIsActivityPhase] = useState(false);
  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect mobile (no layout shift at 768px)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Real API call with SSE streaming
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !userId) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
      };
      setMessages((prev: ChatMessage[]) => [...prev, userMsg]);

      setIsLoading(true);
      setIsActivityPhase(true);
      setActivitySteps([
        { id: 'load-context', label: 'Load project context', status: 'in-progress' },
        { id: 'analyze', label: 'Analyze message', status: 'pending' },
        { id: 'generate', label: 'Generate response', status: 'pending' },
        { id: 'artifacts', label: 'Prepare artifacts', status: 'pending' },
      ]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Call /api/streams/chat with SSE
        const response = await fetch('/api/streams/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            projectId: projectId || null,
            userId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseBuffer = '';
        let currentArtifact: Artifact | null = null;
        let assistantContent = '';

        // Read SSE stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          responseBuffer += decoder.decode(value, { stream: true });
          const lines = responseBuffer.split('\n');
          responseBuffer = lines[lines.length - 1];

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('event:')) {
              const eventType = line.replace('event:', '').trim();
              const dataLine = lines[++i]?.trim();
              if (!dataLine || !dataLine.startsWith('data:')) continue;

              const jsonStr = dataLine.replace('data:', '').trim();
              let data: unknown;
              try {
                data = JSON.parse(jsonStr);
              } catch {
                continue;
              }

              // Handle activity updates
              if (eventType === 'activity' && typeof data === 'object' && data !== null && 'steps' in data) {
                const actData = data as { steps?: ActivityStep[] };
                setActivitySteps(actData.steps || []);
              }

              // Handle response text streaming
              else if (eventType === 'response' && typeof data === 'object' && data !== null && 'partial' in data) {
                const respData = data as { partial: string };
                assistantContent = respData.partial;
                // Update or create assistant message with streamed text
                setMessages((prev: ChatMessage[]) => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMsg, content: assistantContent },
                    ];
                  } else {
                    return [
                      ...prev,
                      {
                        id: `msg-${Date.now()}`,
                        role: 'assistant',
                        content: assistantContent,
                      },
                    ];
                  }
                });
              }

              // Handle artifacts (code ready immediately)
              else if (eventType === 'artifact' && typeof data === 'object' && data !== null && 'code' in data) {
                const artData = data as { id: string; code: string; type: string };
                currentArtifact = {
                  id: artData.id,
                  code: artData.code,
                  type: (artData.type || 'react') as 'react' | 'html' | 'svg',
                };
                // Inject artifact into last message
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...lastMsg,
                      artifacts: [...(lastMsg.artifacts || []), currentArtifact!],
                    };
                  }
                  return updated;
                });
                if (onArtifactGenerated) {
                  onArtifactGenerated(artData.id);
                }
              }

              // Handle completion
              else if (eventType === 'complete') {
                setIsActivityPhase(false);
                setIsLoading(false);
              }

              // Handle errors
              else if (eventType === 'error' && typeof data === 'object' && data !== null && 'message' in data) {
                const errData = data as { message: string };
                console.error('Chat API error:', errData);
                setIsActivityPhase(false);
                setIsLoading(false);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Chat error:', error);
          setMessages((prev: ChatMessage[]) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: `Error: ${error.message}`,
            },
          ]);
        }
        setIsActivityPhase(false);
        setIsLoading(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [userId, projectId, onArtifactGenerated]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        backgroundColor: C.bg,
      }}
    >
      {/* ACTIVITY PHASE OVERLAY (0-2000ms) */}
      {isActivityPhase && (
        <ActivityPhaseOverlay
          steps={activitySteps}
          onComplete={() => {
            setIsActivityPhase(false);
            setIsLoading(false);
          }}
        />
      )}

      {/* MAIN CHAT INTERFACE */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SplitPanelChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading && !isActivityPhase}
        />
      </div>
    </div>
  );
}

/**
 * ACTIVITY PHASE OVERLAY
 * Shows during initial artifact generation (0-2000ms)
 * Covers full screen with activity timeline
 */
interface ActivityPhaseOverlayProps {
  steps: ActivityStep[];
  onComplete: () => void;
}

function ActivityPhaseOverlay({
  steps,
  onComplete,
}: ActivityPhaseOverlayProps) {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: isDesktop ? '500px' : '90%',
          maxHeight: '80vh',
          backgroundColor: C.bg,
          borderRadius: '12px',
          border: `1px solid ${C.t4}`,
          overflow: 'auto',
        }}
      >
        <ActivityTimeline steps={steps} isActive={true} onComplete={onComplete} />
      </div>
    </div>
  );
}

export default Phase9ChatControlPlane;
