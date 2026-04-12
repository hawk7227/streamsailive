import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/streamscreator/repository/jobs-repository';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }, { status: 400 }); }
  if (!body.project_id || typeof body.project_id !== 'string') return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'project_id is required' } }, { status: 422 });
  if (!body.type || typeof body.type !== 'string') return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'type is required' } }, { status: 422 });
  const result = await createJob({ project_id: body.project_id, type: body.type, phase: typeof body.phase === 'string' ? body.phase : undefined, progress: typeof body.progress === 'number' ? body.progress : undefined });
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.data }, { status: 201 });
}
