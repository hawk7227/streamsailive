'use client';

import { C } from './tokens';

export function PreviewPanel({ 
  artifactId, 
  code, 
  type 
}: { 
  artifactId?: string;
  code?: string;
  type?: 'react' | 'html' | 'svg';
}) {
  if (!code) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeft: `1px solid ${C.bdr}`,
        backgroundColor: C.bg2,
        color: C.t4,
        fontSize: 13,
        minWidth: 300,
      }}>
        Generated preview appears here
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: `1px solid ${C.bdr}`,
      backgroundColor: '#fff',
      minWidth: 300,
    }}>
      <div style={{
        padding: 12,
        borderBottom: `1px solid ${C.bdr}`,
        fontSize: 12,
        fontWeight: 600,
        color: C.t2,
      }}>
        Preview
      </div>
      <iframe
        style={{
          flex: 1,
          border: 'none',
          backgroundColor: '#fff',
        }}
        title="artifact-preview"
        srcDoc={code}
      />
    </div>
  );
}
