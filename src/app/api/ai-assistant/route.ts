import { streamAssistantChatResponse, type PipelineContext, type ChatMessage } from '@/lib/openai/responses';
import { shouldRunProbes, extractFeatureTarget } from '@/lib/enforcement/modeEngine';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';
import { buildIntegratedChatContext } from '@/lib/ai-chat/context/buildIntegratedContext';
import type { AssistantRequestContext } from '@/lib/ai-chat/context/types';
import type { VerifyResponse } from '@/app/api/verify/route';

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

// ── Probe runner (self-calls /api/verify) ─────────────────────────────────────

async function runProbes(requestUrl: string, cookieHeader: string, features: string): Promise<VerifyResponse | null> {
  try {
    const origin = new URL(requestUrl).origin;
    const res = await fetch(`${origin}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        // Tell /api/verify where to probe — derived from the live request URL,
        // so it works in dev (localhost:3000) and prod (coral-app-rpgt7.ondigitalocean.app)
        'X-Probe-Origin': origin,
      },
      body: JSON.stringify({ features }),
    });
    if (!res.ok) return null;
    return await res.json() as VerifyResponse;
  } catch {
    return null;
  }
}

function formatProbeResults(data: VerifyResponse): string {
  const passed = data.results.filter((r) => r.status === 'pass');
  const failed = data.results.filter((r) => r.status !== 'pass');

  const lines: string[] = ['VERIFIED:'];
  if (passed.length === 0) {
    lines.push('- None passed.');
  } else {
    for (const r of passed) {
      lines.push(`- ${r.label} → HTTP ${r.httpStatus} (${r.durationMs}ms)`);
    }
  }

  lines.push('', 'NOT VERIFIED:');
  if (failed.length === 0) {
    lines.push('- All checks passed.');
  } else {
    for (const r of failed) {
      const status = r.httpStatus !== null ? `HTTP ${r.httpStatus}` : r.status.toUpperCase();
      lines.push(`- ${r.label} → ${status}${r.error ? ` — ${r.error}` : ''}`);
    }
  }

  lines.push('', 'REQUIRES RUNTIME:');
  if (failed.length > 0) {
    lines.push(`- ${failed.length} check${failed.length > 1 ? 's' : ''} did not pass. Inspect Vercel logs for details.`);
  } else {
    lines.push('- Nothing — all routes responded as expected.');
  }

  lines.push('', `Pass rate: ${data.summary.passRate}% (${data.summary.passed}/${data.summary.total}) · Run ID: ${data.runId}`);
  return lines.join('\n');
}

// ── SSE helper ─────────────────────────────────────────────────────────────────

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let payload: { messages?: unknown; context?: unknown; requestContext?: unknown; conversationId?: string; };
  try { payload = await request.json(); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

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

  // Extract user text
  const lastUserMsg = (messages as Array<{ role: string; content: unknown }>).findLast((m) => m.role === 'user');
  const userText =
    typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? (lastUserMsg.content as Array<{ type: string; text?: string }>)
            .filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ')
        : '';

  let conversationId: string | undefined;
  try { conversationId = await ensureConversation(admin, user.id, incomingConvId, userText); }
  catch { conversationId = undefined; }

  const encoder = new TextEncoder();
  const convId = conversationId;
  const cookieHeader = request.headers.get('cookie') ?? '';

  // ── Probe path: text-match only, zero LLM calls, zero delay ──────────────
  // shouldRunProbes() is pure string matching — no network, instant.
  if (shouldRunProbes(userText)) {
    const features = extractFeatureTarget(userText);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        if (convId) controller.enqueue(encoder.encode(sse({ type: 'conversation_id', conversationId: convId })));

        controller.enqueue(encoder.encode(sse({
          type: 'text',
          delta: `Running live HTTP probes (${features === 'all' ? 'all systems' : features})...\n\n`,
        })));

        const data = await runProbes(request.url, cookieHeader, features);

        let fullText: string;
        if (!data) {
          fullText = 'VERIFIED:\n- None — probe runner failed.\n\nNOT VERIFIED:\n- All routes — /api/verify returned an error.\n\nREQUIRES RUNTIME:\n- Ensure /api/verify is deployed and reachable.';
        } else {
          fullText = formatProbeResults(data);
        }

        // Stream the result text in small chunks so it feels live
        const chunks: string[] = [];
        for (let i = 0; i < fullText.length; i += 80) chunks.push(fullText.slice(i, i + 80));
        if (chunks.length === 0) chunks.push(fullText);
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(sse({ type: 'text', delta: chunk })));
        }

        controller.enqueue(encoder.encode(sse({ type: 'done', mode: 'verification' })));
        controller.close();

        if (convId) {
          const preamble = `Running live HTTP probes (${features === 'all' ? 'all systems' : features})...\n\n`;
          persistExchange(admin, convId, userText, preamble + fullText, 'probe').catch(() => {});
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  // ── Normal streaming path — single LLM call, streamed from first token ────
  try {
    const upstream = await streamAssistantChatResponse(
      messages as ChatMessage[],
      { ...(context as PipelineContext), integratedContext },
    );

    const [clientStream, persistStream] = upstream.tee();

    if (convId) {
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
        } catch { /* non-fatal */ }
      })();
    }

    const wrappedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        if (convId) controller.enqueue(encoder.encode(sse({ type: 'conversation_id', conversationId: convId })));
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
