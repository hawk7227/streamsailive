"use client"
import { useEffect, useMemo, useState } from 'react'

export type ToolKey = 'new-chat' | 'search' | 'images' | 'apps' | 'research' | 'codex' | 'models' | 'projects' | 'files' | 'uploads' | 'artifacts' | 'settings'

function AppsPanel() {
  const [github, setGithub] = useState<{ connected: boolean; error?: string } | null>(null)

  useEffect(() => {
    fetch('/api/github/status')
      .then(r => r.json())
      .then((d: { connected: boolean; error?: string }) => setGithub(d))
      .catch(() => setGithub({ connected: false, error: 'Request failed' }))
  }, [])

  const StatusDot = ({ ok }: { ok: boolean | null }) => (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: ok === null ? 'rgba(255,255,255,0.2)' : ok ? '#22c55e' : '#ef4444',
      display: 'inline-block',
      boxShadow: ok ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
    }} />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Connections</div>
      {/* GitHub */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        <StatusDot ok={github === null ? null : github.connected} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: github?.connected ? '#6eecd8' : 'rgba(255,255,255,0.55)', fontWeight: 500 }}>GitHub App</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
            {github === null ? 'Checking…' : github.connected ? 'Connected — App ID 3107963' : github.error ?? 'Not connected'}
          </div>
        </div>
      </div>
      {/* Supabase */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        <StatusDot ok={false} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Supabase</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Not configured</div>
        </div>
      </div>
      {/* Vercel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        <StatusDot ok={false} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Vercel</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Not configured</div>
        </div>
      </div>
      <a href="/setup" style={{ display: 'block', padding: '8px 12px', borderRadius: 8, background: 'rgba(68,195,166,0.1)', border: '1px solid rgba(68,195,166,0.2)', color: '#6eecd8', fontSize: 12, textDecoration: 'none', textAlign: 'center', marginTop: 4 }}>
        Manage connections →
      </a>
    </div>
  )
}

type Props = {
  expanded: boolean
  onToggle(): void
  activeTool: ToolKey | null
  onTool(tool: ToolKey): void
  files: string[]
  currentFile: string
  onSelectFile(path: string): void
  onUpload(file: File): void
  onNewChat?(): void
  threadList?: { id: string; title: string; model: string; updatedAt: number }[]
  onThreadSelect?(id: string): void
  onModelSelect?(model: string): void
  onProjectSelect?(project: { name: string; owner: string; repo: string; branch: string }): void
  activeModel?: string
  activeProjectName?: string
}

type ToolDef = { key: ToolKey; icon: string; label: string; action?: boolean; dividerAfter?: boolean }

const tools: ToolDef[] = [
  { key: 'new-chat',  icon: '✎',  label: 'New chat',      action: true },
  { key: 'search',    icon: '⌕',  label: 'Search chats',  dividerAfter: true },
  { key: 'images',    icon: '⊡',  label: 'Images' },
  { key: 'apps',      icon: '⊞',  label: 'Apps' },
  { key: 'research',  icon: '⊕',  label: 'Deep research' },
  { key: 'codex',     icon: '⌥',  label: 'Codex' },
  { key: 'models',    icon: '◈',  label: 'Models',        dividerAfter: true },
  { key: 'projects',  icon: '▤',  label: 'Projects' },
  { key: 'files',     icon: '≡',  label: 'Files' },
  { key: 'uploads',   icon: '↑',  label: 'Uploads' },
  { key: 'artifacts', icon: '◇',  label: 'Artifacts',     dividerAfter: true },
  { key: 'settings',  icon: '⚙',  label: 'Settings' },
]

// Mock recent chats — will be replaced with real data from chat store
export function ToolRail(props: Props) {
  const { expanded, onToggle, activeTool, onTool, files, currentFile, onSelectFile, onUpload, onNewChat, threadList = [], onThreadSelect, onModelSelect, onProjectSelect, activeModel, activeProjectName } = props
  const [search, setSearch] = useState('')
  const [chatSearch, setChatSearch] = useState('')

  const filteredFiles = useMemo(
    () => files.filter(f => f.toLowerCase().includes(search.toLowerCase())).slice(0, 200),
    [files, search]
  )

  const handleTool = (tool: ToolDef) => {
    if (tool.key === 'new-chat') {
      onNewChat?.()
      return
    }
    if (!expanded) onToggle()
    onTool(tool.key)
  }

  return (
    <div style={{
      width: expanded ? 260 : 52,
      borderRight: '1px solid rgba(255,255,255,0.08)',
      background: '#04060f',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 160ms ease',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Toggle */}
      <button onClick={onToggle} title={expanded ? 'Collapse' : 'Expand'} style={toggleStyle}>
        {expanded ? '‹' : '›'}
      </button>

      {/* Tool items */}
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
        {tools.map(tool => {
          const active = activeTool === tool.key
          const isAction = tool.action
          return (
            <div key={tool.key}>
              <button
                onClick={() => handleTool(tool)}
                title={tool.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: expanded ? '10px 14px' : '12px 0',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  background: active ? 'rgba(68,195,166,0.12)' : 'transparent',
                  borderLeft: active ? '2px solid rgba(68,195,166,0.7)' : '2px solid transparent',
                  border: 'none',
                  color: isAction
                    ? 'rgba(255,255,255,0.85)'
                    : active
                    ? '#6eecd8'
                    : 'rgba(255,255,255,0.48)',
                  fontSize: 13,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background 120ms ease, color 120ms ease',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ fontSize: 15, minWidth: 20, textAlign: 'center', lineHeight: 1 }}>
                  {tool.icon}
                </span>
                {expanded && <span style={{ whiteSpace: 'nowrap' }}>{tool.label}</span>}
              </button>

              {tool.dividerAfter && expanded && (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              )}
            </div>
          )
        })}

        {/* Real thread list */}
        {expanded && (activeTool === 'search' || activeTool === null) && (
          <div style={{ padding: '8px 12px', marginTop: 4 }}>
            {activeTool === 'search' && (
              <input
                value={chatSearch}
                onChange={e => setChatSearch(e.target.value)}
                placeholder="Search chats…"
                autoFocus
                style={inputStyle}
              />
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 2px 6px', fontWeight: 600 }}>
              Your chats
            </div>
            {threadList.length === 0 && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', padding: '4px 2px' }}>No conversations yet</div>
            )}
            {threadList
              .filter(t => !chatSearch || t.title.toLowerCase().includes(chatSearch.toLowerCase()))
              .slice(0, 20)
              .map(thread => (
                <button key={thread.id} onClick={() => onThreadSelect?.(thread.id)} style={chatButtonStyle}>
                  {thread.title}
                </button>
              ))
            }
          </div>
        )}

        {/* Files panel */}
        {expanded && activeTool === 'files' && (
          <div style={panelStyle}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files…"
              style={inputStyle}
            />
            <div style={{ overflow: 'auto', flex: 1 }}>
              {filteredFiles.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '8px 4px' }}>
                  {files.length === 0 ? 'Loading files…' : 'No results'}
                </div>
              )}
              {filteredFiles.map(file => (
                <button
                  key={file}
                  onClick={() => onSelectFile(file)}
                  style={{
                    ...fileButtonStyle,
                    background: file === currentFile ? 'rgba(68,195,166,0.16)' : 'transparent',
                    color: file === currentFile ? '#6eecd8' : '#c7d8f8',
                  }}
                >
                  {file}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Uploads panel */}
        {expanded && activeTool === 'uploads' && (
          <div style={panelStyle}>
            <label style={{
              display: 'block', width: '100%', textAlign: 'center',
              padding: '14px 10px', borderRadius: 10, cursor: 'pointer',
              border: '1px dashed rgba(68,195,166,0.35)', color: '#6eecd8', fontSize: 13,
            }}>
              + Upload file
              <input type="file" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
              }} />
            </label>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.6 }}>
              HTML, TSX, docs, and images preview instantly in the preview panel.
            </div>
          </div>
        )}

        {/* Images panel */}
        {expanded && activeTool === 'images' && (
          <div style={panelStyle}>
            <div style={comingSoonStyle}>Image viewer and generator coming soon.</div>
          </div>
        )}

        {/* Apps panel */}
        {expanded && activeTool === 'apps' && <AppsPanel />}

        {/* Research panel */}
        {expanded && activeTool === 'research' && (
          <div style={panelStyle}>
            <div style={comingSoonStyle}>Deep research and long-form analysis tools coming soon.</div>
          </div>
        )}

        {/* Codex panel */}
        {expanded && activeTool === 'codex' && (
          <div style={panelStyle}>
            <div style={comingSoonStyle}>Codex — agentic code execution and file operations.</div>
          </div>
        )}

        {/* Models panel */}
        {expanded && activeTool === 'models' && (
          <div style={panelStyle}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Select Model</div>
            {[
              { id: 'claude-sonnet-4-5', label: 'Claude Sonnet', provider: 'Anthropic' },
              { id: 'claude-opus-4-5',   label: 'Claude Opus',   provider: 'Anthropic' },
              { id: 'claude-haiku-4-5',  label: 'Claude Haiku',  provider: 'Anthropic' },
              { id: 'gpt-4o',            label: 'GPT-4o',        provider: 'OpenAI' },
              { id: 'gpt-4o-mini',       label: 'GPT-4o mini',   provider: 'OpenAI' },
            ].map(m => {
              const isActive = activeModel === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => onModelSelect?.(m.id)}
                  style={{
                    ...fileButtonStyle,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: isActive ? 'rgba(68,195,166,0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(68,195,166,0.25)' : '1px solid transparent',
                    borderRadius: 8, padding: '8px 10px',
                    color: isActive ? '#6eecd8' : '#c7d8f8',
                  }}
                >
                  <span>{m.label}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{m.provider}</span>
                </button>
              )
            })}
          </div>
        )}

        {expanded && activeTool === 'projects' && (
          <div style={panelStyle}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Switch Project</div>
            {[
              { name: 'streamsai-editor',       owner: 'hawk7227', repo: 'streamsai-editor',       branch: 'main' },
              { name: 'hipa-doctor-panel',       owner: 'hawk7227', repo: 'hipa-doctor-panel',       branch: 'master' },
              { name: 'patientpanel',            owner: 'hawk7227', repo: 'patientpanel',            branch: 'master' },
              { name: 'dropshipping-management', owner: 'hawk7227', repo: 'dropshipping-management', branch: 'main' },
              { name: 'file-engine-plateform',   owner: 'hawk7227', repo: 'file-engine-plateform',   branch: 'main' },
            ].map(p => {
              const isActive = activeProjectName === p.name
              return (
                <button
                  key={p.name}
                  onClick={() => onProjectSelect?.(p)}
                  style={{
                    ...fileButtonStyle,
                    background: isActive ? 'rgba(68,195,166,0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(68,195,166,0.25)' : '1px solid transparent',
                    borderRadius: 8, padding: '8px 10px',
                    color: isActive ? '#6eecd8' : '#c7d8f8',
                  }}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Artifacts panel */}
        {expanded && activeTool === 'artifacts' && (
          <div style={panelStyle}>
            <div style={comingSoonStyle}>Generated artifacts, staged previews, and exports appear here.</div>
          </div>
        )}

        {/* Settings panel */}
        {expanded && activeTool === 'settings' && (
          <div style={panelStyle}>
            <a href="/setup" style={linkButtonStyle}>Open Setup →</a>
            <div style={comingSoonStyle}>Configure GitHub, Supabase, and Vercel connections.</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: expanded ? '10px 14px' : '10px 0', textAlign: expanded ? 'left' : 'center', color: 'rgba(255,255,255,0.18)', fontSize: 10, letterSpacing: '0.08em', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {expanded ? 'STREAMSAI' : 'S'}
      </div>
    </div>
  )
}

const toggleStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: 40, width: '100%', background: 'transparent',
  border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer', flexShrink: 0,
}
const panelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, padding: 12,
  borderTop: '1px solid rgba(255,255,255,0.06)', minHeight: 0, flex: 1, overflow: 'hidden',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 10px', borderRadius: 10, fontSize: 12,
  background: 'rgba(255,255,255,0.06)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.08)', outline: 'none',
}
const fileButtonStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '7px 10px', borderRadius: 8, border: 'none',
  fontSize: 11, wordBreak: 'break-all', cursor: 'pointer', lineHeight: 1.5,
}
const chatButtonStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 10px', borderRadius: 8, border: 'none',
  fontSize: 12, cursor: 'pointer', lineHeight: 1.5,
  color: 'rgba(255,255,255,0.65)', background: 'transparent',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const comingSoonStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.6,
}
const linkButtonStyle: React.CSSProperties = {
  display: 'block', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(68,195,166,0.12)', border: '1px solid rgba(68,195,166,0.24)',
  color: '#6eecd8', fontSize: 13, textDecoration: 'none', textAlign: 'center',
}
