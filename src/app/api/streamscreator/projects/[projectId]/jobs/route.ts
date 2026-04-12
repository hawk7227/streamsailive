import { NextRequest, NextResponse } from 'next/server';
import { listJobsByProjectId } from '@/lib/streamscreator/repository/jobs-repository';

interface RouteContext { params: Promise<{ projectId: string }>; }

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { projectId } = await params;
  if (!projectId || typeof projectId !== 'string') return NextResponse.json({ error: { code: 'INVALID_PARAM', message: 'projectId is required' } }, { status: 400 });
  const result = await listJobsByProjectId(projectId);
  if (result.error !== null) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.data }, { status: 200 });
}
