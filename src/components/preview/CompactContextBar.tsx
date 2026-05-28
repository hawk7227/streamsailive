"use client"
import type { ActiveProject } from '@/lib/project-config'
export function CompactContextBar({ project, previewMode, deviceLabel }: { project: ActiveProject; previewMode: string; deviceLabel: string }) {
  return <div style={{ height: 30, display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden', whiteSpace: 'nowrap', padding: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#04060d', color: 'rgba(239,244,255,0.82)', fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}><span>Project <strong>{project.name}</strong></span><span>Branch <strong>{project.branch}</strong></span><span>File <strong>{project.currentFile}</strong></span><span>Preview <strong>{previewMode}</strong></span><span>Device <strong>{deviceLabel}</strong></span></div>
}
