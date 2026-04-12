import { NextRequest, NextResponse } from 'next/server';
import { listJobEventsByJobId } from '@/lib/streamscreator/repository/job-events-repository';

interface RouteContext { params: Promise<{ jobId: string }>; }

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { jobId } = await params;
  if (!jobId || typeof jobId !== 'string') return NextResponse.json({ error: { code: 'INVALID_PARAM', message: 'jobId is required' } }, { status: 400 });
  const result = await listJobEventsByJobId(jobId);
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.data }, { status: 200 });
}
