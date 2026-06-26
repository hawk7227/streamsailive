"use client";

import {
  CHAT_CAPABILITY_AUDIT,
  PREVIEW_FIRST_STATE_MACHINE,
  RUNTIME_PREVIEW_ONLY_RULES,
  getWorkstationContract,
  type BuilderChatConnection,
  type PulledFileDetail,
} from "./builderSystemContract";

type Props = {
  activeModule: string;
  viewMode: string;
  latestProof: string;
  activeFile: PulledFileDetail;
  connection: BuilderChatConnection;
};

const bridgeEvents = [
  "IPHONE_CHAT_CONNECTED_TO_ONE_WORKSTATION",
  "CONNECTED_CONTEXT_PACKET_SENT_TO_CHAT",
  "CHAT_COMMAND_ROUTED_TO_ACTIVE_WORKSTATION_ONLY",
  "SUMMARY_LANE_UPDATED_FOR_EVERY_AGENT_STEP",
  "REAL_RUNTIME_PREVIEW_REQUIRED_BEFORE_DONE",
  "USER_APPROVAL_REQUIRED_BEFORE_PUSH",
] as const;

export default function BuilderControlLayers({ activeModule, viewMode, latestProof, activeFile, connection }: Props) {
  const contract = getWorkstationContract(activeModule);
  const connectedHere = connection.connected && connection.activeWorkstationName === contract.name;
  return (
    <section className="builderControlLayers" aria-label="Builder control and connection layers">
      <header>
        <b>LIVE SUMMARY / CONTROL LAYERS</b>
        <span>{connectedHere ? `iPhone chat controls ${contract.name}` : connection.connected ? `iPhone chat connected to ${connection.activeWorkstationName}` : "iPhone chat is standalone"}</span>
      </header>

      <div className="activeCard">
        <p><b>Active Workstation</b><span>{activeModule}</span></p>
        <p><b>View Mode</b><span>{viewMode}</span></p>
        <p><b>Active Source</b><span>{activeFile.path ? `${activeFile.repo}@${activeFile.branch}:${activeFile.path}` : "No active file loaded"}</span></p>
        <p><b>Latest Proof</b><span>{latestProof || "Waiting for live workstation proof event."}</span></p>
      </div>

      <div className="sectionBlock">
        <b>Hard Runtime Preview Rule</b>
        {RUNTIME_PREVIEW_ONLY_RULES.map((rule) => <span key={rule}>• {rule}</span>)}
      </div>

      <div className="sectionBlock">
        <b>Workstation Capabilities</b>
        <span>{contract.capabilities.join(" · ")}</span>
      </div>

      <div className="capabilityGrid">
        {CHAT_CAPABILITY_AUDIT.map((item) => (
          <article key={item.label}>
            <b>{item.label}</b>
            <span>{item.capability}</span>
            <em>{item.requiredWorkspaceReceiver}</em>
          </article>
        ))}
      </div>

      <div className="sectionBlock">
        <b>Preview-First Agent State Machine</b>
        <span>{PREVIEW_FIRST_STATE_MACHINE.join(" → ")}</span>
      </div>

      <div className="bridgeRow">
        <b>Bridge Contract</b>
        <span>{bridgeEvents.join(" · ")}</span>
      </div>

      <div className="previewRow">
        <b>Preview Hosts For This Workstation</b>
        <span>{contract.previewHost.join(" · ")}</span>
      </div>

      <style jsx>{`
        .builderControlLayers{min-width:0;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);padding:7px;display:grid;gap:7px;box-sizing:border-box;overflow:hidden;}
        header{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(148,163,184,.12);padding-bottom:6px;}
        header b{color:#6ee7b7;font-size:9px;letter-spacing:.08em;}header span,.activeCard span,.sectionBlock span,.capabilityGrid span,.capabilityGrid em,.bridgeRow span,.previewRow span{color:#cbd5e1;font-size:9px;line-height:1.35;overflow-wrap:anywhere;}
        .activeCard{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
        p,article,.sectionBlock,.bridgeRow,.previewRow{min-width:0;margin:0;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(2,6,23,.68);padding:6px;}
        p b,article b,.sectionBlock b,.bridgeRow b,.previewRow b{display:block;color:#fff;font-size:9px;margin-bottom:4px;}.sectionBlock{display:grid;gap:3px;}
        .capabilityGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:210px;overflow:auto;}.capabilityGrid article{display:grid;gap:3px;}.capabilityGrid em{font-style:normal;color:#93c5fd;}
        .bridgeRow,.previewRow{background:rgba(6,78,59,.14);border-color:rgba(16,185,129,.18);}
      `}</style>
    </section>
  );
}
