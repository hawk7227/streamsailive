"use client";

import { useEffect, useState } from "react";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import LiveBuilderAgentBridge from "./LiveBuilderAgentBridge";
import LiveFrontendWorkstation from "./LiveFrontendWorkstation";
import VisualEditingWorkstation from "./VisualEditingWorkstation";
import TopRowWorkstationControls from "./TopRowWorkstationControls";
import VisualEditorScrollBehavior from "./VisualEditorScrollBehavior";
import WorkstationChromeEnhancer from "./WorkstationChromeEnhancer";
import type { PulledFileDetail } from "./builderSystemContract";

const EMPTY_FILE: PulledFileDetail = {
  repo: "",
  branch: "",
  path: "",
  folder: "",
  sha: "",
  content: "",
  route: "/",
};

type BuilderPreviewDetail = {
  previewId?: string;
  previewUrl?: string;
  operationId?: string;
  sessionId?: string;
};

type Props = {
  preview: BuilderPreviewDetail;
};

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
        const response = await fetch(`/api/streams-builder/previews/${encodeURIComponent(previewId)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = await response.json().catch(() => null) as {
          preview?: { source_code?: string; preview_html?: string };
        } | null;
        source = String(payload?.preview?.source_code || payload?.preview?.preview_html || "");
      } catch {}
      if (cancelled) return;

      const mounted: PulledFileDetail = {
        repo: "hawk7227/streamsailive",
        branch: "runtime-preview",
        path: `generated/previews/${previewId}.html`,
        folder: "generated/previews",
        sha: String(preview?.operationId || previewId),
        content: source,
        route: previewUrl,
      };
      setActiveFile(mounted);
      try { window.localStorage.setItem("streams-builder:active-file", JSON.stringify(mounted)); } catch {}
      window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: mounted }));
      setProof((items) => [...items.slice(-30), `Preview source mounted: ${previewUrl}`]);
    }

    void hydrate();
    return () => { cancelled = true; };
  }, [preview?.previewId, preview?.previewUrl, preview?.operationId]);

  function updateContent(next: string) {
    setActiveFile((current) => ({ ...current, content: next }));
    setProof((items) => [...items.slice(-30), "Shared source updated from the code or visual editor."]);
  }

  function addProof(message: string) {
    setProof((items) => [...items.slice(-30), message]);
  }

  return (
    <section className="builderResearchCanvas" aria-label="Streams researched Builder canvas">
      <header className="builderResearchTopbar">
        <GitHubRepositoryPicker />
        <div className="builderResearchIdentity">
          <span>BUILDER</span>
          <b>Code + Frontend Visual Editor</b>
          <LiveBuilderAgentBridge activeFile={activeFile} sessionId={preview?.sessionId} onProof={addProof} />
        </div>
      </header>
      <main className="builderResearchWorkarea">
        <section className="builderResearchSource" aria-label="Code and frontend source canvas">
          <LiveFrontendWorkstation activeFile={activeFile} />
        </section>
        <section className="builderResearchVisual" aria-label="Original frontend visual editor">
          <VisualEditingWorkstation
            stationLabel="Visual Editor"
            route={activeFile.route || "/"}
            filePath={activeFile.path}
            repo={activeFile.repo}
            branch={activeFile.branch}
            content={activeFile.content}
            onContentChange={updateContent}
            onProof={addProof}
            onChat={addProof}
          />
        </section>
      </main>
      <footer className="builderResearchFooter">
        <span>{activeFile.path || "Waiting for generated preview source"}</span>
        <span>{proof.slice(-1)[0] || "The left canvas controls code/frontend views; the right canvas is the visual editor."}</span>
      </footer>
      <TopRowWorkstationControls />
      <VisualEditorScrollBehavior />
      <WorkstationChromeEnhancer />
      <style jsx>{`
        .builderResearchCanvas{height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;background:#020617;color:#e5e7eb}
        .builderResearchTopbar{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(45,212,191,.28);background:#020617;padding:0 12px}
        .builderResearchIdentity{min-width:0;display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden}.builderResearchIdentity span{font-size:10px;font-weight:900;color:#5eead4;letter-spacing:.12em}.builderResearchIdentity b{font-size:12px;color:#fff}
        .builderResearchWorkarea{min-height:0;display:grid;grid-template-columns:minmax(480px,1fr) minmax(480px,1fr);gap:1px;background:#172033;overflow:hidden}
        .builderResearchSource,.builderResearchVisual{min-width:0;min-height:0;overflow:hidden;background:#020617}
        .builderResearchFooter{min-height:32px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 12px;border-top:1px solid rgba(148,163,184,.18);background:#020617;color:#94a3b8;font-size:10px;overflow:hidden}.builderResearchFooter span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        @media(max-width:1100px){.builderResearchWorkarea{grid-template-columns:minmax(0,1fr)}.builderResearchVisual{display:none}}
      `}</style>
    </section>
  );
}
