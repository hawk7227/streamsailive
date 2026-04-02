
async function runServerPipeline(prompt: string) {
  const res = await fetch('/api/pipeline/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Pipeline failed: ${text}`)
  }

  return res.json()
}

// usage example
export default function Page() {
  async function handleRun() {
    await runServerPipeline("test prompt")
  }

  return <button onClick={handleRun}>Run Pipeline</button>
}
