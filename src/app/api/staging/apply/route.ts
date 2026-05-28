import { NextRequest, NextResponse } from 'next/server'
import { readRepoFile, writeRepoFile } from '@/lib/github'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { owner = 'hawk7227', repo = 'streamsai-editor', branch = 'main', path, content, message } = body
    if (!path || typeof content !== 'string') return NextResponse.json({ error: 'path and content required' }, { status: 400 })
    const current = await readRepoFile(owner, repo, branch, path)
    const result = await writeRepoFile(owner, repo, branch, path, content, message || `Apply staged change to ${path}`, current.sha)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
