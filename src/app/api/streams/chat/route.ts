/**
 * POST /api/streams/chat
 *
 * Streams chat responses for the Streams chat tab.
 * SSE contract:
 * - activity: truthful UI phase/mode/status metadata
 * - response: streamed text deltas
 * - artifact: real fenced-code artifact extracted from the model response
 * - complete: final timing/model summary
 * - error: terminal failure
 */

import { NextResponse } from 'next/server';
import { routeModel } from '@/lib/streams/model-routing-openai';
import OpenAI from 'openai';

export const maxDuration = 60;
export const runtime = 'nodejs';

type ActivityMode = 'conversation' | 'file' | 'image' | 'image-edit' | 'build' | 'code' | 'tool';
type ActivityPhase = 'thinking' | 'reading-file' | 'generating-image' | 'editing-image' | 'building' | 'responding' | 'complete' | 'error';

interface ChatRequest {
  message: string;
  projectId?: string | null;
  userId: string;
  file?: {
    name: string;
    type: string;
    content: string;
  } | null;
}

interface ChatEvent {
  type: 'activity' | 'response' | 'artifact' | 'complete' | 'error';
  data: unknown;
}

function encodeEvent(event: ChatEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function shouldSuppressCodeInChat(message: string): boolean {
  const text = message.toLowerCase();
  return /\b(no code|don't show code|don't show|show in preview|in preview|render it|display it)\b/.test(text);
}

function inferActivityMode(message: string, hasFile: boolean, tier: string): ActivityMode {
  const text = message.toLowerCase();

  if (hasFile) return 'file';

  if (/\b(edit|change|modify|replace|remove|add|adjust|retouch|fix)\b/.test(text) && /\b(image|photo|picture|logo|background|visual)\b/.test(text)) {
    return 'image-edit';
  }

  if (/\b(generate|create|make|draw|design)\b/.test(text) && /\b(image|photo|picture|logo|visual|graphic)\b/.test(text)) {
    return 'image';
  }

  if (/\b(build|code|component|tsx|jsx|react|function|api|route|compile|implement|file|repo)\b/.test(text) || tier === 'primary') {
    return 'build';
  }

  if (/\b(search|read|save|upload|process|run)\b/.test(text)) return 'tool';

  return 'conversation';
}

function phaseForMode(mode: ActivityMode): ActivityPhase {
  switch (mode) {
    case 'file':
      return 'reading-file';
    case 'image':
      return 'generating-image';
    case 'image-edit':
      return 'editing-image';
    case 'build':
    case 'code':
      return 'building';
    case 'tool':
      return 'responding';
    case 'conversation':
    default:
      return 'thinking';
  }
}

function titleForMode(mode: ActivityMode): { label: string; title: string; subtitle: string } {
  switch (mode) {
    case 'file':
      return { label: 'FILE', title: 'Reading your file', subtitle: 'Extracting and analyzing the uploaded content.' };
    case 'image':
      return { label: 'IMAGE GENERATION', title: 'Generating your image', subtitle: 'No dead screen — your image is being created.' };
    case 'image-edit':
      return { label: 'IMAGE EDIT', title: 'Editing image to match your changes', subtitle: 'Applying the requested changes now.' };
    case 'build':
    case 'code':
      return { label: 'BUILDING', title: 'Building your code', subtitle: 'Preparing the implementation and output.' };
    case 'tool':
      return { label: 'WORKING', title: 'Running the requested action', subtitle: 'Keeping the session active while the result is prepared.' };
    case 'conversation':
    default:
      return { label: 'THINKING', title: 'Thinking', subtitle: 'Preparing a response.' };
  }
}

function extractFirstCodeArtifact(responseText: string): { code: string; language: string; type: 'react' | 'html' | 'svg' } | null {
  const match = responseText.match(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/);
  if (!match) return null;

  const language = (match[1] || 'text').toLowerCase();
  const code = match[2]?.trim();
  if (!code) return null;

  let type: 'react' | 'html' | 'svg' = 'react';
  if (language === 'html' || /<html[\s>]/i.test(code)) type = 'html';
  if (language === 'svg' || /<svg[\s>]/i.test(code)) type = 'svg';

  return { code, language, type };
}

export async function POST(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as ChatRequest;
    const { message, userId, file } = body;

    if (!message || !userId) {
      return NextResponse.json({ error: 'message and userId required' }, { status: 400 });
    }

    const route = routeModel({ userText: message, hasFileContext: Boolean(file) });
    const activityMode = inferActivityMode(message, Boolean(file), route.tier);
    const copy = titleForMode(activityMode);

    let context = '';
    if (file) {
      context = `User uploaded file: ${file.name} (${file.type})\n\nFile content:\n${file.content}\n\n`;
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: ChatEvent) => controller.enqueue(encoder.encode(encodeEvent(event)));

        try {
          send({
            type: 'activity',
            data: {
              phase: 'thinking' satisfies ActivityPhase,
              mode: activityMode,
              statusText: 'Thinking…',
              startedAt,
              model: route.model,
              routeReasons: route.reasons,
            },
          });

          send({
            type: 'activity',
            data: {
              phase: phaseForMode(activityMode),
              mode: activityMode,
              label: copy.label,
              title: copy.title,
              subtitle: copy.subtitle,
              startedAt,
              model: route.model,
              routeReasons: route.reasons,
            },
          });

          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          let responseText = '';

          const completion = await openai.chat.completions.create({
            model: route.model,
            max_tokens: 1600,
            temperature: 0.4,
            messages: [
              {
                role: 'system',
                content:
                  'You are Streams. Answer clearly. For code requests, include complete fenced code blocks when producing code. Do not claim that files were changed unless the system actually changed files.',
              },
              {
                role: 'user',
                content: context ? `${context}\nUser request: ${message}` : message,
              },
            ],
            stream: true,
          });

          send({
            type: 'activity',
            data: {
              phase: 'responding' satisfies ActivityPhase,
              mode: activityMode,
              statusText: 'Responding…',
              elapsedMs: Date.now() - startedAt,
              model: route.model,
            },
          });

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              responseText += delta;
              send({ type: 'response', data: { token: delta } });
            }
          }

          const artifact = extractFirstCodeArtifact(responseText);
          const suppressCode = shouldSuppressCodeInChat(message);
          
          if (artifact && !suppressCode) {
            send({
              type: 'artifact',
              data: {
                id: `artifact_${Date.now()}`,
                type: artifact.type,
                code: artifact.code,
                language: artifact.language,
                title: 'Generated Code',
              },
            });
          }

          // If preview requested, send to preview panel instead
          if (artifact && suppressCode) {
            send({
              type: 'artifact',
              data: {
                id: `artifact_${Date.now()}`,
                type: artifact.type,
                code: artifact.code,
                preview: true,
                suppressInChat: true,
              },
            });
          }

          send({
            type: 'complete',
            data: {
              elapsedMs: Date.now() - startedAt,
              messageLength: responseText.length,
              model: route.model,
              mode: activityMode,
              tokensEstimated: Math.ceil(responseText.length / 4),
            },
          });

          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          send({ type: 'error', data: { message, elapsedMs: Date.now() - startedAt } });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
