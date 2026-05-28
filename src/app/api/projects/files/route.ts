import { NextRequest, NextResponse } from 'next/server'
import { listRepoFiles } from '@/lib/github'
export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const owner = searchParams.get('owner') || 'hawk7227'
    const repo = searchParams.get('repo') || 'streamsai-editor'
    const branch = searchParams.get('branch') || 'main'
    const files = await listRepoFiles(owner, repo, branch)
    return NextResponse.json({ files })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
