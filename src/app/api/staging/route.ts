import { NextRequest, NextResponse } from 'next/server'
import { readRepoFile } from '@/lib/github'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { owner = 'hawk7227', repo = 'streamsai-editor', branch = 'main', path, nextContent, language = 'html', source = 'manual' } = body
    if (!path || typeof nextContent !== 'string') return NextResponse.json({ error: 'path and nextContent required' }, { status: 400 })
    const current = await readRepoFile(owner, repo, branch, path)
    return NextResponse.json({ staged: { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, owner, repo, branch, path, originalContent: current.content, nextContent, language, createdAt: Date.now(), source } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
