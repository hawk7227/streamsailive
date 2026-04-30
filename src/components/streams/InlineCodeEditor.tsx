'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { C } from './tokens';

// Dynamically import Monaco Editor (large bundle)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '400px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.bg3,
      color: C.t3,
      fontSize: '12px',
    }}>
      Loading editor...
    </div>
  ),
});

interface InlineCodeEditorProps {
  code: string;
  language?: 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'html' | 'css' | 'json' | 'python';
  onSave?: (code: string) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export function InlineCodeEditor({
  code,
  language = 'javascript',
  onSave,
  onCancel,
  readOnly = false,
}: InlineCodeEditorProps) {
  const [editedCode, setEditedCode] = useState(code);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditedCode(value);
      setHasChanges(value !== code);
    }
  };

  const handleSave = () => {
    if (hasChanges && onSave) {
      onSave(editedCode);
      setHasChanges(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: `1px solid ${C.t4}`,
      }}
    >
      {/* Editor */}
      <div style={{ height: '400px', width: '100%' }}>
        <MonacoEditor
          value={editedCode}
          onChange={handleChange}
          language={language}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'IBM Plex Mono', monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            readOnly: readOnly,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>

      {/* Controls */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: C.bg2,
            borderTop: `1px solid ${C.t4}`,
          }}
        >
          {hasChanges && (
            <span style={{ fontSize: '12px', color: C.t3, flex: 1 }}>
              ● Unsaved changes
            </span>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: '8px 12px',
                backgroundColor: C.bg3,
                border: `1px solid ${C.t4}`,
                borderRadius: '4px',
                color: C.t2,
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: 1.4,
              }}
            >
              Cancel
            </button>
          )}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              style={{
                padding: '8px 12px',
                backgroundColor: hasChanges ? C.acc : C.t4,
                border: 'none',
                borderRadius: '4px',
                color: C.bg,
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontWeight: 500,
                lineHeight: 1.4,
                opacity: hasChanges ? 1 : 0.5,
              }}
            >
              Save Changes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default InlineCodeEditor;
