/**
 * Phase 10: Enhanced Chat Persistence with Retry Logic
 * Handles: Persistence, auto-save, error recovery, reactions, message editing
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retry logic: Exponential backoff with max 3 attempts
 * 100ms → 1s → 5s
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [100, 1000, 5000],
};

/**
 * Retry wrapper for Supabase operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'Operation'
): Promise<{ data: T | null; error: Error | null; attempt: number }> {
  let lastError: Error | null = null;
  let attempt = 0;

  for (attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const data = await operation();
      return { data, error: null, attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < RETRY_CONFIG.maxAttempts) {
        const delay = RETRY_CONFIG.delays[attempt - 1]!;
        console.log(
          `[${operationName}] Attempt ${attempt} failed, retrying in ${delay}ms:`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[${operationName}] All ${RETRY_CONFIG.maxAttempts} attempts failed:`,
          lastError.message
        );
      }
    }
  }

  return { data: null, error: lastError, attempt };
}

// ─────────────────────────────────────────────────────────────────────────
// SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export async function createChatSession(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  projectId: string | null,
  topic?: string
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_sessions')
        .insert([
          {
            user_id: userId,
            workspace_id: workspaceId,
            project_id: projectId,
            topic: topic || 'New conversation',
            message_count: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'CreateChatSession'
  );
}

export async function loadChatSessions(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('deleted', false)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    'LoadChatSessions'
  );
}

export async function deleteChatSession(
  supabase: SupabaseClient,
  sessionId: string
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_sessions')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'DeleteChatSession'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MESSAGE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export interface MessageToSave {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: string;
  routeReasons?: string[];
}

export async function saveMessage(
  supabase: SupabaseClient,
  message: MessageToSave
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_messages')
        .insert([
          {
            session_id: message.sessionId,
            role: message.role,
            content: message.content,
            model_used: message.modelUsed,
            route_reasons: message.routeReasons,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'SaveMessage'
  );
}

export async function loadSessionMessages(
  supabase: SupabaseClient,
  sessionId: string
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_messages')
        .select(
          `
          *,
          artifacts:streams_chat_artifacts(*),
          reactions:streams_message_reactions(id, reaction)
        `
        )
        .eq('session_id', sessionId)
        .eq('deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    'LoadSessionMessages'
  );
}

export async function editMessage(
  supabase: SupabaseClient,
  messageId: string,
  newContent: string
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_messages')
        .update({
          content: newContent,
          edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'EditMessage'
  );
}

export async function deleteMessage(
  supabase: SupabaseClient,
  messageId: string
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_messages')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'DeleteMessage'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ARTIFACT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export interface ArtifactToSave {
  messageId: string;
  code: string;
  language: string;
  type: 'react' | 'html' | 'svg' | 'code';
  title?: string;
}

export async function saveArtifact(
  supabase: SupabaseClient,
  artifact: ArtifactToSave
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_artifacts')
        .insert([artifact])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'SaveArtifact'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ASYNC CONTENT (IMAGES, VIDEOS)
// ─────────────────────────────────────────────────────────────────────────

export async function saveAsyncContent(
  supabase: SupabaseClient,
  artifactId: string,
  type: 'image' | 'video',
  url?: string,
  status: 'pending' | 'loading' | 'complete' | 'error' = 'pending',
  progress: number = 0
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_chat_async_content')
        .insert([
          {
            artifact_id: artifactId,
            type,
            url: url || null,
            status,
            progress,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'SaveAsyncContent'
  );
}

export async function updateAsyncContentProgress(
  supabase: SupabaseClient,
  contentId: string,
  progress: number,
  status?: 'loading' | 'complete' | 'error',
  url?: string
) {
  return withRetry(
    async () => {
      const update: Record<string, any> = { progress };
      if (status) update.status = status;
      if (url) update.url = url;
      if (status === 'complete') update.completed_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('streams_chat_async_content')
        .update(update)
        .eq('id', contentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'UpdateAsyncContentProgress'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MESSAGE REACTIONS (👍👎)
// ─────────────────────────────────────────────────────────────────────────

export async function addReaction(
  supabase: SupabaseClient,
  messageId: string,
  userId: string,
  reaction: '👍' | '👎'
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_message_reactions')
        .insert([
          {
            message_id: messageId,
            user_id: userId,
            reaction,
          },
        ])
        .select()
        .single();

      if (error) {
        // If already exists, that's fine - just return it
        if (error.message.includes('duplicate')) {
          return { message_id: messageId, user_id: userId, reaction };
        }
        throw error;
      }
      return data;
    },
    'AddReaction'
  );
}

export async function removeReaction(
  supabase: SupabaseClient,
  messageId: string,
  userId: string,
  reaction: '👍' | '👎'
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('reaction', reaction)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    'RemoveReaction'
  );
}

export async function getMessageReactions(
  supabase: SupabaseClient,
  messageId: string
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .from('streams_message_reactions')
        .select('reaction, user_id')
        .eq('message_id', messageId);

      if (error) throw error;

      // Group by reaction
      const grouped: Record<string, string[]> = {
        '👍': [],
        '👎': [],
      };

      (data || []).forEach((row: any) => {
        if (grouped[row.reaction]) {
          grouped[row.reaction].push(row.user_id);
        }
      });

      return {
        thumbsUp: grouped['👍'] || [],
        thumbsDown: grouped['👎'] || [],
      };
    },
    'GetMessageReactions'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────────────────

export async function searchMessages(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit: number = 20
) {
  return withRetry(
    async () => {
      const { data, error } = await supabase
        .rpc('search_user_messages', {
          user_id_param: userId,
          search_query: query,
          limit_param: limit,
        });

      if (error) throw error;
      return data || [];
    },
    'SearchMessages'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// REAL-TIME SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────

export function subscribeToSessionMessages(
  supabase: SupabaseClient,
  sessionId: string,
  onInsert: (message: any) => void,
  onUpdate: (message: any) => void,
  onDelete: (id: string) => void
) {
  const subscription = supabase
    .channel(`messages:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'streams_chat_messages',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => onInsert(payload.new)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams_chat_messages',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => onUpdate(payload.new)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams_message_reactions',
        filter: `message_id=in.(${sessionId})`,
      },
      (payload) => {
        // Reactions changed - you'll need to re-fetch
        console.log('Reactions updated:', payload);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
