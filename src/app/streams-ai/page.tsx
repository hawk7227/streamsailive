const shellStyle = {
  minHeight: "100svh",
  background: "radial-gradient(circle at 50% 36%, rgba(124,58,237,.2), transparent 28%), #02050c",
  color: "#f8fafc",
  display: "grid",
  placeItems: "center",
  padding: "32px",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const cardStyle = {
  width: "min(720px, 100%)",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: "24px",
  background: "rgba(15,23,42,.72)",
  padding: "28px",
  boxShadow: "0 24px 80px rgba(0,0,0,.35)",
};

export default function StreamsAIPage() {
  return (
    <main style={shellStyle}>
      <section style={cardStyle} aria-label="Streams AI preview status">
        <p style={{ margin: "0 0 8px", color: "#38d5ff", fontWeight: 800, letterSpacing: ".12em", fontSize: "12px" }}>
          STREAMS AI PREVIEW
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: "32px", lineHeight: 1.15 }}>
          Old chat shell removed from this preview branch.
        </h1>
        <p style={{ margin: 0, color: "#cbd5e1", fontSize: "16px", lineHeight: 1.6 }}>
          The previous sidebar/composer interface was the wrong active UI, so it is no longer mounted on this route. The next step is to connect the correct Streams AI workspace source here.
        </p>
      </section>
    </main>
  );
}
