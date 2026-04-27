'use client';

import React, { useEffect, useRef, useState } from 'react';
import { C } from '../tokens';

export interface AsyncContent {
  type: 'image' | 'video' | 'none';
  url?: string;
  status: 'idle' | 'loading' | 'complete' | 'error';
  progress?: number;
  error?: string;
}

export interface ArtifactData {
  id: string;
  code: string;
  type: 'react' | 'html' | 'svg';
  asyncContent?: AsyncContent;
}

export interface ConcurrentArtifactRendererProps {
  artifact: ArtifactData;
  isStreaming?: boolean;
  onAsyncContentReady?: (content: AsyncContent) => void;
  onError?: (error: string) => void;
}

export function ConcurrentArtifactRenderer({
  artifact,
  isStreaming = false,
  onAsyncContentReady,
  onError,
}: ConcurrentArtifactRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [codeReady, setCodeReady] = useState(false);
  const [asyncContent, setAsyncContent] = useState<AsyncContent>(
    artifact.asyncContent || { type: 'none', status: 'idle' }
  );

  // Phase 1: Render code artifact immediately
  useEffect(() => {
    if (!iframeRef.current || !artifact.code) return;

    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;

      doc.open();

      let html = '';
      if (artifact.type === 'react') {
        html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
              <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
              <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                #root { padding: 16px; }
              </style>
            </head>
            <body>
              <div id="root"><\/div>
              <script type="text/babel">
                ${artifact.code}
              <\/script>
            </body>
          </html>
        `;
      } else if (artifact.type === 'html') {
        html = artifact.code;
      } else if (artifact.type === 'svg') {
        html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { margin: 0; padding: 16px; }
              </style>
            </head>
            <body>
              ${artifact.code}
            </body>
          </html>
        `;
      }

      doc.write(html);
      doc.close();

      setCodeReady(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to render code artifact';
      setAsyncContent((prev: AsyncContent) => ({ ...prev, status: 'error' }));
      onError?.(message);
    }
  }, [artifact.code, artifact.type, onError]);

  // Phase 2: Load async content in parallel
  useEffect(() => {
    if (!artifact.asyncContent || artifact.asyncContent.type === 'none') return;

    const loadAsyncContent = async () => {
      const content = artifact.asyncContent!;
      setAsyncContent({ ...content, status: 'loading' });

      try {
        if (content.type === 'image') {
          const img = new Image();
          img.addEventListener('progress', (event: ProgressEvent) => {
            if (event.lengthComputable) {
              const progress = (event.loaded / event.total) * 100;
              setAsyncContent((prev: AsyncContent) => ({ ...prev, progress }));
            }
          });
          img.addEventListener('load', () => {
            setAsyncContent((prev: AsyncContent) => ({
              ...prev,
              status: 'complete',
              progress: 100,
            }));
            onAsyncContentReady?.({ ...content, status: 'complete', progress: 100 });
          });
          img.addEventListener('error', () => {
            setAsyncContent((prev: AsyncContent) => ({
              ...prev,
              status: 'error',
              error: 'Failed to load image',
            }));
            onError?.('Failed to load image');
          });
          img.src = content.url || '';
        } else if (content.type === 'video') {
          const video = document.createElement('video');
          video.addEventListener('loadedmetadata', () => {
            setAsyncContent((prev: AsyncContent) => ({
              ...prev,
              status: 'complete',
              progress: 100,
            }));
            onAsyncContentReady?.(
              { ...content, status: 'complete', progress: 100 }
            );
          });
          video.addEventListener('error', () => {
            setAsyncContent((prev: AsyncContent) => ({
              ...prev,
              status: 'error',
              error: 'Failed to load video',
            }));
            onError?.('Failed to load video');
          });
          video.src = content.url || '';
          video.load();
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load async content';
        setAsyncContent((prev: AsyncContent) => ({
          ...prev,
          status: 'error',
          error: message,
        }));
        onError?.(message);
      }
    };

    loadAsyncContent();
  }, [artifact.asyncContent, onAsyncContentReady, onError]);

  // Responsive sizing
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const panelWidth = isDesktop ? '35%' : '40%';

  return (
    <div
      style={{
        flex: `0 0 ${panelWidth}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        minWidth: isDesktop ? '300px' : '180px',
      }}
    >
      {/* Code Artifact */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '300px',
          border: `1px solid ${C.t4}`,
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: C.bg3,
        }}
      >
        {!codeReady && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: C.bg3,
              zIndex: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  border: `2px solid ${C.acc}`,
                  borderTop: `2px solid transparent`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p
                style={{
                  fontSize: '12px',
                  color: C.t4,
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                Rendering...
              </p>
            </div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        <iframe
          ref={iframeRef}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '8px',
            opacity: codeReady ? 1 : 0.5,
          }}
          title="Artifact Preview"
          sandbox={{
            allow: 'scripts',
            allowFullscreen: true,
          } as any}
        />
      </div>

      {/* Async Content Progress */}
      {asyncContent.type !== 'none' && (
        <AsyncContentLoader
          content={asyncContent}
          isStreaming={isStreaming}
        />
      )}

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          paddingTop: '8px',
          borderTop: `1px solid ${C.t4}`,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => window.print?.()}
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            backgroundColor: C.acc,
            color: C.bg,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            lineHeight: 1.4,
          }}
        >
          Copy Code
        </button>
        <button
          onClick={() => {
            if (iframeRef.current?.src) {
              window.open(iframeRef.current.src, '_blank');
            }
          }}
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            backgroundColor: C.bg2,
            color: C.t1,
            border: `1px solid ${C.t4}`,
            borderRadius: '6px',
            cursor: 'pointer',
            lineHeight: 1.4,
          }}
        >
          Full Screen
        </button>
      </div>
    </div>
  );
}

function AsyncContentLoader({
  content,
  isStreaming,
}: {
  content: AsyncContent;
  isStreaming?: boolean;
}) {
  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: C.bg2,
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
        {content.status === 'loading' && (
          <>
            <div
              style={{
                width: '16px',
                height: '16px',
                border: `2px solid ${C.acc}`,
                borderTop: `2px solid transparent`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ fontSize: '12px', color: C.t2, fontWeight: 500, lineHeight: 1.4 }}>
              Generating {content.type}...
            </span>
          </>
        )}

        {content.status === 'complete' && (
          <>
            <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
            <span style={{ fontSize: '12px', color: C.t2, fontWeight: 500, lineHeight: 1.4 }}>
              {content.type.charAt(0).toUpperCase() + content.type.slice(1)} ready
            </span>
          </>
        )}

        {content.status === 'error' && (
          <>
            <span style={{ color: '#ef4444', fontSize: '16px' }}>✕</span>
            <span style={{ fontSize: '12px', color: '#ef4444', lineHeight: 1.4 }}>
              {content.error || 'Failed to load'}
            </span>
          </>
        )}
      </div>

      {content.status === 'loading' && (
        <>
          <div
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: C.bg3,
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '6px',
            }}
          >
            <div
              style={{
                width: `${content.progress || 0}%`,
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
              margin: 0,
              textAlign: 'right',
              lineHeight: 1.4,
            }}
          >
            {content.progress ? `${Math.round(content.progress)}%` : 'Starting...'}
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
}

export default ConcurrentArtifactRenderer;
