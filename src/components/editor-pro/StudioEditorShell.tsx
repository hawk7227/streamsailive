"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import QualityGatePanel from '@/components/QualityGatePanel'
import { ToolRail } from '@/components/tool-rail/ToolRail'
import { CompactContextBar } from '@/components/preview/CompactContextBar'
import { PreviewSurface, type PreviewPayload } from '@/components/preview/PreviewSurface'
import { DEFAULT_PROJECT, loadActiveProject, saveActiveProject, type ActiveProject } from '@/lib/project-config'
import { clearStagedChange, loadStagedChanges, stageChange, type StagedChange } from '@/lib/staging'

const MOBILE_CHAT_URL =
  (process.env.NEXT_PUBLIC_MOBILE_CHAT_URL || '').replace(/\/$/, '') ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://streamsai-editor-mobile-chat.vercel.app')

const HANDLE_HIT = 8

type DeviceKey = 'desktop' | 'iphone'
type RightView = 'editor' | 'quality'
type ToolKey = 'new-chat' | 'search' | 'images' | 'apps' | 'research' | 'codex' | 'models' | 'projects' | 'files' | 'uploads' | 'artifacts' | 'settings'

export default function StudioEditorShell() {
  const [leftW, setLeftW] = useState(() => {
    const v = numberPref('studio:leftW', 380)
    return v < 200 ? 380 : v  // reset if collapsed to unusable width
  })
  const [centerW, setCenterW] = useState(() => {
    const v = numberPref('studio:centerW', 640)
    return v < 200 ? 640 : v
  })
  const [leftOpen, setLeftOpen] = useState(false)  // collapsed by default — MediaEditor in center
  const [centerOpen, setCenterOpen] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [activeHandle, setActiveHandle] = useState<'left-right' | 'center-right' | null>(null)
  const [rightView, setRightView] = useState<RightView>(() => (typeof window === 'undefined' ? 'editor' : (window.localStorage.getItem('studio:rightView') as RightView) || 'editor'))
  const [toolExpanded, setToolExpanded] = useState(() => boolPref('studio:toolExpanded', false))
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null)
  const [project, setProject] = useState<ActiveProject>(() => loadActiveProject())
  const [files, setFiles] = useState<string[]>([])
  const [fileContent, setFileContent] = useState('')
  const [preview, setPreview] = useState<PreviewPayload>({ mode: 'route', route: loadActiveProject().previewTarget || '/preview' })
  const [device, setDevice] = useState<DeviceKey>(() => (typeof window === 'undefined' ? 'desktop' : ((window.localStorage.getItem('studio:device') as DeviceKey) || 'desktop')))
  const [safeZone, setSafeZone] = useState(() => boolPref('studio:safeZone', false))
  const [staged, setStaged] = useState<StagedChange[]>(() => loadStagedChanges())
  const dragState = useRef<{ handle: 'left-right' | 'center-right'; startX: number; startLeft: number; startCenter: number } | null>(null)
  const chatIframeRef = useRef<HTMLIFrameElement>(null)
  const [threadList, setThreadList] = useState<{ id: string; title: string; model: string; updatedAt: number }[]>([])

  const handleNewChat = useCallback(() => {
    chatIframeRef.current?.contentWindow?.postMessage({ type: 'streamsai:new-chat' }, '*')
    setActiveTool(null)
  }, [])

  const handleThreadSelect = useCallback((id: string) => {
    chatIframeRef.current?.contentWindow?.postMessage({ type: 'streamsai:select-thread', id }, '*')
    setActiveTool(null)
  }, [])

  const handleModelSelect = useCallback((model: string) => {
    chatIframeRef.current?.contentWindow?.postMessage({ type: 'streamsai:set-model', model }, '*')
    setActiveTool(null)
  }, [])

  const handleProjectSelect = useCallback(async (p: { name: string; owner: string; repo: string; branch: string }) => {
    const next = { ...project, name: p.name, owner: p.owner, repo: p.repo, branch: p.branch, currentFile: 'README.md' }
    setProject(next)
    setActiveTool(null)
    // Reload file tree for new project
    const res = await fetch(`/api/projects/files?owner=${encodeURIComponent(p.owner)}&repo=${encodeURIComponent(p.repo)}&branch=${encodeURIComponent(p.branch)}`)
    const json = await res.json() as { files?: string[] }
    if (json.files) setFiles(json.files)
  }, [project])

  useEffect(() => save('studio:leftW', leftW), [leftW])
  useEffect(() => save('studio:centerW', centerW), [centerW])
  useEffect(() => save('studio:leftOpen', leftOpen), [leftOpen])
  useEffect(() => save('studio:centerOpen', centerOpen), [centerOpen])
  useEffect(() => save('studio:rightView', rightView), [rightView])
  useEffect(() => save('studio:toolExpanded', toolExpanded), [toolExpanded])
  useEffect(() => save('studio:device', device), [device])
  useEffect(() => save('studio:safeZone', safeZone), [safeZone])
  useEffect(() => saveActiveProject(project), [project])

  const actualLeft = leftOpen ? leftW : 0
  const actualCenter = centerOpen ? centerW : 0

  const loadFiles = useCallback(async () => {
    const res = await fetch(`/api/projects/files?owner=${encodeURIComponent(project.owner)}&repo=${encodeURIComponent(project.repo)}&branch=${encodeURIComponent(project.branch)}`)
    const json = await res.json()
    if (json.files) setFiles(json.files)
  }, [project])

  const openFile = useCallback(async (path: string) => {
    const res = await fetch(`/api/projects/file?owner=${encodeURIComponent(project.owner)}&repo=${encodeURIComponent(project.repo)}&branch=${encodeURIComponent(project.branch)}&path=${encodeURIComponent(path)}`)
    const json = await res.json()
    if (json.content) {
      setProject((prev) => ({ ...prev, currentFile: path }))
      setFileContent(json.content)
    }
  }, [project])

  useEffect(() => {
    void loadFiles()
    void openFile(project.currentFile || DEFAULT_PROJECT.currentFile)
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragState.current) return
      e.preventDefault()
      const dx = e.clientX - dragState.current.startX
      const maxW = typeof window !== 'undefined' ? window.innerWidth - 400 : 1200
      if (dragState.current.handle === 'left-right') setLeftW(Math.min(maxW, Math.max(260, dragState.current.startLeft + dx)))
      else setCenterW(Math.min(maxW, Math.max(320, dragState.current.startCenter + dx)))
    }
    const onUp = () => {
      dragState.current = null
      setIsDragging(false)
      setActiveHandle(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'streamsai:thread-list' && Array.isArray(data.threads)) {
        setThreadList(data.threads)
      }
      if (data.type === 'streamsai:preview-html' && typeof data.html === 'string') {
        setPreview({ mode: 'html', html: data.html, title: data.title })
      }
      if (data.type === 'streamsai:preview-code' && typeof data.code === 'string') {
        setPreview({ mode: 'code', code: data.code, language: data.language || 'tsx', title: data.title })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const stageCurrentPreview = useCallback(async () => {
    if (preview.mode !== 'html' && preview.mode !== 'code') return
    const nextContent = preview.mode === 'html' ? preview.html : preview.code
    const language = preview.mode === 'html' ? 'html' : preview.language
    const res = await fetch('/api/staging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: project.owner, repo: project.repo, branch: project.branch, path: project.currentFile, nextContent, language, source: 'chat-code' }),
    })
    const json = await res.json()
    if (json.staged) {
      stageChange(json.staged)
      setStaged(loadStagedChanges())
      setPreview({ mode: 'diff', staged: json.staged })
    }
  }, [preview, project])

  const applyStage = useCallback(async () => {
    if (preview.mode !== 'diff') return
    const res = await fetch('/api/staging/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: preview.staged.owner, repo: preview.staged.repo, branch: preview.staged.branch, path: preview.staged.path, content: preview.staged.nextContent, message: `Apply staged change to ${preview.staged.path}` }),
    })
    const json = await res.json()
    if (json.ok) {
      clearStagedChange(preview.staged.id)
      setStaged(loadStagedChanges())
      setFileContent(preview.staged.nextContent)
      setPreview({ mode: 'route', route: project.previewTarget || '/preview' })
    }
  }, [preview, project.previewTarget])

  const discardStage = useCallback(() => {
    if (preview.mode !== 'diff') return
    clearStagedChange(preview.staged.id)
    setStaged(loadStagedChanges())
    setPreview({ mode: 'route', route: project.previewTarget || '/preview' })
  }, [preview, project.previewTarget])

  const onUpload = useCallback(async (file: File) => {
    const text = await file.text()
    setPreview({ mode: 'doc', content: text, title: file.name })
  }, [])

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', background: '#02050b', overflow: 'hidden', userSelect: isDragging ? 'none' : 'auto', cursor: isDragging ? 'col-resize' : 'default' }}>
      {isDragging && <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize' }} />}
      <ToolRail
        expanded={toolExpanded}
        onToggle={() => setToolExpanded((v) => !v)}
        activeTool={activeTool}
        onTool={(tool) => setActiveTool((prev) => (prev === tool ? null : tool))}
        files={files}
        currentFile={project.currentFile}
        onSelectFile={(path) => void openFile(path)}
        onUpload={onUpload}
        onNewChat={handleNewChat}
        threadList={threadList}
        onThreadSelect={handleThreadSelect}
        onModelSelect={handleModelSelect}
        onProjectSelect={handleProjectSelect}
        activeProjectName={project.name}
      />
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
        <CompactContextBar project={project} previewMode={preview.mode === 'route' ? preview.route : preview.mode} deviceLabel={device === 'iphone' ? 'iPhone 14 Pro Max' : 'Desktop'} />
        <div style={{ display: 'flex', minHeight: 0, flex: 1, height: '100%' }}>
          <div style={{ width: actualLeft, flexShrink: 0, overflow: 'hidden', transition: isDragging ? 'none' : 'width 160ms cubic-bezier(.4,0,.2,1)' }}>
            <PanelShell title="Chat" onCollapse={() => setLeftOpen(false)}>
              <iframe ref={chatIframeRef} src={MOBILE_CHAT_URL} title="StreamsAI Chat" allow="clipboard-write; clipboard-read" style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
            </PanelShell>
          </div>
          <ResizeHandle onPointerDown={(e) => startDrag(e, 'left-right', leftW, centerW, dragState, setIsDragging, setActiveHandle)} active={activeHandle === 'left-right'} />
          <div style={{ width: actualCenter, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', transition: isDragging ? 'none' : 'width 160ms cubic-bezier(.4,0,.2,1)' }}>
            <PanelShell
              title="Media Editor"
              toolbar={<div style={{ display: 'flex', gap: 8 }}><MiniAction onClick={() => setCenterOpen((v) => !v)}>Collapse</MiniAction></div>}
              onCollapse={() => setCenterOpen(false)}
            >
              <iframe
                src="https://streamsailive.vercel.app/pipeline/test?embed=1"
                title="StreamsAI Media Editor"
                allow="clipboard-write; clipboard-read; camera; microphone"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#050816' }}
              />
            </PanelShell>
          </div>
          <ResizeHandle onPointerDown={(e) => startDrag(e, 'center-right', leftW, centerW, dragState, setIsDragging, setActiveHandle)} active={activeHandle === 'center-right'} />
          <div style={{ width: 320, flexShrink: 0, overflow: 'hidden' }}>
            <PanelShell title={<div style={{ display: 'flex', gap: 8 }}><TabChip active={rightView === 'editor'} onClick={() => setRightView('editor')} label="EditorPro" /><TabChip active={rightView === 'quality'} onClick={() => setRightView('quality')} label="Quality Gate" /></div>}>
              {rightView === 'editor'
                ? <iframe src="/editor" title="editor" style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
                : <QualityGatePanel />}
            </PanelShell>
          </div>
        </div>
      </div>
    </div>
  )
}

function PanelShell({ children, title, toolbar, onCollapse }: { children: React.ReactNode; title: React.ReactNode; toolbar?: React.ReactNode; onCollapse?: () => void }) {
  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', background: '#09101a', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#eff6ff', flexShrink: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ marginLeft: 'auto' }}>{toolbar}</div>
      {onCollapse && <button onClick={onCollapse} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 18 }}>×</button>}
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>{children}</div>
  </div>
}

function ResizeHandle({ onPointerDown, active }: { onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void; active: boolean }) {
  return <div onPointerDown={onPointerDown} style={{ width: HANDLE_HIT, cursor: 'col-resize', background: active ? 'rgba(68,195,166,0.18)' : 'transparent', position: 'relative', flexShrink: 0 }}><div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 2, background: active ? 'rgba(68,195,166,0.65)' : 'rgba(255,255,255,0.08)' }} /></div>
}
function MiniAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: 999, fontSize: 12 }}>{children}</button>
}
function TabChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ border: `1px solid ${active ? 'rgba(68,195,166,0.35)' : 'rgba(255,255,255,0.08)'}`, background: active ? 'rgba(68,195,166,0.15)' : 'rgba(255,255,255,0.04)', color: '#fff', borderRadius: 999, padding: '6px 10px', fontSize: 11 }}>{label}</button>
}
function numberPref(key: string, fallback: number) { if (typeof window === 'undefined') return fallback; const raw = window.localStorage.getItem(key); return raw ? Number(raw) : fallback }
function boolPref(key: string, fallback: boolean) { if (typeof window === 'undefined') return fallback; const raw = window.localStorage.getItem(key); return raw === null ? fallback : raw !== 'false' }
function save(key: string, value: unknown) { if (typeof window !== 'undefined') window.localStorage.setItem(key, String(value)) }
function startDrag(e: React.PointerEvent<HTMLDivElement>, handle: 'left-right' | 'center-right', leftW: number, centerW: number, dragState: React.MutableRefObject<{ handle: 'left-right' | 'center-right'; startX: number; startLeft: number; startCenter: number } | null>, setIsDragging: (value: boolean) => void, setActiveHandle: (h: 'left-right' | 'center-right' | null) => void) {
  e.preventDefault()
  dragState.current = { handle, startX: e.clientX, startLeft: leftW, startCenter: centerW }
  setIsDragging(true)
  setActiveHandle(handle)
}
