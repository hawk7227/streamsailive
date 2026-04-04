
import { NextRequest } from 'next/server'
import { runOrchestrator } from '@/lib/assistant-core/orchestrator'

export async function POST(req: NextRequest) {
  return runOrchestrator(req)
}
