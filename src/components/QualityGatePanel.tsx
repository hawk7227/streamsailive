'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildHonestFeedback, emptyGateStatuses, isTextLikeFile, type AuditReport, type AuditedFile, type GateStatus } from '@/lib/quality-gate'

type QueueFile = AuditedFile & {
  raw?: File
  progress: number
}

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

const PROMPTS = [
  'What failed?',
  'What blocks release?',
  'Does this feel premium?',
  'What should dev fix first?',
]

export default function QualityGatePanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)

  const [queue, setQueue] = useState<QueueFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [gateStatuses, setGateStatuses] = useState<GateStatus[]>(emptyGateStatuses())
  const [report, setReport] = useState<AuditReport | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [statusText, setStatusText] = useState('Drop files, folders, or a zip export. The gate will audit structure, code quality, mobile behavior, reliability, and release readiness.')
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Drop files, folders, or a zip export here. I will audit them and tell you bluntly what blocks shipping.',
    },
  ])

  const selectedFile = useMemo(() => {
    const fromQueue = queue.find((file) => file.id === selectedFileId)
    const fromReport = report?.files.find((file) => file.id === selectedFileId)
    return fromQueue || fromReport || report?.files?.[0] || queue[0] || null
  }, [queue, report, selectedFileId])

  const handlePickFiles = useCallback(() => fileInputRef.current?.click(), [])
  const handlePickFolder = useCallback(() => folderInputRef.current?.click(), [])

  const updateQueueStatus = useCallback((status: QueueFile['status'], progress: number) => {
    setQueue((prev) => prev.map((file) => ({ ...file, status, progress })))
  }, [])

  const ingestFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return

    const nextItems: QueueFile[] = []
    for (let index = 0; index < list.length; index += 1) {
      const file = list[index]
      const preview = isTextLikeFile(file.webkitRelativePath || file.name, file.type) ? (await safeReadText(file)).slice(0, 100_000) : ''
      nextItems.push({
        id: `${file.name}-${file.size}-${Date.now()}-${index}`,
        name: file.webkitRelativePath || file.name,
        size: file.size,
        type: file.type,
        textPreview: preview,
        score: 0,
        status: 'queued',
        issues: [],
        progress: 0,
        raw: file,
      })
    }

    setQueue(nextItems)
    setSelectedFileId(nextItems[0]?.id || null)
    setReport(null)
    setUploadId(null)
    setRunId(null)
    setGateStatuses(emptyGateStatuses())
    setStatusText(`${nextItems.length} file${nextItems.length === 1 ? '' : 's'} ready. Upload when you are ready to audit.`)
  }, [])

  const clearAll = useCallback(() => {
    setQueue([])
    setReport(null)
    setSelectedFileId(null)
    setUploadId(null)
    setRunId(null)
    setIsRunning(false)
    setIsUploading(false)
    setGateStatuses(emptyGateStatuses())
    setStatusText('Nothing uploaded yet.')
  }, [])

  const pollStatus = useCallback((nextRunId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      const res = await fetch(`/api/quality-gate/status?runId=${encodeURIComponent(nextRunId)}`)
      if (!res.ok) return
      const data = await res.json() as { status: string; gateStatuses: GateStatus[]; report: AuditReport | null; error: string | null }
      setGateStatuses(data.gateStatuses || emptyGateStatuses())
      if (data.report) {
        setReport(data.report)
        setQueue((prev) => prev.map((file) => {
          const audited = data.report?.files.find((entry) => entry.name === file.name || entry.id === file.id)
          return audited ? { ...file, ...audited, raw: file.raw, progress: 100 } : file
        }))
      }
      if (data.status === 'completed') {
        setIsRunning(false)
        updateQueueStatus('complete', 100)
        setStatusText('Audit complete. Review blockers and ask AI for the blunt readout.')
        if (data.report) {
          setChat((prev) => {
            const next = [...prev]
            next.push({ role: 'assistant', text: buildHonestFeedback(data.report) })
            return next
          })
        }
        if (pollRef.current) {
          window.clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
      if (data.status === 'failed') {
        setIsRunning(false)
        setStatusText(data.error || 'Audit failed.')
        updateQueueStatus('failed', 100)
        if (pollRef.current) {
          window.clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    }, 700)
  }, [updateQueueStatus])

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current)
  }, [])

  const runAudit = useCallback(async () => {
    if (!queue.length || isUploading || isRunning) return
    setIsUploading(true)
    setStatusText('Uploading build to the Quality Gate…')
    updateQueueStatus('hashing', 12)

    try {
      const formData = new FormData()
      queue.forEach((file) => {
        if (file.raw) formData.append('files', file.raw, file.name)
      })
      const uploadRes = await fetch('/api/quality-gate/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json() as { uploadId?: string; error?: string }
      if (!uploadRes.ok || !uploadData.uploadId) {
        throw new Error(uploadData.error || 'Upload failed')
      }
      setUploadId(uploadData.uploadId)
      setStatusText('Upload complete. Starting audit engine…')
      updateQueueStatus('scanning', 30)

      const runRes = await fetch('/api/quality-gate/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: uploadData.uploadId }),
      })
      const runData = await runRes.json() as { runId?: string; error?: string; gateStatuses?: GateStatus[] }
      if (!runRes.ok || !runData.runId) {
        throw new Error(runData.error || 'Unable to start audit')
      }
      setRunId(runData.runId)
      setGateStatuses(runData.gateStatuses || emptyGateStatuses())
      setIsRunning(true)
      setStatusText('Audit running. Watching pipeline…')
      updateQueueStatus('testing', 54)
      pollStatus(runData.runId)
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Audit failed')
      updateQueueStatus('failed', 100)
      setIsRunning(false)
    } finally {
      setIsUploading(false)
    }
  }, [isRunning, isUploading, pollStatus, queue, updateQueueStatus])

  const askAI = useCallback(async (preset?: string) => {
    const prompt = (preset || chatInput).trim()
    if (!prompt || !report || chatBusy) return
    setChat((prev) => [...prev, { role: 'user', text: prompt }])
    setChatInput('')
    setChatBusy(true)
    try {
      const res = await fetch('/api/quality-gate/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, report }),
      })
      const data = await res.json() as { reply?: string }
      setChat((prev) => [...prev, { role: 'assistant', text: data.reply || 'The reviewer is unavailable right now.' }])
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', text: buildHonestFeedback(report, prompt) }])
    } finally {
      setChatBusy(false)
    }
  }, [chatBusy, chatInput, report])

  const summaryCards = useMemo(() => {
    if (!report) return []
    return [
      { label: 'Overall Score', value: String(report.summary.overallScore) },
      { label: 'Release', value: report.summary.releaseStatus.toUpperCase() },
      { label: 'Critical', value: String(report.summary.criticalIssues) },
      { label: 'Warnings', value: String(report.summary.warnings) },
      { label: 'CI', value: report.summary.ciReady ? 'READY' : 'MISSING' },
      { label: 'Files', value: String(report.summary.filesAudited) },
    ]
  }, [report])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr 0.95fr', height: '100%', background: '#090b10' }}>
      <div style={paneStyle}>
        <SectionTitle title="Submission" subtitle="Drop builds, folders, and source files" />
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            void ingestFiles(e.dataTransfer.files)
          }}
          onClick={handlePickFiles}
          style={{
            border: `1px dashed ${isDragging ? 'rgba(111, 236, 208, 0.8)' : 'rgba(255,255,255,0.14)'}`,
            borderRadius: 18,
            minHeight: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 10,
            background: isDragging ? 'rgba(111,236,208,0.08)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'all 140ms ease',
            padding: 20,
          }}
        >
          <div style={pillStyle}>AI Coder Submission Gate</div>
          <div style={{ color: '#f5f7fb', fontSize: 20, fontWeight: 600, textAlign: 'center' }}>Drop files, folders, or a zip export</div>
          <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 13, textAlign: 'center', maxWidth: 360 }}>{statusText}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={primaryButtonStyle} onClick={(e) => { e.stopPropagation(); handlePickFiles(); }}>{isUploading ? 'Uploading…' : 'Choose files'}</button>
            <button style={secondaryButtonStyle} onClick={(e) => { e.stopPropagation(); handlePickFolder(); }}>Choose folder</button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files) void ingestFiles(e.target.files) }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: '' } as Record<string, string>)}
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files) void ingestFiles(e.target.files) }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button style={primaryButtonStyle} onClick={() => void runAudit()} disabled={!queue.length || isRunning || isUploading}>{isRunning ? 'Running…' : 'Run check'}</button>
          <button style={secondaryButtonStyle} onClick={clearAll}>Clear</button>
        </div>

        <div style={{ marginTop: 12, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ color: '#f4f7fb', fontSize: 13, fontWeight: 700 }}>Run State</div>
          <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12, marginTop: 6 }}>
            Upload ID: {uploadId || '—'}<br />
            Run ID: {runId || '—'}<br />
            Mode: local audit engine + optional OpenAI review
          </div>
        </div>

        <SectionTitle title="Upload Queue" subtitle={`${queue.length} item${queue.length === 1 ? '' : 's'}`} />
        <div style={listStyle}>
          {queue.length === 0 ? (
            <EmptyHint text="Nothing uploaded yet." />
          ) : queue.map((file) => (
            <button key={file.id} onClick={() => setSelectedFileId(file.id)} style={{
              ...rowButtonStyle,
              background: selectedFileId === file.id ? 'rgba(111,236,208,0.08)' : 'transparent',
              borderColor: selectedFileId === file.id ? 'rgba(111,236,208,0.24)' : 'rgba(255,255,255,0.06)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#f2f4f8', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 4 }}>{formatBytes(file.size)} • {file.status}</div>
                <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ width: `${file.progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #4bd8b8, #74d5ff)' }} />
                </div>
              </div>
              <StatusBadge status={file.status} />
            </button>
          ))}
        </div>
      </div>

      <div style={paneStyle}>
        <SectionTitle title="Live Check Pipeline" subtitle="Everything must pass before release" />
        <div style={{ display: 'grid', gap: 10 }}>
          {gateStatuses.map((gate) => (
            <div key={gate.key} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.025)',
            }}>
              <div>
                <div style={{ color: '#f3f4f8', fontSize: 14, fontWeight: 600 }}>{gate.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: 11, marginTop: 4 }}>{gate.issues ? `${gate.issues} issue${gate.issues === 1 ? '' : 's'}` : gate.stage === 'running' ? 'Running…' : 'Waiting'}</div>
              </div>
              <div style={{ minWidth: 90, textAlign: 'right' }}>
                <div style={{ color: gate.stage === 'failed' ? '#ff8f7a' : gate.stage === 'passed' ? '#7ff0b7' : gate.stage === 'running' ? '#74d5ff' : 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>{gate.stage.toUpperCase()}</div>
                <div style={{ color: 'rgba(255,255,255,0.44)', fontSize: 11, marginTop: 4 }}>{gate.score ?? '—'}</div>
              </div>
            </div>
          ))}
        </div>

        <SectionTitle title="Release Score" subtitle="Blunt summary" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
          {summaryCards.length === 0 ? <EmptyHint text="Run an audit to see scoring." /> : summaryCards.map((card) => (
            <div key={card.label} style={scoreCardStyle}>
              <div style={{ color: 'rgba(255,255,255,0.54)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.label}</div>
              <div style={{ color: '#f4f6fb', fontSize: 24, fontWeight: 700, marginTop: 8 }}>{card.value}</div>
            </div>
          ))}
        </div>

        <SectionTitle title="File Review" subtitle={selectedFile?.name || 'Select a file'} />
        <div style={listStyle}>
          {!selectedFile ? <EmptyHint text="Select a file to inspect issues." /> : (
            <>
              <div style={{ color: '#f4f7fb', fontWeight: 700, fontSize: 14 }}>{selectedFile.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Score {selectedFile.score || '—'} • {formatBytes(selectedFile.size)}</div>
              {(selectedFile.issues || []).length === 0 ? (
                <EmptyHint text="No file-specific issues detected." />
              ) : selectedFile.issues.map((issue) => (
                <div key={issue.id} style={issueCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ color: '#f4f7fb', fontWeight: 700, fontSize: 13 }}>{issue.title}</div>
                    <div style={{ color: issue.severity === 'critical' ? '#ff8f7a' : issue.severity === 'warning' ? '#ffd37a' : '#8fdcff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{issue.severity}</div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 6 }}>{issue.detail}</div>
                  <div style={{ color: '#7ff0b7', fontSize: 12, marginTop: 8 }}>{issue.fix}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div style={paneStyle}>
        <SectionTitle title="AI Review" subtitle="Honest mode is always on" />
        <div style={{ ...listStyle, minHeight: 260, maxHeight: 420 }}>
          {chat.map((message, index) => (
            <div key={`${message.role}-${index}`} style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'stretch',
              background: message.role === 'user' ? 'rgba(111,236,208,0.1)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 18,
              padding: '12px 14px',
              color: '#f3f5fa',
              lineHeight: 1.55,
              fontSize: 14,
            }}>{message.text}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {PROMPTS.map((prompt) => (
            <button key={prompt} style={promptButtonStyle} onClick={() => void askAI(prompt)} disabled={!report || chatBusy}>{prompt}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginTop: 12 }}>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask for honest feedback on the uploaded build…"
            style={{
              minHeight: 126,
              resize: 'vertical',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: '#f5f7fb',
              padding: 16,
              fontSize: 15,
              outline: 'none',
            }}
          />
          <button style={{ ...primaryButtonStyle, minWidth: 110 }} onClick={() => void askAI()} disabled={!report || chatBusy || !chatInput.trim()}>{chatBusy ? 'Thinking…' : 'Ask AI'}</button>
        </div>
      </div>
    </div>
  )
}

async function safeReadText(file: File): Promise<string> {
  try {
    return await file.text()
  } catch {
    return ''
  }
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: '#f4f6fb', fontSize: 16, fontWeight: 700 }}>{title}</div>
      <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12, marginTop: 4 }}>{subtitle}</div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: 12 }}>{text}</div>
}

function StatusBadge({ status }: { status: QueueFile['status'] }) {
  const tone = status === 'failed' ? '#ff8f7a' : status === 'complete' ? '#7ff0b7' : '#74d5ff'
  return <div style={{ color: tone, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{status}</div>
}

const paneStyle: React.CSSProperties = {
  padding: 18,
  overflow: 'auto',
  borderLeft: '1px solid rgba(255,255,255,0.06)',
}

const primaryButtonStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(74,219,185,0.22), rgba(74,219,185,0.12))',
  color: '#f7fafc',
  border: '1px solid rgba(111,236,208,0.34)',
  borderRadius: 16,
  padding: '12px 18px',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  color: '#eff3f8',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: '12px 18px',
  fontWeight: 700,
  cursor: 'pointer',
}

const promptButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  textAlign: 'left',
}

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(111,236,208,0.22)',
  background: 'rgba(111,236,208,0.08)',
  color: '#8ef0d0',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.02)',
  padding: 12,
  marginTop: 12,
}

const rowButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  width: '100%',
  textAlign: 'left',
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'transparent',
  cursor: 'pointer',
}

const scoreCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.025)',
  padding: 14,
}

const issueCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.025)',
  padding: 12,
}
