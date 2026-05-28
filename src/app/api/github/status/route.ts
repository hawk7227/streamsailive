import { NextRequest } from 'next/server'
import { getConnectionStatus } from '@/lib/github'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(req: NextRequest): Promise<Response> {
  const adminKey = process.env.SYSTEM_STATUS_KEY
  const provided = req.headers.get('x-admin-key') ?? req.nextUrl.searchParams.get('key')
  if (adminKey && provided !== adminKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const status = await getConnectionStatus()

  return new Response(JSON.stringify(status), {
    status: status.connected ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  })
}
