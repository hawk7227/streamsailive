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
        .builderResearchCanvas,.builderResearchWorkarea{display:contents}
        .builderResearchSource{grid-column:2;position:relative;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden;background:#020617;isolation:isolate;contain:layout paint}
        .builderResearchVisual{grid-column:3;position:relative;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden;background:#020617;border-left:1px solid rgba(148,163,184,.18);isolation:isolate;contain:layout paint}
        @media(max-width:900px){.builderResearchSource{grid-column:1}.builderResearchVisual{display:none}}
      `}</style>
      <style jsx global>{`
        .streamsOperator.builderOpen{grid-template-columns:minmax(0,1fr)!important}
        .streamsOperator.builderOpen>.operatorSidebar{display:none!important}
        .streamsOperator.builderOpen .operatorMain{width:100%!important;min-width:0!important;overflow:hidden!important}
        .streamsOperator.builderOpen .operatorMain>div{height:100%!important;min-height:0!important;display:grid!important;grid-template-columns:minmax(300px,30%) minmax(420px,35%) minmax(420px,35%)!important;overflow:hidden!important}
        .streamsOperator.builderOpen .operatorMain>div>div{height:100%!important;min-height:0!important;overflow:hidden!important}
        .builderResearchSource *,.builderResearchVisual *{box-sizing:border-box}
        .builderResearchSource .liveWorkstation{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;display:grid!important;grid-template-rows:minmax(0,1fr) 96px!important;overflow:hidden!important}
        .builderResearchSource .workstationBody{grid-row:1!important;min-width:0!important;min-height:0!important;overflow:hidden!important}
        .builderResearchSource .workstationToolbar{grid-row:2!important;height:96px!important;max-height:96px!important;min-height:96px!important;overflow:hidden!important;border-top:1px solid rgba(45,212,191,.28)!important;border-bottom:0!important;display:grid!important;grid-template-columns:1fr!important;grid-template-rows:34px 54px!important;align-items:stretch!important;padding:4px 8px!important;gap:4px!important}
        .builderResearchSource .workingTabs{grid-row:1!important;width:100%!important;min-width:0!important;height:34px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0!important;white-space:nowrap!important}
        .builderResearchSource .sourceToolbar{grid-row:2!important;width:100%!important;min-width:0!important;height:54px!important;justify-content:flex-start!important;align-items:center!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;border-top:1px solid rgba(148,163,184,.14)!important;padding-top:4px!important;white-space:nowrap!important}
        .builderResearchSource .workstationToolbar .githubSourceControl{min-width:max-content!important;max-width:none!important;flex:0 0 auto!important}
        .builderResearchSource .workstationToolbar .routeValue{display:none!important}
        .builderResearchVisual>.visualEditor{position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important;display:grid!important;grid-template-rows:auto auto auto minmax(0,1fr)!important}
        .builderResearchVisual .editorHeader,.builderResearchVisual .editorStatus,.builderResearchVisual .editorActions{min-width:0!important;max-width:100%!important;overflow-x:auto!important;overflow-y:hidden!important}
        .builderResearchVisual .previewPane,.builderResearchVisual .mobilePane,.builderResearchVisual .codePanel,.builderResearchVisual .splitMode,.builderResearchVisual .browserReview{min-width:0!important;min-height:0!important;width:100%!important;height:100%!important;overflow:hidden!important}
        .builderResearchVisual iframe{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;border:0!important}
        .builderResearchVisual [class*="drawer"],.builderResearchVisual [class*="Drawer"]{max-width:100%!important;max-height:100%!important}
        @media(max-width:900px){.streamsOperator.builderOpen .operatorMain>div{grid-template-columns:minmax(0,1fr)!important}}
      `}</style>
    </section>
  );
}
