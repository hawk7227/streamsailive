'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityTimeline, ActivityStep } from './ActivityTimeline';
import { SplitPanelChat, ChatMessage } from './SplitPanelChat';
import { C } from '../tokens';

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

  // Detect mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Simulate activity steps
  const simulateActivityPhase = useCallback(() => {
    setIsActivityPhase(true);
    setIsLoading(true);

    const steps: ActivityStep[] = [
      { id: 'load-context', label: 'Load project context', status: 'pending' },
      { id: 'resolve-keys', label: 'Resolve API keys', status: 'pending' },
      { id: 'generate-code', label: 'Generate component code', status: 'pending' },
      { id: 'register-artifact', label: 'Register artifact', status: 'pending' },
    ];

    setActivitySteps(steps);

    let stepIndex = 0;
    const interval = setInterval(() => {
      setActivitySteps((prev: ActivityStep[]) => {
        const updated = [...prev];
        if (stepIndex > 0) {
          updated[stepIndex - 1].status = 'complete';
        }
        if (stepIndex < updated.length) {
          updated[stepIndex].status = 'in-progress';
        }
        return updated;
      });

      stepIndex += 1;
      if (stepIndex > steps.length) {
        clearInterval(interval);
        setIsActivityPhase(false);
        setIsLoading(false);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Handle sending message
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
      };
      setMessages((prev: ChatMessage[]) => [...prev, userMsg]);

      simulateActivityPhase();

      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content:
            'I\'ve created a React component with the following features:\n- Interactive preview\n- Real-time updates\n- Responsive design\n- Fully customizable',
          artifacts: [
            {
              id: `artifact-${Date.now()}`,
              code: `
export function Counter() {
  const [count, setCount] = React.useState(0);
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      padding: '24px',
      fontFamily: 'system-ui'
    }}>
      <h1 style={{ margin: 0, fontSize: '24px' }}>Count: {count}</h1>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setCount(c => c + 1)}
          style={{
            padding: '8px 16px',
            backgroundColor: C.green,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          +
        </button>
        <button
          onClick={() => setCount(c => c - 1)}
          style={{
            padding: '8px 16px',
            backgroundColor: C.red,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          −
        </button>
      </div>
      <p style={{ fontSize: '12px', color: C.t4 }}>
        Click the buttons to change the count
      </p>
    </div>
  );
}
            `.trim(),
              type: 'react' as const,
              asyncContent: {
                type: 'image' as const,
                url: 'https://images.unsplash.com/photo-1633356122544-f134324ef6db?w=400&h=300',
                status: 'loading' as const,
                progress: 0,
              },
            },
          ],
          isStreaming: false,
        };

        setMessages((prev: ChatMessage[]) => [...prev, assistantMsg]);
        onArtifactGenerated?.(assistantMsg.artifacts?.[0].id || '');
      }, 2000);
    },
    [simulateActivityPhase, onArtifactGenerated]
  );

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
