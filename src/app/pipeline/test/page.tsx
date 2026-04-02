// src/app/pipeline/test/page.tsx
import dynamic from 'next/dynamic'

export const dynamic = 'force-dynamic'

const Client = dynamic(() => import('./PipelineTestClient'), { ssr: false })

export default function Page() {
  return <Client />
}
