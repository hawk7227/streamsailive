'use client';

/**
 * MediaPreviewPanel
 *
 * Slides out from the left edge of the floating chat panel when an image or video
 * generation completes. Extends to the natural width/height of the media.
 * Chat can push new media to it and it auto-updates.
 *
 * Positioning: anchored to the floater via CSS transform, slides in from the right.
 * No portal — rendered inside the floater's stacking context so z-index is consistent.
 */

import React, { useState, useEffect, useRef } from 'react';

export type MediaPreviewItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  label?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
  conversationId?: string;
  persisted?: boolean;
};

interface MediaPreviewPanelProps {
  item: MediaPreviewItem | null;
  onClose: () => void;
  onSendToChat?: (item: MediaPreviewItem) => void;
}

const PANEL_WIDTH = 340;
const PANEL_MAX_HEIGHT = 520;

export function MediaPreviewPanel({ item, onClose, onSendToChat }: MediaPreviewPanelProps) {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const prevItemId = useRef<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Slide in when item changes
  useEffect(() => {
    if (item && item.id !== prevItemId.current) {
      prevItemId.current = item.id;
      setVisible(true);
      // Small delay to allow CSS transition to run
      requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    }
    if (!item) {
      setEntered(false);
      const t = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(t);
    }
  }, [item]);

  if (!visible || !item) return null;

  const isVideo = item.type === 'video';

  // Compute panel dimensions from aspect ratio
  const ar = item.aspectRatio ?? (isVideo ? '16:9' : '4:5');
  const [arW, arH] = ar.split(':').map(Number);
  const mediaHeight = Math.min(PANEL_MAX_HEIGHT, Math.round(PANEL_WIDTH * (arH / arW)));

  return (
    <>
    {expanded && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={() => setExpanded(false)}
      >
        <div style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
          {isVideo ? (
            <video src={item.url} controls autoPlay playsInline style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 16, display: 'block' }} />
          ) : (
            <img src={item.url} alt={item.label ?? 'Generated image'} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 16, display: 'block' }} />
          )}
          <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 8 }}>
            <a href={item.url} download target='_blank' rel='noreferrer' style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(10,12,16,0.75)', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>Download</a>
            <button type='button' onClick={() => setExpanded(false)} style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(10,12,16,0.75)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      </div>
    )}
    <div
      style={{
        position: 'absolute',
        // Attach to the left edge of the floater, slide outward
        right: '100%',
        bottom: 0,
        width: PANEL_WIDTH,
        zIndex: 80,
        pointerEvents: 'auto',
        transform: entered ? 'translateX(0)' : 'translateX(24px)',
        opacity: entered ? 1 : 0,
        transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
        marginRight: 10,
      }}
    >
      {/* Panel chrome */}
      <div style={{
        borderRadius: 20,
        overflow: 'hidden',
        background: '#0A0C10',
        border: '1px solid rgba(103,232,249,0.2)',
        boxShadow: '0 18px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(103,232,249,0.06)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#34d399',
              boxShadow: '0 0 8px #34d399',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#67e8f9', letterSpacing: '0.06em' }}>
              {isVideo ? 'VIDEO PREVIEW' : 'IMAGE PREVIEW'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', fontSize: 16, lineHeight: 1,
              padding: '2px 4px', borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Media */}
        <div style={{
          width: '100%',
          height: mediaHeight,
          background: '#060810',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {isVideo ? (
            <video
              src={item.url}
              controls
              autoPlay
              muted
              loop
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <img
              src={item.url}
              alt={item.label ?? 'Generated image'}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          )}
        </div>

        {/* Label + actions */}
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {item.label && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.4 }}>
              {item.label}
            </p>
          )}
          {item.persisted && (
            <p style={{ fontSize: 10, color: '#6ee7b7', margin: 0, lineHeight: 1.3 }}>Saved to conversation history</p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onSendToChat && (
              <button
                type="button"
                onClick={() => onSendToChat(item)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 10, border: '1px solid rgba(103,232,249,0.25)',
                  background: 'rgba(103,232,249,0.06)', color: '#67e8f9',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >
                Send to Chat
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
              }}
            >
              Enlarge
            </button>
            <a
              href={item.url}
              download
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1, padding: '7px 0', borderRadius: 10, border: '1px solid rgba(103,232,249,0.18)',
                background: 'rgba(103,232,249,0.04)', color: '#67e8f9',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                letterSpacing: '0.04em',
              }}
            >
              Save copy
            </a>
            <a
              href={item.url}
              download
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1, padding: '7px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                letterSpacing: '0.04em',
              }}
            >
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
