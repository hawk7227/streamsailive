import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/streamscreator/job-state/job-state-service';

interface RouteContext { params: Promise<{ jobId: string }>; }

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { jobId } = await params;
  if (!jobId || typeof jobId !== 'string') return NextResponse.json({ error: { code: 'INVALID_PARAM', message: 'jobId is required' } }, { status: 400 });
  const result = await getJobStatus(jobId);
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: result.error.code === 'JOB_NOT_FOUND' ? 404 : 500 });
  return NextResponse.json({ data: { id: result.data.id, phase: result.data.phase, progress: result.data.progress, error: result.data.error } }, { status: 200 });
}
