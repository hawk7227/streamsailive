'use client';

import React, { useEffect, useState } from 'react';
import { C } from '../tokens';

export interface ActivityStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  timestamp?: number;
}

export interface ActivityTimelineProps {
  steps: ActivityStep[];
  isActive?: boolean;
  onComplete?: () => void;
}

export function ActivityTimeline({
  steps,
  isActive = true,
  onComplete,
}: ActivityTimelineProps) {
  const [displaySteps, setDisplaySteps] = useState<ActivityStep[]>(steps);
  const [fadeOut, setFadeOut] = useState(false);

  // Auto-fade out after all steps complete
  useEffect(() => {
    const allComplete = displaySteps.every(
      (s: ActivityStep) => s.status === 'complete' || s.status === 'error'
    );

    if (allComplete && isActive) {
      const timer = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          onComplete?.();
        }, 300);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [displaySteps, isActive, onComplete]);

  // Update display steps when props change
  useEffect(() => {
    setDisplaySteps(steps);
  }, [steps]);

  if (!isActive && fadeOut) {
    return null;
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  return (
    <div
      style={{
        position: 'relative',
        padding: isDesktop ? '24px' : '16px',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: C.bg2,
        border: `1px solid ${C.t4}`,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 300ms ease-out',
      }}
    >
      {/* ANIMATED FUTURE GRID BACKGROUND */}
      <FutureGridBackground />

      {/* CONTENT */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ marginBottom: '16px' }}>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              color: C.t1,
              lineHeight: 1.4,
            }}
          >
            Building your artifact
          </p>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: C.t4,
              lineHeight: 1.4,
            }}
          >
            Real-time progress
          </p>
        </div>

        {/* STEPS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displaySteps.map((step: ActivityStep) => (
            <ActivityStepItem key={step.id} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ActivityStepItemProps {
  step: ActivityStep;
}

const ActivityStepItem: React.FC<ActivityStepItemProps> = ({ step }: ActivityStepItemProps) => {
  const getIcon = () => {
    switch (step.status) {
      case 'complete':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: 'white',
              fontSize: '12px',
              fontWeight: 500,
              flexShrink: 0,
              lineHeight: 1.4,
            }}
          >
            ✓
          </div>
        );
      case 'error':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '12px',
              fontWeight: 500,
              flexShrink: 0,
              lineHeight: 1.4,
            }}
          >
            ✕
          </div>
        );
      case 'in-progress':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: C.acc,
              color: C.bg,
              fontSize: '14px',
              fontWeight: 500,
              flexShrink: 0,
              animation: 'pulse 1.5s ease-in-out infinite',
              lineHeight: 1.4,
            }}
          >
            →
          </div>
        );
      case 'pending':
      default:
        return (
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: `2px solid ${C.t4}`,
              flexShrink: 0,
            }}
          />
        );
    }
  };

  const getStatusText = () => {
    switch (step.status) {
      case 'complete':
        return 'Done';
      case 'error':
        return 'Error';
      case 'in-progress':
        return 'Working...';
      case 'pending':
      default:
        return 'Waiting...';
    }
  };

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      {getIcon()}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: C.t2,
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {step.label}
        </p>
        <p
          style={{
            margin: '2px 0 0 0',
            fontSize: '11px',
            color: C.t4,
            lineHeight: 1.4,
          }}
        >
          {getStatusText()}
        </p>
      </div>

      {step.timestamp && (
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            color: C.t4,
            flexShrink: 0,
            lineHeight: 1.4,
          }}
        >
          {step.timestamp}ms
        </p>
      )}
    </div>
  );
};

function FutureGridBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: 0.15,
      }}
    >
      {/* Animated conic gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `conic-gradient(
            from 0deg,
            rgb(139, 92, 246),
            rgb(59, 130, 246),
            rgb(34, 197, 94),
            rgb(34, 197, 94),
            rgb(59, 130, 246),
            rgb(139, 92, 246)
          )`,
          animation: 'rotateGradient 8s linear infinite',
        }}
      />

      {/* Grid overlay */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.4,
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {[0, 20, 40, 60, 80, 100].map((y) => (
          <line
            key={`h-${y}`}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.5"
          />
        ))}

        {[0, 20, 40, 60, 80, 100].map((x) => (
          <line
            key={`v-${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="100"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.5"
          />
        ))}

        <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      </svg>

      <style>{`
        @keyframes rotateGradient {
          from {
            filter: hue-rotate(0deg);
          }
          to {
            filter: hue-rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}

export default ActivityTimeline;
