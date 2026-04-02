// src/app/pipeline/test/PipelineTestClient.tsx
'use client'

import React from 'react'

export default function PipelineTestClient() {
  return (
    <div style={{ padding: 20 }}>
      <h2>Pipeline Test</h2>
      <button onClick={() => alert('Test click working')}>
        Run Test Action
      </button>
    </div>
  )
}
