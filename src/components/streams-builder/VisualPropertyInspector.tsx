"use client";

import type { VisualComputedStyles, VisualEditOperation, VisualTarget } from "@/lib/streams-builder/visual-edit-operations";

type Props = {
  selected: VisualTarget | null;
  onOperation: (operation: VisualEditOperation) => void;
};

const STYLE_FIELDS: Array<{ key: keyof VisualComputedStyles; label: string; type: string }> = [
  { key: "backgroundColor", label: "Background", type: "color" },
  { key: "color", label: "Text", type: "color" },
  { key: "borderColor", label: "Border", type: "color" },
  { key: "borderRadius", label: "Radius", type: "text" },
  { key: "padding", label: "Padding", type: "text" },
  { key: "margin", label: "Margin", type: "text" },
  { key: "gap", label: "Gap", type: "text" },
  { key: "boxShadow", label: "Shadow", type: "text" },
];

function normalizeColor(value?: string) {
  if (!value || value.startsWith("rgba") || value.startsWith("rgb")) return "#000000";
  return value;
}

export default function VisualPropertyInspector({ selected, onOperation }: Props) {
  if (!selected) {
    return (
      <aside className="inspector empty">
        <b>Visual Properties</b>
        <p>Select a panel, text, image, button, video, or section to edit its properties.</p>
      </aside>
    );
  }

  function updateStyle(key: keyof VisualComputedStyles, value: string) {
    if (!selected) return;
    onOperation({ type: "style.update", target: selected, style: { [key]: value } });
  }

  function updateSize(key: "width" | "height", value: string) {
    if (!selected) return;
    const amount = Number.parseInt(value, 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onOperation({ type: "node.resize", target: selected, width: key === "width" ? amount : selected.rect?.width || amount, height: key === "height" ? amount : selected.rect?.height || amount, handle: "se" });
  }

  function updateText(value: string) {
    if (!selected) return;
    onOperation({ type: "text.update", target: selected, value });
  }

  return (
    <aside className="inspector">
      <header><b>Visual Properties</b><span>{selected.kind} · {selected.tagName || "element"}</span></header>
      <section className="group"><label>Text / label<textarea defaultValue={selected.textFingerprint || ""} onBlur={(event) => updateText(event.currentTarget.value)} /></label></section>
      <section className="grid">
        <label>Width<input type="number" defaultValue={selected.rect?.width || 0} onBlur={(event) => updateSize("width", event.currentTarget.value)} /></label>
        <label>Height<input type="number" defaultValue={selected.rect?.height || 0} onBlur={(event) => updateSize("height", event.currentTarget.value)} /></label>
      </section>
      <section className="grid">
        {STYLE_FIELDS.map((field) => <label key={field.key}>{field.label}<input type={field.type} defaultValue={field.type === "color" ? normalizeColor(selected.styles?.[field.key]) : selected.styles?.[field.key] || ""} onBlur={(event) => updateStyle(field.key, event.currentTarget.value)} /></label>)}
      </section>
      <section className="actions">
        <button type="button" onClick={() => onOperation({ type: "node.duplicate", target: selected })}>Duplicate</button>
        <button type="button" onClick={() => onOperation({ type: "node.delete", target: selected })}>Delete</button>
      </section>
      <style jsx>{`
        .inspector{border-top:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;padding:10px;display:grid;gap:10px;max-height:340px;overflow:auto}.inspector.empty{color:#94a3b8}.inspector header{display:flex;align-items:center;justify-content:space-between;gap:10px}.inspector b{font-size:12px}.inspector span{color:#6ee7b7;font-size:11px}.group,.grid{display:grid;gap:8px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}label{display:grid;gap:4px;color:#93c5fd;font-size:10px;text-transform:uppercase;font-weight:900}input,textarea{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.24);border-radius:8px;background:#0f172a;color:#fff;padding:7px;font-size:12px;text-transform:none}textarea{min-height:58px;resize:vertical}.actions{display:flex;gap:8px}button{height:32px;border:1px solid rgba(148,163,184,.22);border-radius:9px;background:#7c3aed;color:#fff;font-size:11px;font-weight:900;padding:0 10px;cursor:pointer}
      `}</style>
    </aside>
  );
}
