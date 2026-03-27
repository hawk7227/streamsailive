import { streamAssistantChatResponse, PipelineContext } from '@/lib/openai/responses';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';
import { buildIntegratedChatContext } from '@/lib/ai-chat/context/buildIntegratedContext';
import type { AssistantRequestContext } from '@/lib/ai-chat/context/types';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let payload: { messages?: unknown; context?: unknown; requestContext?: unknown };
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { messages, context, requestContext } = payload;
  if (!messages || !Array.isArray(messages)) return new Response('messages array is required', { status: 400 });
  if (!context || typeof context !== 'object') return new Response('context object is required', { status: 400 });

  const admin = createAdminClient();
  let workspaceId: string | undefined = (requestContext as AssistantRequestContext | undefined)?.workspaceId;
  if (!workspaceId) {
    try {
      const selection = await getCurrentWorkspaceSelection(admin, user);
      workspaceId = selection.current.workspace.id;
    } catch {
      workspaceId = undefined;
    }
  }

  const integratedContext = await buildIntegratedChatContext({
    ...(typeof requestContext === 'object' && requestContext ? requestContext as AssistantRequestContext : {}),
    workspaceId,
  });

  try {
    const stream = await streamAssistantChatResponse(messages as Parameters<typeof streamAssistantChatResponse>[0], {
      ...(context as PipelineContext),
      integratedContext,
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Assistant failed', { status: 500 });
  }
}
