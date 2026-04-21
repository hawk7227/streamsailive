
import { NextRequest } from 'next/server'
import { runOrchestrator } from '@/lib/assistant-core/orchestrator'

// gpt-image-1 generation takes 20–40s. Without this, Vercel kills the
// function at the default 10s limit and the client sees a timeout error.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  return runOrchestrator(req)
}
