export default function PreviewSamplePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0e1726', color: 'white', fontFamily: 'system-ui,sans-serif', padding: 24 }}>
      <div style={{ width: 420, padding: 24, borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Route Preview</div>
        <h1 style={{ margin: '0 0 10px' }}>Real frontend preview view</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>Use this route to validate the preview container and device frames without disturbing the working chat or editor systems.</p>
      </div>
    </div>
  )
}
