import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';
import { getSignedDownloadUrl } from '@/lib/supabase/storage';
import { generateMediaDerivative, type MediaDerivativeKind } from '@/lib/files/derivatives';

interface RouteContext {
  params: Promise<{ id: string; assetKind: string }>;
}

function parseDerivativeKind(value: string): MediaDerivativeKind | null {
  if (value === 'poster' || value === 'waveform') return value;
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, assetKind: assetKindRaw } = await context.params;
  const assetKind = parseDerivativeKind(assetKindRaw);
  if (!assetKind) return NextResponse.json({ error: 'Unsupported asset kind' }, { status: 400 });

  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);
  const workspaceId = selection.current.workspace.id;

  const { data: fileRecord, error } = await admin
    .from('files')
    .select('id, name, mime_type, storage_path, bucket, workspace_id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !fileRecord) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  if (assetKind === 'poster' && !fileRecord.mime_type.startsWith('video/')) {
    return NextResponse.json({ error: 'Poster is only available for video files' }, { status: 400 });
  }
  if (assetKind === 'waveform' && !fileRecord.mime_type.startsWith('audio/')) {
    return NextResponse.json({ error: 'Waveform is only available for audio files' }, { status: 400 });
  }

  const signedUrl = await getSignedDownloadUrl(fileRecord.storage_path, fileRecord.bucket, 3600);
  const response = await fetch(signedUrl);
  if (!response.ok) {
    return NextResponse.json({ error: `Failed to fetch file bytes (${response.status})` }, { status: 502 });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const derivative = await generateMediaDerivative({
    buffer,
    fileName: fileRecord.name,
    derivative: assetKind,
  });

  return new NextResponse(derivative.bytes, {
    headers: {
      'Content-Type': derivative.contentType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="${fileRecord.name}.${derivative.extension}"`,
      'X-Streams-Derivative': derivative.cacheKey,
    },
  });
}
