import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';
import { validateMime } from '@/lib/files/parser';
import { orchestrateFileUpload } from '@/lib/files/uploadOrchestrator';

const MAX_SIZE = 100 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: `File too large. Max ${MAX_SIZE / 1024 / 1024}MB allowed.` }, { status: 413 });
  }

  const mimeCheck = validateMime(file.type, file.name);
  if (!mimeCheck.valid) {
    return NextResponse.json({ error: mimeCheck.reason }, { status: 415 });
  }

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = selection.current.workspace.id;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workspace error' }, { status: 500 });
  }

  try {
    const result = await orchestrateFileUpload({
      workspaceId,
      userId: user.id,
      file,
      source: 'api',
      purpose: 'knowledge_base',
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}
