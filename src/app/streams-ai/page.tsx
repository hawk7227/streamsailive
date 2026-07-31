export default function StreamsAIPage() {
  return (
    <main
      aria-label="Streams WebUI migration"
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#020713",
        color: "#f8fafc",
      }}
    >
      <section style={{ width: "min(640px, 100%)", textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(2rem, 6vw, 4rem)" }}>Streams</h1>
        <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>
          The legacy custom chat and builder interface has been retired. The clean WebUI integration is now the only supported frontend direction.
        </p>
      </section>
    </main>
  );
}
