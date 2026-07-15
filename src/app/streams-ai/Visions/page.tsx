import VisionsClient from "./VisionsClient";

export const dynamic = "force-dynamic";

export default function StreamsVisionsPage() {
  if (process.env.STREAMS_VISIONS_ENABLED === "false") {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#060915", color: "white", padding: 24 }}>
        <section style={{ maxWidth: 520, textAlign: "center" }}>
          <h1>Streams Visions is turned off.</h1>
          <p style={{ color: "#aeb7d3" }}>The main Streams AI experience is unaffected.</p>
        </section>
      </main>
    );
  }

  return <VisionsClient />;
}
