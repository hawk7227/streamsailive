"use client";

import { VISUAL_COMPONENT_TEMPLATES } from "@/lib/streams-builder/component-templates";
import type { VisualEditOperation, VisualInsertPosition, VisualTarget } from "@/lib/streams-builder/visual-edit-operations";

type Props = {
  selected: VisualTarget | null;
  onOperation: (operation: VisualEditOperation) => void;
};

const POSITIONS: VisualInsertPosition[] = ["inside", "before", "after"];

export default function VisualInsertMenu({ selected, onOperation }: Props) {
  function insert(templateId: string, position: VisualInsertPosition) {
    if (!selected) return;
    const template = VISUAL_COMPONENT_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    onOperation({ type: "node.insert", target: selected, position, componentTemplate: template });
  }

  return (
    <section className="insertMenu">
      <header><b>Add Components</b><span>{selected ? selected.kind : "select target"}</span></header>
      <div className="templateGrid">
        {VISUAL_COMPONENT_TEMPLATES.map((template) => (
          <article key={template.id} className="templateCard">
            <b>{template.label}</b>
            {POSITIONS.map((position) => <button key={position} type="button" disabled={!selected} onClick={() => insert(template.id, position)}>{position}</button>)}
          </article>
        ))}
      </div>
      <style jsx>{`
        .insertMenu{border-top:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;padding:10px;display:grid;gap:10px;max-height:300px;overflow:auto}header{display:flex;justify-content:space-between;gap:10px}header b{font-size:12px}header span{color:#6ee7b7;font-size:11px}.templateGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.templateCard{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(15,23,42,.9);padding:8px;display:grid;gap:6px}.templateCard>b{font-size:11px}button{height:26px;border:1px solid rgba(148,163,184,.2);border-radius:8px;background:#312e81;color:#fff;font-size:10px;font-weight:900;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}
      `}</style>
    </section>
  );
}
