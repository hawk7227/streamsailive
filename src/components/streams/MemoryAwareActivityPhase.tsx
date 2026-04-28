/**
 * MemoryAwareActivityPhase.tsx — Phase 10
 * 
 * Enhanced activity timeline showing what project context is being loaded
 * Displays: recent artifacts, active tasks, project knowledge, generation history
 * 
 * Shows in activity phase:
 * ✓ Load recent artifacts
 * ✓ Load active tasks
 * ✓ Load project knowledge
 * ✓ Analyze message context
 * ✓ Generate response
 * ✓ Prepare artifacts
 */

'use client';

import React from 'react';
import { C } from './tokens';
import { getMemorySummary, ProjectMemory } from '@/hooks/useProjectMemory';

export interface MemoryAwareActivityStep {
  id: string;
  label: string;
  sublabel?: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
}

export interface MemoryAwareActivityPhaseProps {
  projectMemory: ProjectMemory | null;
  isMemoryLoading: boolean;
  steps: MemoryAwareActivityStep[];
  isVisible: boolean;
}

export function MemoryAwareActivityPhase({
  projectMemory,
  isMemoryLoading,
  steps,
  isVisible,
}: MemoryAwareActivityPhaseProps) {
  if (!isVisible) return null;

  const summary = getMemorySummary(projectMemory);
  const hasContext =
    summary.artifactCount > 0 ||
    summary.taskCount > 0 ||
    summary.factCount > 0 ||
    summary.historyCount > 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: C.bg2,
          borderRadius: 12,
          padding: '32px',
          maxWidth: 400,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Animated background */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(45deg, transparent 30%, rgba(124,58,237,0.03) 50%, transparent 70%)',
            backgroundSize: '200% 200%',
            animation: 'futureGridShift 4s infinite',
            borderRadius: 12,
            pointerEvents: 'none',
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: C.t1,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: C.acc,
                animation: 'pulse 1.5s infinite',
              }}
            />
            Analyzing Your Project
          </div>

          {/* Memory context summary */}
          {hasContext && (
            <div
              style={{
                marginBottom: 20,
                padding: 12,
                background: 'rgba(16,185,129,0.08)',
                borderLeft: `3px solid #10b981`,
                borderRadius: 4,
                fontSize: 12,
                color: C.t2,
              }}
            >
              <div style={{ fontWeight: 500, color: C.t1, marginBottom: 6 }}>
                Loading Project Context
              </div>
              <div style={{ lineHeight: 1.6 }}>
                {summary.artifactCount > 0 && (
                  <div>• {summary.artifactCount} recent artifacts</div>
                )}
                {summary.taskCount > 0 && (
                  <div>• {summary.taskCount} active tasks</div>
                )}
                {summary.factCount > 0 && (
                  <div>• {summary.factCount} project facts</div>
                )}
                {summary.historyCount > 0 && (
                  <div>• {summary.historyCount} generation history items</div>
                )}
              </div>
            </div>
          )}

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((step) => (
              <div key={step.id} style={{ display: 'flex', gap: 12 }}>
                {/* Status indicator */}
                <div
                  style={{
                    minWidth: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    background:
                      step.status === 'complete'
                        ? '#10b981'
                        : step.status === 'error'
                          ? '#ef4444'
                          : step.status === 'in-progress'
                            ? C.acc
                            : C.bg3,
                  }}
                >
                  {step.status === 'complete' ? '✓' : step.status === 'error' ? '✕' : step.status === 'in-progress' ? '●' : '○'}
                </div>

                {/* Label */}
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: C.t1,
                    }}
                  >
                    {step.label}
                  </div>
                  {step.sublabel && (
                    <div
                      style={{
                        fontSize: 11,
                        color: C.t3,
                        marginTop: 2,
                      }}
                    >
                      {step.sublabel}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Loading indicator */}
          {isMemoryLoading && (
            <div
              style={{
                marginTop: 20,
                paddingTop: 20,
                borderTop: `1px solid ${C.bdr}`,
                fontSize: 12,
                color: C.t3,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: C.acc,
                  animation: 'bounce 1s infinite',
                }}
              />
              <span>Loading context...</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes futureGridShift {
          0% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
      `}</style>
    </div>
  );
}

/**
 * Convert ProjectMemory to activity steps for display
 */
export function memoryToActivitySteps(memory: ProjectMemory | null): MemoryAwareActivityStep[] {
  const steps: MemoryAwareActivityStep[] = [];

  if (memory?.recentArtifacts && memory.recentArtifacts.length > 0) {
    steps.push({
      id: 'artifacts',
      label: 'Load recent artifacts',
      sublabel: `${memory.recentArtifacts.length} items`,
      status: 'complete',
    });
  }

  if (memory?.activeTasks && memory.activeTasks.length > 0) {
    steps.push({
      id: 'tasks',
      label: 'Load active tasks',
      sublabel: `${memory.activeTasks.length} tasks`,
      status: 'complete',
    });
  }

  if (memory?.memoryFacts && memory.memoryFacts.length > 0) {
    steps.push({
      id: 'knowledge',
      label: 'Load project knowledge',
      sublabel: `${memory.memoryFacts.length} facts`,
      status: 'complete',
    });
  }

  if (memory?.generationHistory && memory.generationHistory.length > 0) {
    steps.push({
      id: 'history',
      label: 'Analyze generation history',
      sublabel: `${memory.generationHistory.length} items`,
      status: 'complete',
    });
  }

  // Always show these
  steps.push({
    id: 'analyze',
    label: 'Analyze message context',
    status: 'in-progress',
  });

  steps.push({
    id: 'generate',
    label: 'Generate response',
    status: 'pending',
  });

  steps.push({
    id: 'artifacts',
    label: 'Prepare artifacts',
    status: 'pending',
  });

  return steps;
}
