'use client';

import React from 'react';
import { C, DUR, EASE } from './tokens';

export type ActivityMode = 'conversation' | 'file' | 'image' | 'image-edit' | 'build' | 'code' | 'tool';

export interface ActivityGenerationCardProps {
  mode: ActivityMode;
  label?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

function getCopy(mode: ActivityMode): { label: string; title: string; subtitle: string } {
  switch (mode) {
    case 'image':
      return {
        label: 'IMAGE GENERATION',
        title: 'Generating your image',
        subtitle: 'No dead screen — your image is being created.',
      };
    case 'image-edit':
      return {
        label: 'IMAGE EDIT',
        title: 'Editing image to match your changes',
        subtitle: 'Applying the requested changes now.',
      };
    case 'build':
    case 'code':
      return {
        label: 'BUILDING',
        title: 'Building your code',
        subtitle: 'Preparing the implementation and output.',
      };
    case 'file':
      return {
        label: 'FILE',
        title: 'Reading your file',
        subtitle: 'Extracting and analyzing the uploaded content.',
      };
    case 'tool':
      return {
        label: 'WORKING',
        title: 'Running the requested action',
        subtitle: 'Keeping the session active while the result is prepared.',
      };
    case 'conversation':
    default:
      return {
        label: 'THINKING',
        title: 'Thinking',
        subtitle: 'Preparing a response.',
      };
  }
}

export function ActivityGenerationCard({
  mode,
  label,
  title,
  subtitle,
  compact = false,
}: ActivityGenerationCardProps) {
  const copy = getCopy(mode);
  const resolvedLabel = label ?? copy.label;
  const resolvedTitle = title ?? copy.title;
  const resolvedSubtitle = subtitle ?? copy.subtitle;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: compact ? 520 : 'min(1180px, calc(100vw - 360px))',
        minHeight: compact ? 132 : 218,
        borderRadius: compact ? 22 : 28,
        overflow: 'hidden',
        isolation: 'isolate',
        boxShadow: '0 18px 60px rgba(0,0,0,0.18)',
        transform: 'translateZ(0)',
        animation: `streamsActivityEnter ${DUR.slow} ${EASE} both`,
        background: C.bg3,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-32%',
          background:
            'conic-gradient(from 90deg, #00f5ff, #3bff00, #faff00, #ff6200, #ff006e, #8f00ff, #00f5ff)',
          filter: 'saturate(1.5)',
          animation: 'streamsActivitySpin 8s linear infinite',
          willChange: 'transform',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,.18) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          transform: 'perspective(500px) rotateX(55deg) scale(1.4)',
          transformOrigin: 'bottom',
          animation: 'streamsActivityGridMove 1.2s linear infinite',
          willChange: 'background-position',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(0,0,0,.34), rgba(0,0,0,.12), rgba(0,0,0,.34))',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          minHeight: compact ? 132 : 218,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: compact ? '22px 24px' : '28px 34px',
          color: '#fff',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 24,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(255,255,255,.15)',
            border: '1px solid rgba(255,255,255,.30)',
            color: 'rgba(255,255,255,.94)',
            fontSize: 11,
            lineHeight: '12px',
            fontWeight: 900,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            marginBottom: compact ? 10 : 12,
            textShadow: '0 2px 12px rgba(0,0,0,.35)',
          }}
        >
          {resolvedLabel}
        </div>
        <div
          style={{
            maxWidth: 680,
            fontSize: compact ? 30 : 44,
            fontWeight: 900,
            lineHeight: compact ? 1 : 0.95,
            letterSpacing: '-0.05em',
            textShadow: '0 2px 0 rgba(0,0,0,.2), 0 8px 20px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.4)',
          }}
        >
          {resolvedTitle}
        </div>
        {resolvedSubtitle && (
          <div
            style={{
              marginTop: 10,
              maxWidth: 620,
              fontSize: compact ? 14 : 16,
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'rgba(255,255,255,.9)',
              textShadow: '0 4px 20px rgba(0,0,0,.5)',
            }}
          >
            {resolvedSubtitle}
          </div>
        )}
      </div>
      <style>{`
        @keyframes streamsActivityEnter {
          from { opacity: 0; transform: translateY(4px) scale(.992); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes streamsActivitySpin {
          to { transform: rotate(360deg); }
        }
        @keyframes streamsActivityGridMove {
          to { background-position: 0 24px; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

export default ActivityGenerationCard;
