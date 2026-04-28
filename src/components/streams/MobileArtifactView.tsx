'use client';

import React, { useState } from 'react';
import { C } from './tokens';

interface MobileArtifactViewProps {
  code: string;
  type: 'react' | 'html' | 'svg';
  onEdit?: () => void;
}

export function MobileArtifactView({ code, type, onEdit }: MobileArtifactViewProps) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        backgroundColor: C.bg2,
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: `1px solid ${C.t4}`,
        }}
      >
        <button
          onClick={() => setShowCode(false)}
          style={{
            padding: '8px 12px',
            backgroundColor: !showCode ? C.acc : 'transparent',
            color: !showCode ? C.bg : C.t2,
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: '4px 4px 0 0',
            lineHeight: 1.4,
          }}
        >
          Preview
        </button>
        <button
          onClick={() => setShowCode(true)}
          style={{
            padding: '8px 12px',
            backgroundColor: showCode ? C.acc : 'transparent',
            color: showCode ? C.bg : C.t2,
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: '4px 4px 0 0',
            lineHeight: 1.4,
          }}
        >
          Code
        </button>
      </div>

      {/* Content */}
      {!showCode && (
        <div
          style={{
            height: '300px',
            backgroundColor: C.bg3,
            borderRadius: '8px',
            overflow: 'hidden',
            border: `1px solid ${C.t4}`,
          }}
        >
          <p
            style={{
              margin: '20px',
              color: C.t3,
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            Mobile preview disabled. View code or open in full screen.
          </p>
        </div>
      )}

      {showCode && (
        <div
          style={{
            backgroundColor: C.bg3,
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '300px',
            overflow: 'auto',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: C.t2,
            lineHeight: 1.3,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {code.substring(0, 500)}
          {code.length > 500 && '...'}
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              minWidth: '100px',
              padding: '8px 12px',
              backgroundColor: C.acc,
              color: C.bg,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            Edit
          </button>
        )}
        <button
          onClick={() => window.open('', '_blank')}
          style={{
            flex: 1,
            minWidth: '100px',
            padding: '8px 12px',
            backgroundColor: C.bg3,
            color: C.t1,
            border: `1px solid ${C.t4}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            lineHeight: 1.4,
          }}
        >
          Full Screen
        </button>
      </div>
    </div>
  );
}

export default MobileArtifactView;
