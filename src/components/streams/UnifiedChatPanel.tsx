'use client';

/**
 * UnifiedChatPanel - Collapsed architecture
 * 
 * Replaces:
 * - Phase9ChatControlPlane (orchestrator)
 * - SplitPanelChat (display)
 * - ConcurrentArtifactRenderer (artifact rendering)
 * 
 * Single component, single responsibility
 * Streamlined state management
 * Direct message → API → render flow
 */

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
  }[];
  isStreaming?: boolean;
}

interface UnifiedChatPanelProps {
  projectId?: string;
  userId?: string;
  onArtifactGenerated?: (artifactId: string) => void;
}

export function UnifiedChatPanel({
  projectId,
  userId,
  onArtifactGenerated,
}: UnifiedChatPanelProps) {
  // ============================================
  // STATE (consolidated from 2 components)
  // ============================================
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string } | null>(null);

  // Refs
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAtBottomRef = useRef(true);

  // ============================================
  // EFFECTS (consolidated, reduced from 6+ to 3)
  // ============================================

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    if (isAtBottomRef.current && chatPanelRef.current) {
      requestAnimationFrame(() => {
        chatPanelRef.current?.scrollTo({
          top: chatPanelRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, [messages]);

  // Pre-create iframe for artifact rendering (optimization)
  useEffect(() => {
    if (!iframeRef.current) return;
    
    // Initialize iframe once with blank HTML
    try {
      iframeRef.current.srcdoc = '<html><body style="margin:0;padding:8px;font-family:system-ui;background:#f9fafb;"></body></html>';
    } catch (err) {
      console.error('Failed to initialize iframe:', err);
    }
  }, []);

  // ============================================
  // MESSAGE SENDING LOGIC
  // ============================================

  const handleSendMessage = useCallback(
    async (message: string, fileData?: { name: string; type: string; content: string }) => {
      if (!message.trim() || !userId) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Call API with message + optional file
        const response = await fetch('/api/streams/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            projectId: projectId || null,
            userId,
            file: fileData
              ? {
                  name: fileData.name,
                  type: fileData.type,
                  content: fileData.content,
                }
              : null,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Create assistant message placeholder
        const assistantMsgId = `msg-${Date.now()}-assistant`;
        let currentAssistantContent = '';
        let currentArtifact: ChatMessage['artifacts']?.[0] | null = null;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'response' && data.token) {
                  // Streaming text response
                  currentAssistantContent += data.token;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg?.role === 'assistant' && lastMsg.id === assistantMsgId) {
                      lastMsg.content = currentAssistantContent;
                    } else {
                      updated.push({
                        id: assistantMsgId,
                        role: 'assistant',
                        content: currentAssistantContent,
                        artifacts: currentArtifact ? [currentArtifact] : undefined,
                      });
                    }
                    return updated;
                  });
                }

                if (data.type === 'artifact' && data.code) {
                  // Artifact generated - write directly to iframe without state change
                  currentArtifact = {
                    id: `artifact-${Date.now()}`,
                    code: data.code,
                    type: data.type || 'react',
                  };
                  
                  // OPTIMIZATION: Direct iframe write (no re-render needed)
                  if (iframeRef.current && iframeRef.current.contentDocument) {
                    try {
                      const doc = iframeRef.current.contentDocument;
                      doc.body.innerHTML = `<pre style="margin:0;padding:8px;font-family:monospace;font-size:12px;color:#333;overflow:auto;"><code>${currentArtifact.code.substring(0, 500)}</code></pre>`;
                    } catch (err) {
                      console.error('Failed to write to iframe:', err);
                    }
                  }
                  
                  // Also update state for UI consistency
                  onArtifactGenerated?.(currentArtifact.id);
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg?.role === 'assistant') {
                      lastMsg.artifacts = [currentArtifact];
                    }
                    return updated;
                  });
                }
              } catch (e) {
                // Not JSON, skip
              }
            }
          }
        }

        setIsLoading(false);
      } catch (error) {
        if (error instanceof Error && error.message !== 'The operation was aborted') {
          console.error('Chat error:', error);
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-error`,
              role: 'assistant',
              content: `Error: ${error.message}`,
            },
          ]);
        }
        setIsLoading(false);
      }
    },
    [userId, projectId, onArtifactGenerated]
  );

  // ============================================
  // FILE HANDLING
  // ============================================

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return;

    let fileData: { name: string; type: string; content: string } | undefined;
    if (uploadedFile && fileInputRef.current?.files?.[0]) {
      const file = fileInputRef.current.files[0];
      try {
        const content = await file.text();
        fileData = {
          name: file.name,
          type: file.type,
          content,
        };
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }

    await handleSendMessage(inputValue, fileData);
    setInputValue('');
    setUploadedFile(null);
  }, [inputValue, uploadedFile, handleSendMessage]);

  // ============================================
  // SCROLL HANDLING
  // ============================================

  const handleScroll = useCallback(() => {
    if (!chatPanelRef.current) return;
    const threshold = 100;
    const atBottom =
      chatPanelRef.current.scrollHeight - chatPanelRef.current.scrollTop <=
      chatPanelRef.current.clientHeight + threshold;
    isAtBottomRef.current = atBottom;
  }, []);

  // ============================================
  // RENDER - Artifact
  // ============================================

  const latestArtifact = messages
    .filter((m) => m.artifacts && m.artifacts.length > 0)
    .reverse()[0]?.artifacts?.[0];

  // ============================================
  // RENDER - UI
  // ============================================

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: C.bg,
        overflow: 'hidden',
      }}
    >
      {/* DESKTOP: Side-by-side layout (65% chat, 35% artifact) */}
      {!isMobile && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '65% 35%',
            gap: '20px',
            height: '100%',
            padding: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Chat panel */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minWidth: 0,
            }}
          >
            {/* Messages */}
            <div
              ref={chatPanelRef}
              onScroll={handleScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingRight: '4px',
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      maxWidth: msg.role === 'user' ? '85%' : '95%',
                      color: C.t1,
                      fontSize: '13px',
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Input area */}
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
                {/* File button */}
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
                  }}
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
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
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
                  onClick={handleSend}
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

          {/* Artifact panel */}
          <div
            style={{
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
              <>
                {/* Artifact controls */}
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    fontSize: '12px',
                  }}
                >
                  <button
                    onClick={() => {
                      // Regenerate logic
                      console.log('Regenerate clicked');
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      backgroundColor: C.acc,
                      color: C.bg,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => {
                      // Copy code
                      navigator.clipboard.writeText(latestArtifact.code);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: C.bg3,
                      color: C.t1,
                      border: `1px solid ${C.t4}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    Copy
                  </button>
                </div>

                {/* Artifact preview (iframe) */}
                <iframe
                  ref={iframeRef}
                  style={{
                    flex: 1,
                    border: `1px solid ${C.t4}`,
                    borderRadius: '6px',
                    backgroundColor: '#fff',
                    minHeight: '300px',
                  }}
                  title="artifact-preview"
                />

                {/* Code display */}
                <div
                  style={{
                    maxHeight: '200px',
                    overflow: 'auto',
                    padding: '8px',
                    backgroundColor: C.bg3,
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: C.t2,
                    lineHeight: 1.3,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {latestArtifact.code.substring(0, 300)}
                  {latestArtifact.code.length > 300 && '...'}
                </div>
              </>
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
                  Generated code and previews appear here
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MOBILE: Full-width single column */}
      {isMobile && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '8px',
            height: '100%',
          }}
        >
          {/* Messages */}
          <div
            ref={chatPanelRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              paddingRight: '4px',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    maxWidth: msg.role === 'user' ? '85%' : '95%',
                    color: C.t1,
                    fontSize: '13px',
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Mobile artifact display */}
            {latestArtifact && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: C.bg2,
                  borderRadius: '8px',
                  border: `1px solid ${C.t4}`,
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: C.t2,
                    marginBottom: '8px',
                  }}
                >
                  Preview:
                </div>
                <div
                  style={{
                    maxHeight: '150px',
                    overflow: 'auto',
                    padding: '8px',
                    backgroundColor: C.bg3,
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: C.t2,
                    lineHeight: 1.3,
                  }}
                >
                  {latestArtifact.code.substring(0, 200)}...
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
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
              {/* File button */}
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
                }}
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
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Claude..."
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
                onClick={handleSend}
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
      )}
    </div>
  );
}

export default UnifiedChatPanel;
