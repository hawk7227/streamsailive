
import 'server-only'

export async function runPipeline(input: Record<string, unknown>) {
  return { status: 'ok', input }
}
