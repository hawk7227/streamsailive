import { NextRequest, NextResponse } from 'next/server'
import { readRepoFile } from '@/lib/github'
export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const owner = searchParams.get('owner') || 'hawk7227'
    const repo = searchParams.get('repo') || 'streamsai-editor'
    const branch = searchParams.get('branch') || 'main'
    const path = searchParams.get('path')
    if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })
    return NextResponse.json(await readRepoFile(owner, repo, branch, path))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
