import { streamAssistantChatResponse, type PipelineContext, type ChatMessage } from '@/lib/openai/responses';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';
import { buildIntegratedChatContext } from '@/lib/ai-chat/context/buildIntegratedContext';
import type { AssistantRequestContext } from '@/lib/ai-chat/context/types';

// ── Conversation persistence ───────────────────────────────────────────────────

async function ensureConversation(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  incomingId: string | undefined,
  firstUserText: string,
): Promise<string> {
  if (incomingId) {
    const { data } = await admin
      .from('assistant_conversations')
      .select('id')
      .eq('id', incomingId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const title = firstUserText.slice(0, 60) || 'New conversation';
  const { data, error } = await admin
    .from('assistant_conversations')
    .insert({ user_id: userId, title })
    .select('id')
    .single();
  if (error || !data) throw new Error('Failed to create conversation');
  return data.id as string;
}

async function persistExchange(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  userText: string,
  assistantText: string,
  model: string,
): Promise<void> {
  const inserts: Array<{ conversation_id: string; role: string; content: string; model?: string }> = [];
  if (userText) inserts.push({ conversation_id: conversationId, role: 'user', content: userText });
  if (assistantText) inserts.push({ conversation_id: conversationId, role: 'assistant', content: assistantText, model });
  if (inserts.length > 0) await admin.from('assistant_messages').insert(inserts);
  await admin
    .from('assistant_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let payload: {
    messages?: unknown;
    context?: unknown;
    requestContext?: unknown;
    conversationId?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { messages, context, requestContext, conversationId: incomingConvId } = payload;
  if (!messages || !Array.isArray(messages)) return new Response('messages array is required', { status: 400 });
  if (!context || typeof context !== 'object') return new Response('context object is required', { status: 400 });

  const admin = createAdminClient();
  let workspaceId: string | undefined = (requestContext as AssistantRequestContext | undefined)?.workspaceId;
  if (!workspaceId) {
    try {
      const selection = await getCurrentWorkspaceSelection(admin, user);
      workspaceId = selection.current.workspace.id;
    } catch { workspaceId = undefined; }
  }

  const integratedContext = await buildIntegratedChatContext({
    ...(typeof requestContext === 'object' && requestContext ? requestContext as AssistantRequestContext : {}),
    workspaceId,
  });

  // Extract user text for conversation title + persistence
  const lastUserMsg = (messages as Array<{ role: string; content: unknown }>).findLast((m) => m.role === 'user');
  const userText =
    typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? (lastUserMsg.content as Array<{ type: string; text?: string }>)
            .filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ')
        : '';

  // Create/resolve conversation before streaming
  let conversationId: string | undefined;
  try {
    conversationId = await ensureConversation(admin, user.id, incomingConvId, userText);
  } catch { conversationId = undefined; }

  try {
    const upstream = await streamAssistantChatResponse(
      messages as ChatMessage[],
      { ...(context as PipelineContext), integratedContext },
    );

    // Tee: one side to client, one side for persistence accumulation
    const [clientStream, persistStream] = upstream.tee();

    // Accumulate + persist assistant response after stream ends (fire-and-forget)
    if (conversationId) {
      const convId = conversationId;
      (async () => {
        const reader = persistStream.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let fullText = '';
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const chunks = buf.split('\n\n');
            buf = chunks.pop() ?? '';
            for (const chunk of chunks) {
              const line = chunk.split('\n').find((l) => l.startsWith('data: '));
              if (!line) continue;
              try {
                const evt = JSON.parse(line.slice(6)) as { type: string; delta?: string };
                if (evt.type === 'text' && evt.delta) fullText += evt.delta;
              } catch { /* ignore */ }
            }
          }
          await persistExchange(admin, convId, userText, fullText, 'gpt-4o');
        } catch { /* persistence failure is non-fatal */ }
      })();
    }

    // Wrap client stream to prepend conversationId event
    const convId = conversationId;
    const encoder = new TextEncoder();
    const wrappedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Prepend conversationId so client knows before first text delta
        if (convId) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', conversationId: convId })}\n\n`));
        }
        const reader = clientStream.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    return new Response(wrappedStream, {
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
