'use client';

import React, { useState } from 'react';
import { C } from './tokens';

interface ResponsiveTabsProps {
  isMobile: boolean;
  chatPanel: React.ReactNode;
  artifactPanel: React.ReactNode;
}

export function ResponsiveTabs({ isMobile, chatPanel, artifactPanel }: ResponsiveTabsProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'preview'>('chat');

  // Desktop: side-by-side layout
  if (!isMobile) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '65% 35%',
          gap: '20px',
          height: '100%',
          padding: '12px',
          backgroundColor: C.bg,
          overflow: 'hidden',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {chatPanel}
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {artifactPanel}
        </div>
      </div>
    );
  }

  // Mobile: tabbed interface
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '8px',
        backgroundColor: C.bg,
        gap: '8px',
      }}
    >
      {/* Tab buttons */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: `1px solid ${C.bdr}`,
        }}
      >
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            flex: 1,
            padding: '12px 8px',
            backgroundColor: activeTab === 'chat' ? C.acc : 'transparent',
            color: activeTab === 'chat' ? C.bg : C.t2,
            border: 'none',
            borderBottom: activeTab === 'chat' ? `2px solid ${C.acc}` : 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'chat' ? 500 : 400,
            borderRadius: 0,
            lineHeight: 1.4,
            transition: `all 150ms ease`,
          }}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          style={{
            flex: 1,
            padding: '12px 8px',
            backgroundColor: activeTab === 'preview' ? C.acc : 'transparent',
            color: activeTab === 'preview' ? C.bg : C.t2,
            border: 'none',
            borderBottom: activeTab === 'preview' ? `2px solid ${C.acc}` : 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'preview' ? 500 : 400,
            borderRadius: 0,
            lineHeight: 1.4,
            transition: `all 150ms ease`,
          }}
        >
          Preview
        </button>
      </div>

      {/* Tab content */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {activeTab === 'chat' && (
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {chatPanel}
          </div>
        )}
        {activeTab === 'preview' && (
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {artifactPanel}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResponsiveTabs;
