"use client"
import { useState } from 'react'
import { createLineDiff, type StagedChange } from '@/lib/staging'

export type PreviewPayload =
  | { mode: 'idle' }
  | { mode: 'route'; route: string }
  | { mode: 'html'; html: string; title?: string }
  | { mode: 'code'; code: string; language: string; title?: string }
  | { mode: 'doc'; content: string; title?: string }
  | { mode: 'diff'; staged: StagedChange }

type DeviceKey = 'desktop' | 'iphone'

const DEVICES: Record<DeviceKey, { width: number | string; height: number | string; radius: number }> = {
  desktop: { width: '100%', height: '100%', radius: 0 },
  iphone:  { width: 390,    height: 844,    radius: 44 },
}

export function PreviewSurface(props: {
  preview: PreviewPayload
  device: DeviceKey
  safeZone: boolean
  onDevice(d: DeviceKey): void
  onMode(m: PreviewPayload['mode']): void
  onRouteOpen(route: string): void
  onApply?(): void
  onDiscard?(): void
}) {
  const { preview, device, safeZone, onDevice, onMode, onRouteOpen, onApply, onDiscard } = props
  const [routeInput, setRouteInput] = useState('/preview')
  const frame = DEVICES[device]
  const isDesktop = device === 'desktop'

  const renderContent = () => {
    if (preview.mode === 'route') {
      return <iframe title="route-preview" src={preview.route} style={iframeStyle} />
    }
    if (preview.mode === 'html') {
      return (
        <iframe
          key={preview.title}
          title={preview.title || 'html-preview'}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          srcDoc={preview.html}
          style={{ ...iframeStyle, background: 'transparent' }}
        />
      )
    }
    if (preview.mode === 'code') {
      return (
        <iframe
          title={preview.title || 'code-preview'}
          sandbox="allow-scripts allow-same-origin"
          srcDoc={buildSandboxDoc(preview.code, preview.language)}
          style={iframeStyle}
        />
      )
    }
    if (preview.mode === 'doc') {
      return (
        <pre style={{
          width: '100%', height: '100%', margin: 0,
          padding: '20px 24px', overflow: 'auto',
          background: '#0a0f1a', color: '#c8d8f0',
          whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace',
          fontSize: 13, lineHeight: 1.65,
        }}>
          {preview.content}
        </pre>
      )
    }
    if (preview.mode === 'diff') {
      const lines = createLineDiff(preview.staged.originalContent, preview.staged.nextContent)
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#070d18' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={onApply} style={actionBtn('#16a34a')}>✓ Apply to GitHub</button>
            <button onClick={onDiscard} style={actionBtn('#334155')}>✕ Discard</button>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginLeft: 4 }}>{preview.staged.path}</span>
          </div>
          <pre style={{ flex: 1, margin: 0, padding: '12px 16px', overflow: 'auto', background: '#070d18', color: '#dbeafe', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.7 }}>
            {lines.map((line, i) => (
              <div key={i} style={{
                background: line.startsWith('+ ') ? 'rgba(34,197,94,0.1)' : line.startsWith('- ') ? 'rgba(239,68,68,0.1)' : 'transparent',
                color: line.startsWith('+ ') ? '#86efac' : line.startsWith('- ') ? '#fca5a5' : '#94a3b8',
                padding: '0 4px', borderRadius: 2,
              }}>{line}</div>
            ))}
          </pre>
        </div>
      )
    }

    // idle — placeholder
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#dce8ff', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.3 }}>◎</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: '#e8f0ff' }}>Preview Ready</div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.45)' }}>
            Ask the AI to build something and it will appear here automatically.
            Or enter a route above to preview a live page.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#030814' }}>

      {/* Toolbar */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#07101b', flexShrink: 0,
      }}>
        <Chip active={preview.mode === 'idle' || preview.mode === 'route' || preview.mode === 'html' || preview.mode === 'code'} onClick={() => onMode('idle')}>Preview</Chip>
        <Chip active={preview.mode === 'diff'} onClick={() => onMode('diff')}>Diff</Chip>
        <Chip active={preview.mode === 'doc'} onClick={() => onMode('doc')}>Doc</Chip>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
        <Chip active={isDesktop} onClick={() => onDevice('desktop')}>Desktop</Chip>
        <Chip active={!isDesktop} onClick={() => onDevice('iphone')}>iPhone</Chip>
        {!isDesktop && <Chip active={safeZone} onClick={() => {}}>Safe Zone</Chip>}
        <input
          value={routeInput}
          onChange={e => setRouteInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onRouteOpen(routeInput) }}
          placeholder="/preview"
          style={{
            marginLeft: 'auto', width: 160,
            padding: '5px 8px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.7)', fontSize: 11, outline: 'none',
          }}
        />
      </div>

      {/* Content area */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: isDesktop ? 'hidden' : 'auto',
        padding: isDesktop ? 0 : 20,
        background: '#030814',
      }}>
        <div style={{
          width: frame.width,
          height: frame.height,
          maxWidth: '100%',
          maxHeight: '100%',
          position: 'relative',
          borderRadius: frame.radius,
          overflow: 'hidden',
          // Desktop: no border, no shadow — fills cleanly
          // Mobile: device frame with shadow
          boxShadow: isDesktop ? 'none' : '0 20px 80px rgba(0,0,0,0.6)',
          border: isDesktop ? 'none' : '1px solid rgba(255,255,255,0.1)',
        }}>
          {renderContent()}
          {safeZone && !isDesktop && (
            <div style={{
              position: 'absolute', inset: '48px 0 36px',
              border: '2px dashed rgba(255,255,255,0.35)',
              borderRadius: 20, pointerEvents: 'none', zIndex: 10,
            }} />
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? 'rgba(68,195,166,0.35)' : 'rgba(255,255,255,0.08)'}`,
        background: active ? 'rgba(68,195,166,0.18)' : 'rgba(255,255,255,0.03)',
        color: active ? '#6eecd8' : 'rgba(255,255,255,0.55)',
        borderRadius: 999, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        transition: 'all 120ms ease',
      }}
    >{children}</button>
  )
}

function actionBtn(bg: string): React.CSSProperties {
  return { background: bg, border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
}

const iframeStyle: React.CSSProperties = {
  width: '100%', height: '100%', border: 'none', display: 'block',
}

function buildSandboxDoc(code: string, language: string): string {
  const isComponent = /tsx|jsx/i.test(language)
  const transformed = code
    .replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
    .replace(/export\s+default\s+/g, 'const __DefaultExport = ')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { height: 100%; margin: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; }
  </style>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="${isComponent ? 'typescript,react' : 'typescript'}">
    ${transformed}
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      ${isComponent
        ? `const C = typeof __DefaultExport !== 'undefined' ? __DefaultExport : (typeof App !== 'undefined' ? App : null);
           if (!C) throw new Error('No default export found');
           root.render(React.createElement(C));`
        : `root.render(React.createElement('pre', {style:{padding:'16px',whiteSpace:'pre-wrap',fontSize:'13px'}}, ${JSON.stringify(code)}));`
      }
    } catch(err) {
      document.getElementById('root').innerHTML =
        '<div style="padding:20px;color:#ef4444;font-family:monospace;font-size:13px;background:#1a0a0a;height:100%;box-sizing:border-box">' +
        '<div style="font-weight:700;margin-bottom:8px">Preview Error</div>' +
        '<div>' + err.message + '</div></div>';
    }
  </script>
</body>
</html>`
}
