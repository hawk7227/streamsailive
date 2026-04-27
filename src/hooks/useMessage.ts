/**
 * Phase 10: Custom Hooks for Chat Operations
 * Reactions, Editing, Clipboard, Regenerate
 */

import { useCallback, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  addReaction,
  removeReaction,
  getMessageReactions,
  editMessage,
  deleteMessage,
} from '@/lib/streams/chat-persistence-v2';

/**
 * Hook: Message Reactions (👍👎)
 */
export function useMessageReactions(
  supabase: SupabaseClient | null,
  messageId: string,
  userId: string | null
) {
  const [reactions, setReactions] = useState<{
    thumbsUp: string[];
    thumbsDown: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load reactions on mount
  const loadReactions = useCallback(async () => {
    if (!supabase || !messageId) return;

    setIsLoading(true);
    try {
      const { data, error } = await getMessageReactions(supabase, messageId);
      if (!error) {
        setReactions(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [supabase, messageId]);

  // Add or remove reaction
  const toggleReaction = useCallback(
    async (reaction: '👍' | '👎') => {
      if (!supabase || !userId) return;

      setIsLoading(true);
      try {
        // Check if user already reacted
        const hasReacted = reactions?.[
          reaction === '👍' ? 'thumbsUp' : 'thumbsDown'
        ]?.includes(userId);

        if (hasReacted) {
          // Remove reaction
          await removeReaction(supabase, messageId, userId, reaction);
          if (reaction === '👍') {
            setReactions((prev) =>
              prev
                ? {
                    ...prev,
                    thumbsUp: prev.thumbsUp.filter((id) => id !== userId),
                  }
                : null
            );
          } else {
            setReactions((prev) =>
              prev
                ? {
                    ...prev,
                    thumbsDown: prev.thumbsDown.filter((id) => id !== userId),
                  }
                : null
            );
          }
        } else {
          // Add reaction
          await addReaction(supabase, messageId, userId, reaction);
          if (reaction === '👍') {
            setReactions((prev) =>
              prev
                ? { ...prev, thumbsUp: [...prev.thumbsUp, userId] }
                : { thumbsUp: [userId], thumbsDown: [] }
            );
          } else {
            setReactions((prev) =>
              prev
                ? { ...prev, thumbsDown: [...prev.thumbsDown, userId] }
                : { thumbsUp: [], thumbsDown: [userId] }
            );
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [supabase, messageId, userId, reactions]
  );

  return {
    reactions,
    isLoading,
    loadReactions,
    toggleReaction,
  };
}

/**
 * Hook: Message Editing
 */
export function useMessageEditing(
  supabase: SupabaseClient | null,
  messageId: string
) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = useCallback(
    async (newContent: string) => {
      if (!supabase || !newContent.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: err } = await editMessage(
          supabase,
          messageId,
          newContent
        );

        if (err) {
          setError(err.message);
          return false;
        }

        setIsEditing(false);
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    [supabase, messageId]
  );

  const handleDelete = useCallback(async () => {
    if (!supabase) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: err } = await deleteMessage(supabase, messageId);

      if (err) {
        setError(err.message);
        return false;
      }

      return true;
    } finally {
      setIsLoading(false);
    }
  }, [supabase, messageId]);

  return {
    isEditing,
    setIsEditing,
    isLoading,
    error,
    handleEdit,
    handleDelete,
  };
}

/**
 * Hook: Copy to Clipboard with Toast
 */
export function useMessageClipboard() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, []);

  return {
    copied,
    copyToClipboard,
  };
}

/**
 * Hook: Message Regeneration
 * Re-send the user's message to get a new assistant response
 */
export function useMessageRegenerate(
  onRegenerateClick?: (userMessageContent: string) => Promise<void>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerate = useCallback(
    async (userMessageContent: string) => {
      if (!onRegenerateClick) return;

      setIsLoading(true);
      setError(null);

      try {
        await onRegenerateClick(userMessageContent);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to regenerate';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [onRegenerateClick]
  );

  return {
    isLoading,
    error,
    regenerate,
  };
}

/**
 * Hook: Combined message operations (convenience)
 */
export function useMessage(
  supabase: SupabaseClient | null,
  messageId: string,
  userId: string | null,
  onRegenerateClick?: (userMessageContent: string) => Promise<void>
) {
  const reactions = useMessageReactions(supabase, messageId, userId);
  const editing = useMessageEditing(supabase, messageId);
  const clipboard = useMessageClipboard();
  const regenerate = useMessageRegenerate(onRegenerateClick);

  return {
    reactions,
    editing,
    clipboard,
    regenerate,
  };
}
