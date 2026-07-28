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
        .builderResearchWorkarea{height:100%;min-height:0;display:grid;grid-template-columns:minmax(480px,1fr) minmax(480px,1fr);gap:1px;background:#172033;overflow:hidden}
        .builderResearchSource,.builderResearchVisual{min-width:0;min-height:0;overflow:hidden;background:#020617}
        @media(max-width:1100px){.builderResearchWorkarea{grid-template-columns:minmax(0,1fr)}.builderResearchVisual{display:none}}
      `}</style>
      <style jsx global>{`
        .builderResearchCanvas .builderResearchVisual .editorHeader,.builderResearchCanvas .builderResearchVisual .editorStatus,.builderResearchCanvas .builderResearchVisual .editorActions{display:none!important}
        .builderResearchCanvas .builderResearchVisual .visualEditor{grid-template-rows:minmax(0,1fr)!important;min-height:0!important}
        .builderResearchCanvas .liveWorkstation{grid-template-rows:minmax(0,1fr) auto!important}
        .builderResearchCanvas .workstationBody{grid-row:1!important}
        .builderResearchCanvas .workstationToolbar{grid-row:2!important;overflow:visible!important;border-top:1px solid rgba(45,212,191,.28)!important;border-bottom:0!important;grid-template-columns:1fr!important;align-items:stretch!important;padding:6px 8px 8px!important}
        .builderResearchCanvas .workingTabs{order:1!important;width:100%!important;overflow-x:auto!important;padding-bottom:4px!important}
        .builderResearchCanvas .sourceToolbar{order:2!important;width:100%!important;justify-content:flex-start!important;flex-wrap:wrap!important;border-top:1px solid rgba(148,163,184,.14)!important;padding-top:6px!important}
        .builderResearchCanvas .workstationToolbar .githubSourceControl{min-width:0!important;max-width:100%!important}
        .builderResearchCanvas .workstationToolbar .routeValue{display:none!important}
      `}</style>
    </section>
  );
}
