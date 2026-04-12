import { NextRequest, NextResponse } from 'next/server';
import { createProviderRun } from '@/lib/streamscreator/repository/provider-runs-repository';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }, { status: 400 }); }
  if (!body.job_id || typeof body.job_id !== 'string') return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'job_id is required' } }, { status: 422 });
  if (!body.provider || typeof body.provider !== 'string') return NextResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'provider is required' } }, { status: 422 });
  const result = await createProviderRun({ job_id: body.job_id, provider: body.provider, status: typeof body.status === 'string' ? body.status : undefined, request_ref: typeof body.request_ref === 'string' ? body.request_ref : undefined, response_ref: typeof body.response_ref === 'string' ? body.response_ref : undefined });
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.data }, { status: 201 });
}
