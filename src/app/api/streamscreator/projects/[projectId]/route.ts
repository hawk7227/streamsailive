import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/streamscreator/repository/projects-repository';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/streamscreator/projects/[projectId]
//
// Fetches a single row from streams.projects by primary key.
// Returns 404 when the row does not exist; 500 on Supabase error.
// ─────────────────────────────────────────────────────────────────────────────

interface RouteContext {
  params: { projectId: string };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { projectId } = params;

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json(
      { error: { code: 'INVALID_PARAM', message: 'projectId is required' } },
      { status: 400 },
    );
  }

  const result = await getProjectById(projectId);

  if (result.error !== null) {
    const statusCode = result.error.code === 'PROJECT_NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json({ data: result.data }, { status: 200 });
}
