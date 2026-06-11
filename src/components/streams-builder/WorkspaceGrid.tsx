"use client";

import { useState } from "react";

const MAIN_BRANCH = "main";

const primarySource = {
  route: "/pricing",
  component: "PricingSection",
  file: "src/components/pricing/PricingSection.tsx",
  githubPath: "src/components/pricing/PricingSection.tsx",
};

const visualSource = {
  route: "/visual-editing",
  component: "HeroHeadline",
  file: "src/components/streams-builder/visual/HeroHeadline.tsx",
  githubPath: "src/components/streams-builder/visual/HeroHeadline.tsx",
};

export default function WorkspaceGrid() {
  const [mode, setMode] = useState<"primary" | "visual">("primary");
  const [headline, setHeadline] = useState("Build Better. Ship Faster.");
  const source = mode === "primary" ? primarySource : visualSource;

  return (
    <main style={{ height: "100%", display: "grid", gridTemplateColumns: "220px 1fr 320px", gap: 12, padding: 12, background: "#020713", color: "white", overflow: "hidden" }}>
      <aside style={panelStyle}>
        <h2>AI BUILD CHAT</h2>
        <Message text={mode === "primary" ? "Primary Builder is ready." : "Visual Editing is active."} />
        <Message text="Main File Write Lock is active." strong />
        <Message text="Only the file shown in the Source Truth strip can be edited on main." />
      </aside>

      <section style={{ ...panelStyle, display: "grid", gridTemplateRows: "auto 1fr auto", minWidth: 0 }}>
        <header style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h2 style={{ marginRight: "auto" }}>{mode === "primary" ? "LIVE PREVIEW" : "VISUAL EDITOR"}</h2>
          <span>Active Branch</span>
          <button style={greenButton}>main</button>
          <button style={purpleButton}>Save Patch</button>
        </header>
        <section style={{ minHeight: 0, overflow: "auto", border: "1px solid #1e293b", borderRadius: 16, marginTop: 10 }}>
          {mode === "primary" ? <PrimaryPreview /> : <VisualEditor headline={headline} setHeadline={setHeadline} />}
        </section>
        <SourceTruthStrip source={source} />
      </section>

      <aside style={panelStyle}>
        <h2>WORKSPACES</h2>
        <button onClick={() => setMode("primary")} style={mode === "primary" ? purpleButton : darkButton}>Primary Builder</button>
        <button onClick={() => setMode("visual")} style={mode === "visual" ? purpleButton : darkButton}>Visual Editing</button>
        <div style={{ marginTop: 16 }}>
          <h2>VISUAL EDITOR INSPECTOR</h2>
          <label style={labelStyle}>Text<textarea value={headline} onChange={(event) => setHeadline(event.target.value)} style={textareaStyle} /></label>
        </div>
      </aside>
    </main>
  );
}

function SourceTruthStrip({ source }: { source: typeof primarySource }) {
  const rows = [
    ["Route", source.route],
    ["Component", source.component],
    ["File", source.file],
    ["GitHub Path", source.githubPath],
    ["Branch", MAIN_BRANCH],
    ["Write Target", `${MAIN_BRANCH}/${source.file}`],
    ["Mode", "Main File Only"],
    ["PR / Branch Writes", "Blocked"],
  ];
  return (
    <footer style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, padding: 10, marginTop: 10, border: "1px solid #10b981", borderRadius: 16, background: "rgba(6,78,59,.18)" }}>
      {rows.map(([label, value]) => <div key={label} style={{ minWidth: 0, padding: 8, border: "1px solid #1e293b", borderRadius: 12, background: "#020617" }}><div style={{ color: "#6ee7b7", fontSize: 10, fontWeight: 900 }}>{label}</div><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 900 }}>{value}</div></div>)}
    </footer>
  );
}

function PrimaryPreview() {
  return <div style={{ padding: 40, textAlign: "center" }}><h1 style={{ fontSize: 42 }}>Build Better.<br /><span style={{ color: "#8b5cf6" }}>Ship Faster.</span></h1><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 40 }}><Card title="Workspace" value="Primary Builder" /><Card title="Component" value="PricingSection" /><Card title="Truth" value="/pricing" /></div></div>;
}

function VisualEditor({ headline, setHeadline }: { headline: string; setHeadline: (value: string) => void }) {
  return <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 220px", gap: 12, padding: 12, minHeight: 440 }}><aside style={miniPanel}><h3>Layers</h3><button style={purpleButton}>Hero Title</button><button style={darkButton}>Hero Copy</button><button style={darkButton}>Primary CTA</button></aside><section style={{ ...miniPanel, display: "grid", placeItems: "center" }}><div style={{ padding: 48, textAlign: "center", width: "85%", background: "#030816", borderRadius: 24 }}><button onClick={() => setHeadline(headline)} style={{ color: "white", background: "transparent", border: 0, fontSize: 44, fontWeight: 900 }}>{headline}</button><p>The intelligent workspace for building, editing, proving, and shipping real software.</p><button style={purpleButton}>Start Editing</button></div></section><aside style={miniPanel}><h3>Quick Edit</h3><textarea value={headline} onChange={(event) => setHeadline(event.target.value)} style={textareaStyle} /><div style={{ marginTop: 12, fontSize: 12 }}>Patch Preview<br />target: src/components/streams-builder/visual/HeroHeadline.tsx</div></aside></div>;
}

function Message({ text, strong }: { text: string; strong?: boolean }) { return <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: strong ? "#7c3aed" : "#1e293b", fontSize: 12, lineHeight: 1.5 }}>{text}</div>; }
function Card({ title, value }: { title: string; value: string }) { return <div style={{ border: "1px solid #334155", borderRadius: 20, padding: 24, background: "#020617" }}><h2>{title}</h2><p>{value}</p><button style={purpleButton}>Open</button></div>; }

const panelStyle = { minHeight: 0, overflow: "auto", border: "1px solid #334155", borderRadius: 18, background: "rgba(15,23,42,.72)", padding: 14 } as const;
const miniPanel = { border: "1px solid #334155", borderRadius: 16, background: "rgba(15,23,42,.72)", padding: 12, minWidth: 0 } as const;
const purpleButton = { display: "block", border: 0, borderRadius: 12, background: "#7c3aed", color: "white", padding: "10px 14px", fontWeight: 900, marginTop: 8 } as const;
const greenButton = { border: "1px solid #10b981", borderRadius: 12, background: "rgba(6,78,59,.35)", color: "#a7f3d0", padding: "10px 14px", fontWeight: 900 } as const;
const darkButton = { display: "block", border: "1px solid #334155", borderRadius: 12, background: "#020617", color: "white", padding: "10px 14px", fontWeight: 900, marginTop: 8 } as const;
const labelStyle = { display: "grid", gap: 6, fontSize: 12, color: "#94a3b8" } as const;
const textareaStyle = { minHeight: 120, border: "1px solid #334155", borderRadius: 12, background: "#020617", color: "white", padding: 10 } as const;
