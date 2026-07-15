"use client";

export default function VisionsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#060915", color: "white", padding: 24 }}>
      <section style={{ maxWidth: 560, textAlign: "center" }}>
        <h1>Streams Visions paused safely.</h1>
        <p style={{ color: "#aeb7d3" }}>This error is contained inside Visions and does not affect the main Streams AI experience.</p>
        <button onClick={reset} style={{ border: 0, borderRadius: 12, padding: "12px 18px", background: "#6f5cff", color: "white", fontWeight: 700 }}>Try again</button>
      </section>
    </main>
  );
}
