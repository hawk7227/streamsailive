import { NextRequest, NextResponse } from 'next/server';
import { createAsset } from '@/lib/streamscreator/repository/assets-repository';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }, { status: 400 }); }
  if (!body.project_id || typeof body.project_id !== 'string') return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'project_id is required' } }, { status: 422 });
  if (!body.type || typeof body.type !== 'string') return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'type is required' } }, { status: 422 });
  if (!body.storage_key || typeof body.storage_key !== 'string') return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'storage_key is required' } }, { status: 422 });
  const result = await createAsset({ project_id: body.project_id, type: body.type, storage_key: body.storage_key, mime_type: typeof body.mime_type === 'string' ? body.mime_type : undefined, provider: typeof body.provider === 'string' ? body.provider : undefined, status: typeof body.status === 'string' ? body.status : undefined });
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.data }, { status: 201 });
}
