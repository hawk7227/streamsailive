'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { C } from '../tokens';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts?: {
    id: string;
    code: string;
    type: 'react' | 'html' | 'svg';
    asyncContent?: {
      type: 'image' | 'video' | 'none';
      url?: string;
      progress?: number;
      status: 'idle' | 'loading' | 'complete' | 'error';
    };
  }[];
  isStreaming?: boolean;
}

export interface SplitPanelChatProps {
  messages: ChatMessage[];
  onSendMessage?: (message: string) => void;
  isLoading?: boolean;
}

export function SplitPanelChat({
  messages,
  onSendMessage,
  isLoading = false,
}: SplitPanelChatProps) {
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{name: string, type: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect if we're on mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Scroll detection logic
  const checkIsAtBottom = useCallback(() => {
    if (!chatPanelRef.current) return true;
    const threshold = 100;
    return (
      chatPanelRef.current.scrollHeight - chatPanelRef.current.scrollTop <=
      chatPanelRef.current.clientHeight + threshold
    );
  }, []);

  // Auto-scroll when at bottom and new content arrives
  useEffect(() => {
    if (isAtBottom && chatPanelRef.current) {
      requestAnimationFrame(() => {
        chatPanelRef.current?.scrollTo({
          top: chatPanelRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, [messages, isAtBottom]);

  // Handle user scroll
  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom();
    setIsAtBottom(atBottom);
    setShowJumpButton(!atBottom);
  }, [checkIsAtBottom]);

  // Jump to latest
  const handleJumpToLatest = useCallback(() => {
    if (chatPanelRef.current) {
      chatPanelRef.current.scrollTo({
        top: chatPanelRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setIsAtBottom(true);
      setShowJumpButton(false);
    }
  }, []);

  // Get latest artifact for right panel
  const latestArtifact = messages
    .filter((m: ChatMessage) => m.artifacts && m.artifacts.length > 0)
    .reverse()[0]?.artifacts?.[0];

  // FIXED: Mobile is now 100% full-width (not broken 60/40)
  // Desktop remains 65/35 split
  const chatWidth = isMobile ? '100%' : '65%';
  const previewWidth = isMobile ? '100%' : '35%';
  const gap = isMobile ? '0px' : '20px';
  const isShowingMobileArtifact = isMobile && latestArtifact;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        gap,
        padding: isMobile ? '8px' : '12px',
        backgroundColor: C.bg,
        overflow: 'hidden',
      }}
    >
      {/* LEFT PANEL: Chat (65% desktop, 60% mobile) */}
      <div
        style={{
          flex: `0 0 ${chatWidth}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: 0,
        }}
      >
        {/* Messages area with auto-scroll */}
        <div
          ref={chatPanelRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingRight: '4px',
            scrollBehavior: 'smooth',
          }}
        >
          {messages.map((msg: ChatMessage) => (
            <div key={msg.id}>
              {/* User message: right-aligned, no background */}
              {msg.role === 'user' && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: '8px',
                  }}
                >
                  <p
                    style={{
                      maxWidth: '85%',
                      color: C.t1,
                      fontSize: '14px',
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    {msg.content}
                  </p>
                </div>
              )}

              {/* Assistant message: left-aligned, with code block */}
              {msg.role === 'assistant' && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '95%',
                    }}
                  >
                    {/* Text content */}
                    <p
                      style={{
                        color: C.t1,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        wordBreak: 'break-word',
                        margin: '0 0 12px 0',
                      }}
                    >
                      {msg.content}
                    </p>

                    {/* Code block if present */}
                    {msg.artifacts && msg.artifacts.length > 0 && (
                      <CodeBlockPreview
                        artifacts={msg.artifacts}
                        isMobile={isMobile}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading state */}
          {isLoading && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: `2px solid ${C.acc}`,
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p
                style={{
                  color: C.t4,
                  fontSize: '12px',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                Claude is responding...
              </p>
            </div>
          )}
        </div>

        {/* Jump to Latest button */}
        {showJumpButton && (
          <button
            onClick={handleJumpToLatest}
            style={{
              padding: '8px 12px',
              backgroundColor: C.acc,
              color: C.bg,
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500,
              lineHeight: 1.4,
              alignSelf: 'center',
              animation: 'slideUp 300ms ease-out',
            }}
          >
            ↓ Jump to Latest
          </button>
        )}

        {/* Input bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px',
            backgroundColor: C.bg2,
            borderRadius: '8px',
            borderTop: `1px solid ${C.t4}`,
            flexDirection: 'column',
          }}
        >
          {/* File upload indicator */}
          {uploadedFile && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                backgroundColor: C.bg3,
                borderRadius: '6px',
                fontSize: '12px',
                color: C.t2,
              }}
            >
              <span>📎</span>
              <span>{uploadedFile.name}</span>
              <button
                onClick={() => setUploadedFile(null)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: C.t3,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 12px',
                backgroundColor: C.bg3,
                border: `1px solid ${C.t4}`,
                borderRadius: '6px',
                color: C.t2,
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: 1.4,
              }}
              title="Upload document (PDF, CSV, XLSX, DOCX, TXT)"
            >
              📁
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.xlsx,.docx,.txt,.doc"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setUploadedFile({
                    name: file.name,
                    type: file.type,
                  });
                }
              }}
              style={{ display: 'none' }}
            />

            {/* Textarea */}
            <textarea
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage?.(inputValue);
                  setInputValue('');
                }
              }}
              placeholder="Ask Claude to build something..."
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: C.bg3,
                border: `1px solid ${C.t4}`,
                borderRadius: '6px',
                color: C.t1,
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'none',
                minHeight: '40px',
                maxHeight: '100px',
                lineHeight: 1.4,
              }}
            />

            {/* Send button */}
            <button
              onClick={() => {
                onSendMessage?.(inputValue);
                setInputValue('');
              }}
              disabled={isLoading || !inputValue.trim()}
              style={{
                padding: '8px 12px',
                backgroundColor: isLoading || !inputValue.trim() ? C.t4 : C.acc,
                color: C.bg,
                border: 'none',
                borderRadius: '6px',
                cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                lineHeight: 1.4,
                opacity: isLoading || !inputValue.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Artifact Preview (hidden on mobile, 35% desktop) */}
      {!isMobile && (
        <div
          style={{
            flex: `0 0 ${previewWidth}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: C.bg2,
            borderRadius: '8px',
            padding: '12px',
            borderLeft: `1px solid ${C.t4}`,
            minWidth: 0,
            overflowY: 'auto',
          }}
        >
        {latestArtifact ? (
          <ArtifactPreviewPanel
            artifact={latestArtifact}
            isMobile={isMobile}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: C.t4,
              textAlign: 'center',
              fontSize: '12px',
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0 }}>
              Your generated code and previews appear here
            </p>
          </div>
        )}
        )}
      </div>

      {/* Mobile artifact view: show below chat when artifact exists */}
      {isMobile && latestArtifact && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: C.bg2,
            borderRadius: '8px',
            border: `1px solid ${C.t4}`,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          <ArtifactPreviewPanel
            artifact={latestArtifact}
            isMobile={true}
          />
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: ${C.t4};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${C.t3};
        }
      `}</style>
    </div>
  );
}

/**
 * Code Block Preview (shows first 20-30 lines, expandable)
 */
interface CodeBlockPreviewProps {
  artifacts: any[];
  isMobile: boolean;
}

function CodeBlockPreview({
  artifacts,
  isMobile,
}: CodeBlockPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const artifact = artifacts[0];
  const lines = artifact.code.split('\n');
  const preview = lines.slice(0, expanded ? lines.length : 25).join('\n');
  const hasMore = lines.length > 25;

  return (
    <div
      style={{
        backgroundColor: C.bg3,
        borderRadius: '6px',
        border: `1px solid ${C.t4}`,
        padding: '12px',
        overflowX: 'auto',
        fontSize: '12px',
        lineHeight: 1.4,
        fontFamily: 'monospace',
        color: C.t2,
        marginTop: '8px',
        scrollbarWidth: 'none',
      }}
    >
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {preview}
      </pre>

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: 'transparent',
            color: C.acc,
            border: `1px solid ${C.acc}`,
            borderRadius: '4px',
            cursor: 'pointer',
            lineHeight: 1.4,
          }}
        >
          Show more ({lines.length - 25} more lines)
        </button>
      )}

      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: 'transparent',
            color: C.acc,
            border: `1px solid ${C.acc}`,
            borderRadius: '4px',
            cursor: 'pointer',
            lineHeight: 1.4,
          }}
        >
          Show less
        </button>
      )}

      <style>{`::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

/**
 * Artifact Preview Panel (Right side)
 */
interface ArtifactPreviewPanelProps {
  artifact: any;
  isMobile: boolean;
}

function ArtifactPreviewPanel({
  artifact,
  isMobile,
}: ArtifactPreviewPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flex: 1,
      }}
    >
      <div
        style={{
          flex: 1,
          backgroundColor: C.bg,
          borderRadius: '8px',
          border: `1px solid ${C.t4}`,
          overflow: 'hidden',
          minHeight: '300px',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.t4,
            fontSize: '12px',
          }}
        >
          {artifact.type === 'react' && <p style={{ margin: 0, lineHeight: 1.4 }}>React Component</p>}
          {artifact.type === 'html' && <p style={{ margin: 0, lineHeight: 1.4 }}>HTML Preview</p>}
          {artifact.type === 'svg' && <p style={{ margin: 0, lineHeight: 1.4 }}>SVG Preview</p>}
        </div>
      </div>

      {/* Async content loader */}
      {artifact.asyncContent && artifact.asyncContent.type !== 'none' && (
        <AsyncContentStatus asyncContent={artifact.asyncContent} />
      )}

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <button
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            backgroundColor: C.acc,
            color: C.bg,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            lineHeight: 1.4,
            flex: isMobile ? '1 1 auto' : 'auto',
          }}
        >
          Copy
        </button>
        <button
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            backgroundColor: C.bg3,
            color: C.t1,
            border: `1px solid ${C.t4}`,
            borderRadius: '6px',
            cursor: 'pointer',
            lineHeight: 1.4,
            flex: isMobile ? '1 1 auto' : 'auto',
          }}
        >
          Full Screen
        </button>
      </div>
    </div>
  );
}

/**
 * Async Content Status (images, videos loading)
 */
interface AsyncContentStatusProps {
  asyncContent: { status: 'idle' | 'loading' | 'complete' | 'error'; type: string; progress?: number };
}

const AsyncContentStatus: React.FC<AsyncContentStatusProps> = ({ asyncContent }: AsyncContentStatusProps) => {
  const { status, type, progress } = asyncContent;

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: C.bg3,
        borderRadius: '6px',
        border: `1px solid ${C.t4}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        {status === 'loading' && (
          <>
            <div
              style={{
                width: '14px',
                height: '14px',
                border: `2px solid ${C.acc}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ fontSize: '12px', color: C.t2, fontWeight: 500, lineHeight: 1.4 }}>
              Generating {type}...
            </span>
          </>
        )}

        {status === 'complete' && (
          <>
            <span style={{ color: '#10b981', lineHeight: 1.4 }}>✓</span>
            <span style={{ fontSize: '12px', color: C.t2, fontWeight: 500, lineHeight: 1.4 }}>
              {type.charAt(0).toUpperCase() + type.slice(1)} ready
            </span>
          </>
        )}

        {status === 'error' && (
          <>
            <span style={{ color: '#ef4444', lineHeight: 1.4 }}>✕</span>
            <span style={{ fontSize: '12px', color: '#ef4444', lineHeight: 1.4 }}>Error</span>
          </>
        )}
      </div>

      {status === 'loading' && (
        <>
          <div
            style={{
              width: '100%',
              height: '3px',
              backgroundColor: C.bg2,
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress || 0}%`,
                height: '100%',
                backgroundColor: C.acc,
                transition: 'transform 150ms ease-out',
              }}
            />
          </div>
          <p
            style={{
              fontSize: '11px',
              color: C.t4,
              margin: '8px 0 0 0',
              textAlign: 'right',
              lineHeight: 1.4,
            }}
          >
            {progress ? `${Math.round(progress)}%` : 'Starting...'}
          </p>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SplitPanelChat;
