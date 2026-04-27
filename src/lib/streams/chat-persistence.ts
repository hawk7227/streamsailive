/**
 * /lib/streams/chat-persistence.ts
 *
 * Save and load chat sessions, artifacts, and async content completion status
 * for Phase 9B concurrent rendering.
 *
 * Tables:
 * - streams_chat_sessions: Master session record
 * - streams_chat_messages: Individual messages (user + assistant)
 * - streams_artifacts: Generated code + metadata
 * - streams_async_content: Images, videos, progress status
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ChatSession {
  id: string;
  projectId: string | null;
  userId: string;
  workspaceId: string;
  topic?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface PersistedMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts: PersistedArtifact[];
  createdAt: string;
}

export interface PersistedArtifact {
  id: string;
  messageId: string;
  code: string;
  language: string;
  type: 'react' | 'code' | 'html';
  title?: string;
  asyncContent?: PersistedAsyncContent;
  createdAt: string;
}

export interface PersistedAsyncContent {
  id: string;
  artifactId: string;
  type: 'image' | 'video';
  url?: string;
  status: 'pending' | 'loading' | 'complete' | 'failed';
  progress: number; // 0-100
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Create or resume a chat session
 */
export async function createOrResumeSession(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  projectId: string | null,
  topic?: string
): Promise<ChatSession> {
  // Try to resume recent session for this project
  if (projectId) {
    const { data: recent } = await supabase
      .from('streams_chat_sessions')
      .select('*')
      .eq('userId', userId)
      .eq('projectId', projectId)
      .eq('workspaceId', workspaceId)
      .order('updatedAt', { ascending: false })
      .limit(1)
      .single();

    if (recent) {
      // Resume existing session
      return recent as ChatSession;
    }
  }

  // Create new session
  const newSession: Omit<ChatSession, 'id'> = {
    projectId,
    userId,
    workspaceId,
    topic,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
  };

  const { data, error } = await supabase
    .from('streams_chat_sessions')
    .insert([newSession])
    .select()
    .single();

  if (error) throw error;
  return data as ChatSession;
}

/**
 * Save a user message to session
 */
export async function saveUserMessage(
  supabase: SupabaseClient,
  sessionId: string,
  content: string
): Promise<PersistedMessage> {
  const message: Omit<PersistedMessage, 'id'> & { id?: string } = {
    sessionId,
    role: 'user',
    content,
    artifacts: [],
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('streams_chat_messages')
    .insert([message])
    .select()
    .single();

  if (error) throw error;

  // Update session's updatedAt and messageCount
  await supabase
    .from('streams_chat_sessions')
    .update({
      updatedAt: new Date().toISOString(),
      messageCount: (await supabase
        .from('streams_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sessionId', sessionId)).count || 0,
    })
    .eq('id', sessionId);

  return data as PersistedMessage;
}

/**
 * Save an assistant response message with artifacts
 */
export async function saveAssistantMessage(
  supabase: SupabaseClient,
  sessionId: string,
  content: string,
  artifacts: Array<{
    code: string;
    language: string;
    type: 'react' | 'code' | 'html';
    title?: string;
  }>
): Promise<PersistedMessage> {
  const message: Omit<PersistedMessage, 'id'> & { id?: string } = {
    sessionId,
    role: 'assistant',
    content,
    artifacts: [],
    createdAt: new Date().toISOString(),
  };

  const { data: msgData, error: msgError } = await supabase
    .from('streams_chat_messages')
    .insert([message])
    .select()
    .single();

  if (msgError) throw msgError;

  const messageId = msgData.id;

  // Save artifacts
  for (const art of artifacts) {
    const artifactRecord: Omit<PersistedArtifact, 'id'> & { id?: string } = {
      messageId,
      code: art.code,
      language: art.language,
      type: art.type,
      title: art.title,
      createdAt: new Date().toISOString(),
    };

    const { data: artData } = await supabase
      .from('streams_artifacts')
      .insert([artifactRecord])
      .select()
      .single();

    if (artData) {
      msgData.artifacts.push(artData);
    }
  }

  // Update session
  await supabase
    .from('streams_chat_sessions')
    .update({
      updatedAt: new Date().toISOString(),
      messageCount: (await supabase
        .from('streams_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sessionId', sessionId)).count || 0,
    })
    .eq('id', sessionId);

  return msgData as PersistedMessage;
}

/**
 * Load full chat history for a session
 */
export async function loadChatSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{
  session: ChatSession;
  messages: PersistedMessage[];
}> {
  // Load session
  const { data: session, error: sessionError } = await supabase
    .from('streams_chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError) throw sessionError;

  // Load messages with artifacts
  const { data: messages, error: messagesError } = await supabase
    .from('streams_chat_messages')
    .select(
      `
      *,
      streams_artifacts (*)
    `
    )
    .eq('sessionId', sessionId)
    .order('createdAt', { ascending: true });

  if (messagesError) throw messagesError;

  return {
    session: session as ChatSession,
    messages: (messages || []) as PersistedMessage[],
  };
}

/**
 * Track async content (image/video) generation progress
 */
export async function updateAsyncContentProgress(
  supabase: SupabaseClient,
  artifactId: string,
  progress: number,
  status: 'loading' | 'complete' | 'failed',
  errorMessage?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    progress,
    status,
  };

  if (status === 'complete') {
    update.completedAt = new Date().toISOString();
  }

  if (errorMessage) {
    update.errorMessage = errorMessage;
  }

  const { error } = await supabase
    .from('streams_async_content')
    .update(update)
    .eq('artifactId', artifactId);

  if (error) throw error;
}

/**
 * Save async content reference (for images, videos during generation)
 */
export async function saveAsyncContent(
  supabase: SupabaseClient,
  artifactId: string,
  type: 'image' | 'video',
  url?: string
): Promise<PersistedAsyncContent> {
  const record: Omit<PersistedAsyncContent, 'id'> & { id?: string } = {
    artifactId,
    type,
    url,
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('streams_async_content')
    .insert([record])
    .select()
    .single();

  if (error) throw error;
  return data as PersistedAsyncContent;
}

/**
 * Get project context from prior sessions
 * Used to populate system context for Claude
 */
export async function loadProjectContext(
  supabase: SupabaseClient,
  projectId: string,
  workspaceId: string
): Promise<{
  recentSessions: ChatSession[];
  totalMessages: number;
  topics: string[];
}> {
  // Last 5 sessions for this project
  const { data: sessions } = await supabase
    .from('streams_chat_sessions')
    .select('*')
    .eq('projectId', projectId)
    .eq('workspaceId', workspaceId)
    .order('updatedAt', { ascending: false })
    .limit(5);

  // Count total messages
  const { count: messageCount } = await supabase
    .from('streams_chat_messages')
    .select('id', { count: 'exact', head: true })
    .in('sessionId', (sessions || []).map((s: ChatSession) => s.id));

  // Extract unique topics
  const topics = Array.from(
    new Set((sessions || []).map((s: ChatSession) => s.topic).filter(Boolean))
  ) as string[];

  return {
    recentSessions: (sessions || []) as ChatSession[],
    totalMessages: messageCount || 0,
    topics,
  };
}
