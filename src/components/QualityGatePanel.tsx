"use client";

export default function QualityGatePanel() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "grid",
        placeItems: "center",
        background: "#05070b",
        color: "rgba(255,255,255,0.72)",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Quality Gate</h2>
        <p style={{ marginTop: 10, maxWidth: 420 }}>
          Quality Gate is not active in this editor-core slice yet.
        </p>
      </div>
    </div>
  );
}
