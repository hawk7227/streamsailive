"use client";

import { useEffect, useState } from "react";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import LiveBuilderAgentBridge from "./LiveBuilderAgentBridge";
import LiveFrontendWorkstation from "./LiveFrontendWorkstation";
import VisualEditingWorkstation from "./VisualEditingWorkstation";
import BuilderFocusCoordinator from "./BuilderFocusCoordinator";
import BuilderAutonomousTroubleshootingLoop from "./BuilderAutonomousTroubleshootingLoop";
import BuilderAgentPresenceBridge from "./BuilderAgentPresenceBridge";
import type { PulledFileDetail } from "./builderSystemContract";

const EMPTY_FILE: PulledFileDetail = { repo: "", branch: "", path: "", folder: "", sha: "", content: "", route: "/" };
type BuilderPreviewDetail = { previewId?: string; previewUrl?: string; operationId?: string; sessionId?: string };
type Props = { preview: BuilderPreviewDetail };

export default function BuilderResearchCanvas({ preview }: Props) {
  const [activeFile, setActiveFile] = useState<PulledFileDetail>(EMPTY_FILE);
  const [proof, setProof] = useState<string[]>([]);

  useEffect(() => {
    const previewId = String(preview?.previewId || "").trim();
    const previewUrl = String(preview?.previewUrl || (previewId ? `/streams-builder/preview/${previewId}` : "")).trim();
    if (!previewId || !previewUrl) return;
    let cancelled = false;
    async function hydrate() {
      let source = "";
      try {
        const response = await fetch(`/api/streams-builder/previews/${encodeURIComponent(previewId)}`, { cache: "no-store", credentials: "same-origin" });
        const payload = await response.json().catch(() => null) as { preview?: { source_code?: string; preview_html?: string } } | null;
        source = String(payload?.preview?.source_code || payload?.preview?.preview_html || "");
      } catch {}
      if (cancelled) return;
      const mounted: PulledFileDetail = { repo: "", branch: "", path: `generated/previews/${previewId}.html`, folder: "generated/previews", sha: String(preview?.operationId || previewId), content: source, route: previewUrl };
      setActiveFile(mounted);
      window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: mounted }));
      window.dispatchEvent(new CustomEvent("streams-builder:shared-context", { detail: { kind: "preview-mounted", previewId, previewUrl, sourceLength: source.length } }));
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { message: "Preview mounted and connected to the shared Builder state." } }));
      setProof((items) => [...items.slice(-30), "Preview mounted and connected to the shared Builder state."]);
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [preview?.previewId, preview?.previewUrl, preview?.operationId]);

  useEffect(() => {
    function onPulledFile(event: Event) {
      const detail = (event as CustomEvent<PulledFileDetail>).detail;
      if (detail?.path) setActiveFile(detail);
    }
    window.addEventListener("streams-builder:pulled-file", onPulledFile);
    return () => window.removeEventListener("streams-builder:pulled-file", onPulledFile);
  }, []);

  function updateContent(next: string) {
    setActiveFile((current) => {
      const updated = { ...current, content: next };
      try { window.localStorage.setItem("streams-builder:active-file", JSON.stringify(updated)); } catch {}
      window.dispatchEvent(new CustomEvent("streams-builder:shared-source-change", { detail: updated }));
      window.dispatchEvent(new CustomEvent("streams-builder:shared-context", { detail: { kind: "source", file: updated, content: next } }));
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { message: `Shared source updated: ${updated.path || "active preview"}.` } }));
      return updated;
    });
    setProof((items) => [...items.slice(-30), "Shared source updated from the code, worker, or visual editor."]);
  }

  function addProof(message: string) {
    setProof((items) => [...items.slice(-30), message]);
    window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { message } }));
  }

  const toolbar = <><GitHubRepositoryPicker /><LiveBuilderAgentBridge activeFile={activeFile} sessionId={preview?.sessionId} onProof={addProof} /></>;

  return (
    <section className="builderResearchCanvas" aria-label="Streams researched Builder canvas">
      <BuilderFocusCoordinator />
      <BuilderAgentPresenceBridge />
      <BuilderAutonomousTroubleshootingLoop activeFile={activeFile} sessionId={preview?.sessionId} onProof={addProof} />
      <main className="builderResearchWorkarea">
        <section className="builderResearchSource" aria-label="Code and frontend source canvas">
          <LiveFrontendWorkstation activeFile={activeFile} toolbar={toolbar} onContentChange={updateContent} />
        </section>
        <section className="builderResearchVisual" aria-label="Original frontend visual editor">
          <VisualEditingWorkstation stationLabel="Visual Editor" route={activeFile.route || "/"} filePath={activeFile.path} repo={activeFile.repo} branch={activeFile.branch} content={activeFile.content} onContentChange={updateContent} onProof={addProof} onChat={addProof} />
        </section>
      </main>
      <style jsx>{`
        .builderResearchCanvas{position:relative;height:100%;min-height:0;overflow:hidden;background:#020617;color:#e5e7eb}
        .builderResearchWorkarea{height:100%;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,1fr);gap:1px;background:#172033;overflow:hidden}
        .builderResearchSource,.builderResearchVisual{height:100%;min-width:0;min-height:0;overflow:hidden;background:#020617}
        .builderResearchVisual{display:block;border-left:1px solid rgba(148,163,184,.18)}
        @media(max-width:760px){.builderResearchWorkarea{grid-template-columns:minmax(0,1fr)}.builderResearchVisual{display:none}}
      `}</style>
      <style jsx global>{`
        .builderResearchCanvas .builderResearchSource .liveWorkstation{height:100%!important;min-height:0!important;display:grid!important;grid-template-rows:minmax(0,1fr) auto!important;overflow:hidden!important}
        .builderResearchCanvas .builderResearchSource .workstationBody{grid-row:1!important;min-height:0!important;overflow:hidden!important}
        .builderResearchCanvas .builderResearchSource .workstationToolbar{grid-row:2!important;max-height:104px!important;min-height:0!important;overflow:hidden!important;border-top:1px solid rgba(45,212,191,.28)!important;border-bottom:0!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:start!important;gap:4px!important;padding:4px 6px 6px!important;background:#020817!important}
        .builderResearchCanvas .builderResearchSource .workingTabs{order:1!important;width:100%!important;min-width:0!important;overflow-x:auto!important;overflow-y:hidden!important;display:flex!important;flex-wrap:nowrap!important;gap:4px!important;padding:0 0 3px!important;white-space:nowrap!important}
        .builderResearchCanvas .builderResearchSource .workingTabs button{min-height:28px!important;height:28px!important;padding:0 10px!important;white-space:nowrap!important}
        .builderResearchCanvas .builderResearchSource .sourceToolbar{order:2!important;width:100%!important;min-width:0!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;flex-wrap:nowrap!important;gap:4px!important;overflow-x:auto!important;overflow-y:hidden!important;border-top:1px solid rgba(148,163,184,.14)!important;padding-top:4px!important;white-space:nowrap!important}
        .builderResearchCanvas .builderResearchSource .sourceToolbar>*{flex:0 0 auto!important}
        .builderResearchCanvas .builderResearchSource .githubSourceControl{min-width:max-content!important;max-width:none!important}
        .builderResearchCanvas .builderResearchSource .routeValue{display:none!important}
        .builderResearchCanvas .builderResearchVisual .visualEditor{height:100%!important;min-height:0!important;overflow:hidden!important}
        .builderResearchCanvas .builderResearchVisual .editorBody{min-height:0!important;overflow:hidden!important}
        .builderResearchCanvas .builderResearchVisual iframe{display:block;width:100%!important;height:100%!important;min-height:0!important;border:0!important}
      `}</style>
    </section>
  );
}
