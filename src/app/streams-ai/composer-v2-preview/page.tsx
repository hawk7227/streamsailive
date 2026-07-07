export default function ComposerV2PreviewPage() {
  return (
    <main style={{ minHeight: "100svh", background: "#080b18", color: "white", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(860px, calc(100vw - 36px))", display: "grid", gap: 16, textAlign: "center" }}>
        <h1>Streams Composer V2 Preview</h1>
        <p>The V2 component is built separately. This preview route is reserved for browser testing and does not replace the live composer.</p>
      </section>
    </main>
  );
}
