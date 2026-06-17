"use client";

type Props = {
  activeModule: string;
  viewMode: string;
  latestProof: string;
};

const bridgeEvents = [
  "ACTIVE_WORKSPACE_CHANGED",
  "PREVIEW_TARGET_CHANGED",
  "CHAT_REQUEST_CHANGE",
  "WORKSTATION_PROOF_UPDATED",
] as const;

const executionLanes = [
  { label: "Code Builder", detail: "Repo truth, patch, build, repair, browser proof." },
  { label: "Generation", detail: "Media jobs route as tools, not replacements." },
  { label: "Assets", detail: "Uploads, docs, media, diffs, logs, and proof stay attached." },
  { label: "Approval", detail: "No done state without visible proof and user approval." },
] as const;

const previewHosts = ["Web", "Mobile", "Document", "Image", "Video", "Code", "Diff", "Logs", "Proof"] as const;

export default function BuilderControlLayers({ activeModule, viewMode, latestProof }: Props) {
  return (
    <section className="builderControlLayers" aria-label="Builder control and connection layers">
      <header>
        <b>CONTROL LAYERS</b>
        <span>Added around Builder · existing modules preserved</span>
      </header>

      <div className="activeCard">
        <p><b>Chat Operator</b><span>Connected to active workstation context only.</span></p>
        <p><b>Active Module</b><span>{activeModule}</span></p>
        <p><b>View Mode</b><span>{viewMode}</span></p>
        <p><b>Latest Proof</b><span>{latestProof || "Waiting for workstation proof event."}</span></p>
      </div>

      <div className="layerGrid">
        {executionLanes.map((lane) => (
          <article key={lane.label}>
            <b>{lane.label}</b>
            <span>{lane.detail}</span>
          </article>
        ))}
      </div>

      <div className="bridgeRow">
        <b>Bridge Contract</b>
        <span>{bridgeEvents.join(" · ")}</span>
      </div>

      <div className="previewRow">
        <b>Preview Host</b>
        <span>{previewHosts.join(" · ")}</span>
      </div>

      <style jsx>{`
        .builderControlLayers{min-width:0;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);padding:7px;display:grid;gap:7px;box-sizing:border-box;overflow:hidden;}
        header{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(148,163,184,.12);padding-bottom:6px;}
        header b{color:#6ee7b7;font-size:9px;letter-spacing:.08em;}
        header span,.activeCard span,.layerGrid span,.bridgeRow span,.previewRow span{color:#cbd5e1;font-size:9px;line-height:1.35;overflow-wrap:anywhere;}
        .activeCard{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
        p,article{min-width:0;margin:0;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(2,6,23,.68);padding:6px;}
        p b,article b,.bridgeRow b,.previewRow b{display:block;color:#fff;font-size:9px;margin-bottom:4px;}
        .layerGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
        .bridgeRow,.previewRow{min-width:0;border:1px solid rgba(16,185,129,.18);border-radius:10px;background:rgba(6,78,59,.14);padding:6px;}
      `}</style>
    </section>
  );
}
