import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface ChatImageRequest {
  prompt?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  references?: Array<{ url: string }>;
}

interface OpenAIImageResponse {
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  error?: { message?: string };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
  }

  let body: ChatImageRequest;
  try {
    body = await req.json() as ChatImageRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  if (body.references && body.references.length > 0) {
    return NextResponse.json({
      error: 'Provider-native reference-image editing is not implemented on this route yet.',
      code: 'reference_edit_not_implemented',
    }, { status: 501 });
  }

  const model = process.env.OPENAI_CHAT_IMAGE_MODEL ?? 'gpt-image-1';
  const size = body.size && body.size !== 'auto' ? body.size : '1024x1024';

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      n: 1,
    }),
  });

  const payload = await response.json() as OpenAIImageResponse;
  if (!response.ok) {
    return NextResponse.json({
      error: payload.error?.message ?? 'Image generation failed',
    }, { status: response.status });
  }

  const first = payload.data?.[0];
  if (first?.url) {
    return NextResponse.json({ ok: true, url: first.url, provider: 'chat', model, revisedPrompt: first.revised_prompt ?? null });
  }
  if (first?.b64_json) {
    return NextResponse.json({ ok: true, url: `data:image/png;base64,${first.b64_json}`, provider: 'chat', model, revisedPrompt: first.revised_prompt ?? null });
  }

  return NextResponse.json({ error: 'Provider returned no image artifact' }, { status: 502 });
}
