import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';
import { buildStoredImageAttachment } from '@/lib/assistant-media/chatImage';
import { OPENAI_API_KEY, OPENAI_API_KEY_IMAGES } from "@/lib/env";
import { generateEnforcedImage } from "@/lib/media-realism/enforcedImage";

export const maxDuration = 120;
export const runtime = 'nodejs';

interface ChatImageRequest {
  prompt?: string;
  conversationId?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
}

interface StoredImageArtifact {
  id: string;
  type: 'image';
  provider: 'chat';
  storageUrl: string;
  originalPrompt: string;
  createdAt: string;
  conversationId: string;
  mimeType: string;
  label: string;
}

async function ensureConversation(admin: ReturnType<typeof createAdminClient>, userId: string, incomingId: string | undefined, firstUserText: string): Promise<string> {
  if (incomingId) {
    const { data } = await admin
      .from('assistant_conversations')
      .select('id')
      .eq('id', incomingId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data, error } = await admin
    .from('assistant_conversations')
    .insert({ user_id: userId, title: firstUserText.slice(0, 60) || 'Image generation' })
    .select('id')
    .single();

  if (error || !data?.id) throw new Error(error?.message ?? 'Failed to create conversation');
  return data.id as string;
}

function mapSizeToAspectRatio(input: ChatImageRequest['size']): '1:1' | '4:5' | '16:9' {
  if (input === '1024x1536') return '4:5';
  if (input === '1536x1024') return '16:9';
  return '1:1';
}


export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  let body: ChatImageRequest;
  try {
    body = await request.json() as ChatImageRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

  const selection = await getCurrentWorkspaceSelection(admin, user);
  const workspaceId = selection.current.workspace.id;
  const conversationId = await ensureConversation(admin, user.id, body.conversationId, prompt);
  const imageApiKey = OPENAI_API_KEY_IMAGES || OPENAI_API_KEY;
  if (!imageApiKey) return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });

  let storageUrl: string;
  try {
    const result = await generateEnforcedImage({
      prompt,
      apiKey: imageApiKey,
      workspaceId,
      mode: 'images',
      realismMode: 'strict_everyday',
      aspectRatio: mapSizeToAspectRatio(body.size),
    });
    storageUrl = result.outputUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const createdAt = new Date().toISOString();
  const artifact: StoredImageArtifact = {
    id: crypto.randomUUID(),
    type: 'image',
    provider: 'chat',
    storageUrl,
    originalPrompt: prompt,
    createdAt,
    conversationId,
    mimeType: 'image/png',
    label: 'Generated image',
  };

  const attachment = buildStoredImageAttachment({
    artifactId: artifact.id,
    url: artifact.storageUrl,
    prompt: artifact.originalPrompt,
    createdAt: artifact.createdAt,
  });

  const { data: insertedUser, error: userInsertError } = await admin
    .from('assistant_messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: prompt,
      provider: 'openai',
      model: 'gpt-image-1',
      attachments: [],
    })
    .select('id')
    .single();
  if (userInsertError) return NextResponse.json({ error: userInsertError.message }, { status: 500 });

  const { data: insertedAssistant, error: assistantInsertError } = await admin
    .from('assistant_messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: 'Generated image.',
      provider: 'openai',
      model: 'gpt-image-1',
      attachments: [attachment],
    })
    .select('id')
    .single();
  if (assistantInsertError) return NextResponse.json({ error: assistantInsertError.message }, { status: 500 });

  await admin.from('assistant_conversations').update({ updated_at: createdAt }).eq('id', conversationId);
  await admin.from('assistant_memory').insert({
    user_id: user.id,
    conversation_id: conversationId,
    memory_type: 'image_url',
    key: artifact.id,
    value: artifact,
    tags: ['chat-image', 'generated'],
  });

  return NextResponse.json({
    ok: true,
    conversationId,
    userMessageId: insertedUser.id,
    assistantMessageId: insertedAssistant.id,
    artifact,
  });
}
