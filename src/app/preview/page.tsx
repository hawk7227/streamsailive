export default function PreviewHomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', margin: 0, background: 'linear-gradient(135deg,#0b1020,#111827)', color: 'white', fontFamily: 'system-ui,sans-serif', padding: 24 }}>
      <div style={{ width: 460, padding: 24, borderRadius: 22, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Preview Runtime</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 30 }}>StreamsAI Preview Ready</h1>
        <p style={{ margin: 0, opacity: 0.86, lineHeight: 1.6 }}>
          This panel is reserved for real-route preview, staged preview, sandboxed frontend files, documents, and artifact review — all inside the current project context.
        </p>
      </div>
    </div>
  )
}
