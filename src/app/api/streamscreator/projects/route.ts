import { NextRequest, NextResponse } from 'next/server';
import { createProject } from '@/lib/streamscreator/repository/projects-repository';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }, { status: 400 }); }
  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'name is required' } }, { status: 422 });
  }
  const result = await createProject({
    name: body.name.trim(),
    mode: typeof body.mode === 'string' ? body.mode : undefined,
    status: typeof body.status === 'string' ? body.status : undefined,
  });
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: result.error.code === 'PROJECT_NOT_FOUND' ? 404 : 500 });
  return NextResponse.json({ data: result.data }, { status: 201 });
}
