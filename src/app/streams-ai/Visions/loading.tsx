export default function VisionsLoading() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#060915", color: "white" }}>
      <div aria-live="polite" style={{ display: "grid", gap: 12, placeItems: "center" }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#7b61ff,#2bc6ff)", fontSize: 22 }}>✦</span>
        <span>Opening Streams Visions…</span>
      </div>
    </main>
  );
}
