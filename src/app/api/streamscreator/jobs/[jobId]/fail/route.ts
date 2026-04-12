import { NextRequest, NextResponse } from 'next/server';
import { markJobFailed } from '@/lib/streamscreator/job-state/job-state-service';
interface RouteContext { params: Promise<{ jobId: string }>; }
export async function POST(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { jobId } = await params;
  if (!jobId) return NextResponse.json({ error: { code: 'INVALID_PARAM', message: 'jobId is required' } }, { status: 400 });
  let body: Record<string, unknown> = {};
  try { body = await _request.json(); } catch { /* reason optional */ }
  const reason = typeof body.reason === 'string' ? body.reason : 'Job failed';
  const result = await markJobFailed(jobId, reason);
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.data }, { status: 200 });
}
