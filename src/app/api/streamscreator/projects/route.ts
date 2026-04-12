import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createProject } from '@/lib/streamscreator/repository/projects-repository';
const CreateProjectSchema = z.object({ name: z.string().min(1), description: z.string().optional(), status: z.enum(['pending','active','completed','failed']).optional(), metadata: z.record(z.unknown()).optional() });
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }, { status: 400 }); }
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'Invalid request body', detail: parsed.error.flatten() } }, { status: 422 });
  const result = await createProject(parsed.data);
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: result.error.code === 'PROJECT_NOT_FOUND' ? 404 : 500 });
  return NextResponse.json({ data: result.data }, { status: 201 });
}
