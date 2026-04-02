
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runPipeline } from '@/lib/pipeline/pipeline-orchestrator'

export async function POST(req: Request) {
  const body = await req.json()
  const result = await runPipeline(body)
  return NextResponse.json(result)
}
