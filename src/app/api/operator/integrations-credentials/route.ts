import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    data: [
      { provider: 'openai', configured: !!process.env.OPENAI_API_KEY, scopes: ['chat', 'images', 'speech'] },
      { provider: 'elevenlabs', configured: !!process.env.ELEVENLABS_API_KEY, scopes: ['tts'] },
      { provider: 'youtube', configured: true, scopes: ['public transcript/oembed'] },
    ],
  });
}
