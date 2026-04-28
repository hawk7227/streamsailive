'use client';

import React, { useState } from 'react';
import { C } from './tokens';

interface SharePanelProps {
  itemId: string;
  itemType: 'artifact' | 'conversation';
  itemTitle?: string;
  onClose?: () => void;
}

export function SharePanel({
  itemId,
  itemType,
  itemTitle,
  onClose,
}: SharePanelProps) {
  const [isPublic, setIsPublic] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateShareLink = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/streams/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationLogId: itemId,
          title: itemTitle,
          isPublic,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const data = await response.json();
      setShareUrl(data.shareUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(
        `${typeof window !== 'undefined' ? window.location.origin : ''}${shareUrl}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: C.bg2,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '90vw',
          boxShadow: '0 20px 25px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: C.t1,
            margin: '0 0 16px 0',
            lineHeight: 1.4,
          }}
        >
          Share {itemType === 'artifact' ? 'Artifact' : 'Conversation'}
        </h2>

        {shareUrl ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                backgroundColor: C.bg3,
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: C.t2,
                wordBreak: 'break-all',
                lineHeight: 1.4,
              }}
            >
              {typeof window !== 'undefined'
                ? `${window.location.origin}${shareUrl}`
                : shareUrl}
            </div>
            <button
              onClick={handleCopyLink}
              style={{
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
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: C.t2, lineHeight: 1.4 }}>
                Make public (anyone with link can view)
              </span>
            </label>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <label
                style={{
                  fontSize: '12px',
                  color: C.t3,
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                Expires in (optional)
              </label>
              <select
                value={expiresInDays ?? ''}
                onChange={(e) =>
                  setExpiresInDays(e.target.value ? parseInt(e.target.value) : null)
                }
                style={{
                  padding: '8px',
                  backgroundColor: C.bg3,
                  color: C.t1,
                  border: `1px solid ${C.t4}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  lineHeight: 1.4,
                }}
              >
                <option value="">Never</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
            </div>

            {error && (
              <p style={{ color: C.red, fontSize: '12px', margin: 0, lineHeight: 1.4 }}>
                {error}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={onClose}
                style={{
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
                Cancel
              </button>
              <button
                onClick={handleCreateShareLink}
                disabled={isLoading}
                style={{
                  padding: '8px 12px',
                  backgroundColor: C.acc,
                  color: C.bg,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  opacity: isLoading ? 0.6 : 1,
                  lineHeight: 1.4,
                }}
              >
                {isLoading ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SharePanel;
