import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';
import { getSignedDownloadUrl } from '@/lib/supabase/storage';
import { parseByType } from '@/lib/files/parserRouter';
import { buildFilePreviewManifest } from '@/lib/files/preview';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);
  const workspaceId = selection.current.workspace.id;
  const { id } = await context.params;

  const { data: fileRecord, error } = await admin
    .from('files')
    .select('id, name, mime_type, storage_path, bucket, workspace_id, metadata')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !fileRecord) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(fileRecord.storage_path, fileRecord.bucket, 3600);
  const response = await fetch(signedUrl);
  if (!response.ok) {
    return NextResponse.json({ error: `Failed to fetch file bytes (${response.status})` }, { status: 502 });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const parsed = await parseByType(buffer, fileRecord.name, fileRecord.mime_type);
  const preview = buildFilePreviewManifest({
    fileName: fileRecord.name,
    mimeType: fileRecord.mime_type,
    sourceUrl: signedUrl,
    parsed: { text: parsed.text, metadata: parsed.metadata },
    classification: parsed.classification,
    fileId: fileRecord.id,
  });

  return NextResponse.json({ ok: true, fileId: fileRecord.id, preview });
}
