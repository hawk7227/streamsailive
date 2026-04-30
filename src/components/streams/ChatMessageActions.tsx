/**
 * Phase 10: Message Actions Component
 * Reactions, Regenerate, Edit, Copy buttons
 */

'use client';

import React, { useState, useCallback } from 'react';
import { C, R } from '@/components/streams/tokens';

// Build rule compliant colors
const COLORS = {
  successBg: C.blueDim, // Light blue for thumbs up
  errorBg: C.redDim, // Light red for thumbs down (use C.red with opacity)
};

export interface MessageAction {
  type: 'reaction' | 'regenerate' | 'edit' | 'copy' | 'delete';
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

interface MessageActionsProps {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  onReact?: (reaction: '👍' | '👎') => Promise<void>;
  onRegenerate?: () => Promise<void>;
  onEdit?: (newContent: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  reactions?: {
    thumbsUp: string[];
    thumbsDown: string[];
  };
  currentUserId?: string;
  isLoading?: boolean;
}

export function MessageActions({
  messageId,
  role,
  content,
  onReact,
  onRegenerate,
  onEdit,
  onDelete,
  reactions,
  currentUserId,
  isLoading,
}: MessageActionsProps) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [reacting, setReacting] = useState<'👍' | '👎' | null>(null);

  const handleReact = useCallback(
    async (reaction: '👍' | '👎') => {
      if (!onReact || reacting) return;
      setReacting(reaction);
      try {
        await onReact(reaction);
      } finally {
        setReacting(null);
      }
    },
    [onReact, reacting]
  );

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate || isLoading) return;
    await onRegenerate();
  }, [onRegenerate, isLoading]);

  const handleEdit = useCallback(async () => {
    if (!onEdit) return;
    await onEdit(editedContent);
    setIsEditing(false);
  }, [onEdit, editedContent]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    // Show toast "Copied!" - you can add Toaster integration here
  }, [content]);

  const hasThumbsUp = reactions?.thumbsUp.some((id) => id === currentUserId);
  const hasThumbsDown = reactions?.thumbsDown.some((id) => id === currentUserId);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '8px',
        flexWrap: 'wrap',
      }}
    >
      {/* Reactions */}
      {role === 'assistant' && (
        <>
          <button
            onClick={() => handleReact('👍')}
            disabled={isLoading || reacting === '👎'}
            title={`${reactions?.thumbsUp.length || 0} people found this helpful`}
            aria-label="React with thumbs up"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: hasThumbsUp ? C.accBr : 'transparent',
              border: `1px solid ${hasThumbsUp ? C.acc : C.bdr}`,
              borderRadius: R.r1,
              color: hasThumbsUp ? C.acc : C.t3,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
              minHeight: '32px',
              minWidth: '32px',
              opacity: isLoading ? 0.5 : 1,
              transition: 'background 150ms ease, border 150ms ease, color 150ms ease',
            }}
          >
            👍 {reactions?.thumbsUp.length || 0}
          </button>

          <button
            onClick={() => handleReact('👎')}
            disabled={isLoading || reacting === '👍'}
            title={`${reactions?.thumbsDown.length || 0} people found this unhelpful`}
            aria-label="React with thumbs down"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: hasThumbsDown ? 'rgba(220, 38, 38, 0.1)' : 'transparent',
              border: `1px solid ${hasThumbsDown ? C.red : C.bdr}`,
              borderRadius: R.r1,
              color: hasThumbsDown ? C.red : C.t3,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
              minHeight: '32px',
              minWidth: '32px',
              opacity: isLoading ? 0.5 : 1,
              transition: 'background 150ms ease, border 150ms ease, color 150ms ease',
            }}
          >
            👎 {reactions?.thumbsDown.length || 0}
          </button>
        </>
      )}

      {/* Regenerate (assistant only) */}
      {role === 'assistant' && onRegenerate && (
        <button
          onClick={handleRegenerate}
          disabled={isLoading}
          title="Regenerate response"
          aria-label="Regenerate response"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            background: 'transparent',
            border: `1px solid ${C.bdr}`,
            borderRadius: R.r1,
            color: C.t3,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
            minHeight: '32px',
            minWidth: '32px',
            opacity: isLoading ? 0.5 : 1,
            transition: 'background 150ms ease, border 150ms ease, color 150ms ease',
          }}
        >
          🔄
        </button>
      )}

      {/* Edit (user only) */}
      {role === 'user' && onEdit && !isEditing && (
        <button
          onClick={() => setIsEditing(true)}
          disabled={isLoading}
          title="Edit message"
          aria-label="Edit message"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            background: 'transparent',
            border: `1px solid ${C.bdr}`,
            borderRadius: R.r1,
            color: C.t3,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
            minHeight: '32px',
            minWidth: '32px',
            opacity: isLoading ? 0.5 : 1,
            transition: 'background 150ms ease, border 150ms ease, color 150ms ease',
          }}
        >
          ✏️
        </button>
      )}

      {/* Copy */}
      {content && (
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          aria-label="Copy to clipboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            background: 'transparent',
            border: `1px solid ${C.bdr}`,
            borderRadius: R.r1,
            color: C.t3,
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
            minHeight: '32px',
            minWidth: '32px',
            transition: 'background 150ms ease, border 150ms ease, color 150ms ease',
          }}
        >
          📋
        </button>
      )}

      {/* Delete */}
      {onDelete && (
        <button
          onClick={() => {
            if (window.confirm('Delete this message?')) {
              onDelete();
            }
          }}
          disabled={isLoading}
          title="Delete message"
          aria-label="Delete message"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            background: 'transparent',
            border: `1px solid ${C.bdr}`,
            borderRadius: R.r1,
            color: C.red,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
            minHeight: '32px',
            minWidth: '32px',
            opacity: isLoading ? 0.5 : 1,
            transition: 'background 150ms ease, border 150ms ease, color 150ms ease',
          }}
        >
          🗑️
        </button>
      )}

      {/* Edit Mode UI */}
      {isEditing && (
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginTop: '8px',
          }}
        >
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '8px 12px',
              background: C.bg3,
              border: `1px solid ${C.bdr}`,
              borderRadius: R.r1,
              color: C.t1,
              fontSize: '13px',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleEdit}
              style={{
                padding: '8px 12px',
                background: C.acc,
                border: 'none',
                borderRadius: R.r1,
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'inherit',
                fontWeight: 500,
                minHeight: '32px',
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedContent(content);
              }}
              style={{
                padding: '8px 12px',
                background: 'transparent',
                border: `1px solid ${C.bdr}`,
                borderRadius: R.r1,
                color: C.t3,
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'inherit',
                minHeight: '32px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
