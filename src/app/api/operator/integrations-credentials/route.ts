import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, FAL_API_KEY, FAL_KEY, KLING_ACCESS_KEY, KLING_SECRET_KEY, OPENAI_API_KEY, RESEND_API_KEY, RUNWAY_API_KEY, STRIPE_SECRET_KEY } from "@/lib/env";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    data: [
      { provider: 'openai',      configured: !!OPENAI_API_KEY,      scopes: ['chat', 'images', 'speech', 'whisper'] },
      { provider: 'anthropic',   configured: !!ANTHROPIC_API_KEY,   scopes: ['chat'] },
      { provider: 'elevenlabs',  configured: !!ELEVENLABS_API_KEY,  scopes: ['tts', 'voices'] },
      { provider: 'kling',       configured: !!KLING_ACCESS_KEY && !!KLING_SECRET_KEY, scopes: ['i2v', 'video'] },
      { provider: 'runway',      configured: !!RUNWAY_API_KEY,      scopes: ['video'] },
      { provider: 'fal',         configured: !!(FAL_API_KEY || FAL_KEY),             scopes: ['image', 'video'] },
      { provider: 'stripe',      configured: !!STRIPE_SECRET_KEY,   scopes: ['payments', 'webhooks'] },
      { provider: 'resend',      configured: !!RESEND_API_KEY,      scopes: ['email'] },
      { provider: 'supabase',    configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL, scopes: ['database', 'storage', 'auth'] },
      { provider: 'youtube',     configured: true,                               scopes: ['public transcript/oembed — no key required'] },
    ],
  });
}
