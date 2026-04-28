/**
 * GET /api/streams/search?q=query&limit=10
 * Full-text search across chat messages and artifacts
 * Returns matching conversations with snippets
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';

export const maxDuration = 30;

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json(
      { error: 'Could not resolve workspace' },
      { status: 500 }
    );
  }

  // Search messages using full-text search
  const { data: messages, error: messageError } = await admin
    .from('chat_messages')
    .select(
      `
      id,
      content,
      role,
      created_at,
      conversation_id,
      conversations(id, title, created_at)
      `
    )
    .eq('conversations.workspace_id', workspaceId)
    .or(`content.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Search artifacts by name/description
  const { data: artifacts, error: artifactError } = await admin
    .from('artifacts')
    .select(
      `
      id,
      name,
      description,
      type,
      created_at,
      generation_id,
      generations(id, conversation_id, conversations(id, title))
      `
    )
    .eq('generations.conversations.workspace_id', workspaceId)
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (messageError || artifactError) {
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }

  // Format results
  const results = {
    messages: (messages || []).map((msg: any) => ({
      id: msg.id,
      type: 'message',
      content: msg.content.substring(0, 200), // Snippet
      role: msg.role,
      conversationId: msg.conversation_id,
      conversationTitle: msg.conversations?.title,
      createdAt: msg.created_at,
    })),
    artifacts: (artifacts || []).map((art: any) => ({
      id: art.id,
      type: 'artifact',
      name: art.name,
      description: art.description,
      artifactType: art.type,
      conversationId: art.generations?.[0]?.conversations?.id,
      conversationTitle: art.generations?.[0]?.conversations?.title,
      createdAt: art.created_at,
    })),
    total: (messages?.length || 0) + (artifacts?.length || 0),
  };

  return NextResponse.json(results);
}
