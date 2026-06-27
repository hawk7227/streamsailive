"use client";

import { useEffect, useState } from "react";
import VisualInsertMenu from "./VisualInsertMenu";
import VisualPropertyInspector from "./VisualPropertyInspector";
import { applyVisualOperationToSource } from "@/lib/streams-builder/visual-source-mapper";
import type { PulledFileDetail } from "./builderSystemContract";
import type { VisualEditOperation, VisualTarget } from "@/lib/streams-builder/visual-edit-operations";

type Props = {
  activeFile: PulledFileDetail;
  onContentChange: (next: string) => void;
  onProof: (message: string) => void;
};

function legacyTarget(payload: any): VisualTarget {
  return {
    id: payload?.id,
    kind: payload?.kind || "container",
    selector: payload?.selector || "",
    tagName: payload?.tagName,
    className: payload?.className,
    textFingerprint: payload?.textFingerprint || payload?.text || payload?.original || "",
    original: payload?.original,
    src: payload?.src,
    rect: payload?.rect || (payload?.width && payload?.height ? { x: 0, y: 0, top: 0, left: 0, right: payload.width, bottom: payload.height, width: payload.width, height: payload.height } : undefined),
    styles: payload?.styles || (payload?.transform ? { transform: payload.transform } : undefined),
  };
}

function legacyOperation(type: string, payload: any): VisualEditOperation | null {
  const target = legacyTarget(payload);
  if (type === "streams-editable-commit") return { type: "text.update", target, value: payload?.text || "" };
  if (type === "streams-editable-image-replace") return { type: "asset.replace", target, asset: { src: payload?.replacementDataUrl || payload?.src || "", name: payload?.replacementName, kind: "image" } };
  if (type === "streams-editable-remove" || type === "streams-editable-delete") return { type: "node.delete", target };
  if (type === "streams-editable-style") return { type: "style.update", target, style: target.styles || {} };
  return null;
}

export default function VisualOperationDock({ activeFile, onContentChange, onProof }: Props) {
  const [selected, setSelected] = useState<VisualTarget | null>(null);
  const [operations, setOperations] = useState<VisualEditOperation[]>([]);

  function applyOperation(operation: VisualEditOperation) {
    setSelected(operation.target);
    setOperations((items) => [...items.slice(-50), operation]);
    if (operation.type === "node.select") {
      onProof(`Selected ${operation.target.kind}: ${operation.target.textFingerprint || operation.target.src || operation.target.selector}`);
      return;
    }
    const result = applyVisualOperationToSource(activeFile.content || "", operation);
    if (result.ok) {
      onContentChange(result.content);
      onProof(result.summary);
    } else {
      onProof(`${result.summary} Operation tracked, but exact source range was not safely found in ${activeFile.path || "current file"}.`);
    }
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.source !== "streams-editable-preview") return;
      if (data.type === "streams-visual-operation") return applyOperation(data.payload as VisualEditOperation);
      if (data.type === "streams-editable-select") return setSelected(legacyTarget(data.payload || {}));
      const op = legacyOperation(data.type, data.payload || {});
      if (op) applyOperation(op);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [activeFile.content, activeFile.path]);

  return (
    <section className="visualOperationDock">
      <header><b>Component Editing</b><span>{selected ? `${selected.kind} selected` : "select a visual item"}</span></header>
      <div className="dockGrid">
        <VisualPropertyInspector selected={selected} onOperation={applyOperation} />
        <VisualInsertMenu selected={selected} onOperation={applyOperation} />
      </div>
      <details>
        <summary>Operation log</summary>
        {operations.length ? operations.slice(-8).map((operation, index) => <p key={`${operation.type}-${index}`}>{operation.type} · {operation.target.kind}</p>) : <p>No operations yet.</p>}
      </details>
      <style jsx>{`
        .visualOperationDock{display:grid;gap:6px;border-top:1px solid rgba(148,163,184,.12);background:#020617;color:#fff;max-height:430px;overflow:auto}.visualOperationDock>header{display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.12)}header b{font-size:12px}header span{font-size:11px;color:#6ee7b7}.dockGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0}details{padding:8px 10px;color:#94a3b8;font-size:11px}summary{cursor:pointer;color:#fff;font-weight:900}p{margin:4px 0;overflow-wrap:anywhere}
      `}</style>
    </section>
  );
}
