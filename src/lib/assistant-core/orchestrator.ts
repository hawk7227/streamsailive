
import { NextRequest } from 'next/server'
import { client } from './openai'

export async function runOrchestrator(req: NextRequest) {
  const body = await req.json()
  const response = await client.responses.create({
    model: 'gpt-4.1',
    input: body.messages
  })

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' }
  })
}
