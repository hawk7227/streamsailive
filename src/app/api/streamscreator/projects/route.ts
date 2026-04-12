import { NextRequest, NextResponse } from 'next/server';
import { createProject } from '@/lib/streamscreator/repository/projects-repository';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }, { status: 400 }); }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'name is required and must be a non-empty string' } }, { status: 422 });
  }

  const validStatuses = ['pending', 'active', 'completed', 'failed'] as const;
  type ProjectStatus = typeof validStatuses[number];
  if (body.status !== undefined && !validStatuses.includes(body.status as ProjectStatus)) {
    return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'status must be one of: pending, active, completed, failed' } }, { status: 422 });
  }

  const result = await createProject({
    name: body.name.trim(),
    description: typeof body.description === 'string' ? body.description : undefined,
    status: body.status as ProjectStatus | undefined,
    metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : undefined,
  });

  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: result.error.code === 'PROJECT_NOT_FOUND' ? 404 : 500 });
  return NextResponse.json({ data: result.data }, { status: 201 });
}
