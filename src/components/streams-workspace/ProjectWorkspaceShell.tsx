"use client";

import ActiveProjectContextBridge from "./ActiveProjectContextBridge";
import BuilderPrecisionCompatibilityBridge from "./BuilderPrecisionCompatibilityBridge";
import BuilderTopRowAttachmentBridge from "./BuilderTopRowAttachmentBridge";
import BuilderUnifiedTopRowBridge from "./BuilderUnifiedTopRowBridge";
import BuilderWorkspacePersistenceBridge from "./BuilderWorkspacePersistenceBridge";
import ReviewedChangePersistenceBridge from "./ReviewedChangePersistenceBridge";
import GlobalNavigationRail from "./GlobalNavigationRail";
import { ProjectWorkspaceController } from "./ProjectWorkspaceController";
import WorkspaceCanvas from "./WorkspaceCanvas";

function ShellLayout() {
  return (
    <main
      className="universalWorkspaceShell"
      data-replacement-conversion="true"
      data-side-panels="removed"
      data-top-panels="removed"
      data-bottom-tray="removed"
      data-workstation-tabs="single-top-row"
    >
      <ActiveProjectContextBridge />
      <BuilderPrecisionCompatibilityBridge />
      <BuilderTopRowAttachmentBridge />
      <BuilderUnifiedTopRowBridge />
      <BuilderWorkspacePersistenceBridge />
      <ReviewedChangePersistenceBridge />
      <div className="workspaceBody">
        <GlobalNavigationRail />
        <section className="workspaceCenter">
          <WorkspaceCanvas />
        </section>
      </div>
      <style jsx global>{`
        .universalWorkspaceShell{height:100dvh;min-height:100dvh;display:grid;grid-template-rows:minmax(0,1fr);background:#020713;color:#f8fafc;overflow:hidden;font-size:14px}
        .workspaceBody{min-height:0;display:grid;grid-template-columns:72px minmax(0,1fr);overflow:hidden}
        .workspaceCenter{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden;background:#020713}
        .workspaceCanvas{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden}.workspaceCanvas.fullscreen{position:fixed;inset:0;z-index:30000;background:#020713}
        .existingBuilderSurface{min-width:0;min-height:0;overflow:auto;position:relative;background:#020713}.existingBuilderSurface .streamsBuilderShell{width:100%!important;max-width:100%!important;height:auto!important;min-height:100%!important}.existingBuilderSurface .centerWorkspace{min-height:100%!important}.existingBuilderSurface .workArea{min-height:calc(100dvh - 40px)!important}.existingBuilderSurface .workstationShell{min-height:calc(100dvh - 40px)!important;grid-template-rows:minmax(0,1fr) auto auto auto!important}
        .existingBuilderSurface .connectionRibbon{display:none!important}
        .existingBuilderSurface .stationViewport{position:relative!important;overflow:hidden!important}
        .existingBuilderSurface .topRow{height:40px!important;min-height:40px!important;display:flex!important;align-items:center!important;gap:8px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0 4px!important;border-bottom:1px solid #30363d!important;background:#020617!important;scrollbar-width:thin}
        .existingBuilderSurface .topControlStrip{flex:1 0 650px!important;min-width:650px!important;height:36px!important;overflow:visible!important}
        .existingBuilderSurface .controls{flex:0 0 300px!important;min-width:300px!important;height:36px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
        .existingBuilderSurface .builderUnifiedTopRowActions{flex:0 0 auto;display:flex;align-items:center;gap:4px;height:36px;white-space:nowrap}
        .existingBuilderSurface .builderUnifiedTopRowActions button{height:30px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#7c3aed;color:#fff;padding:0 9px;font-size:11px;font-weight:900;cursor:pointer}
        .existingBuilderSurface .builderUnifiedTopRowActions button:hover{filter:brightness(1.1)}
        .existingBuilderSurface .builderUnifiedTopRowActions button.active{border-color:#2dd4bf;background:#065f46;color:#ccfbf1}
        .existingBuilderSurface .builderUnifiedTopRowActions button[data-unified-action="Attach"]{background:#0f766e;border-color:#2dd4bf;color:#ecfeff}
        .existingBuilderSurface [data-unified-duplicate="hidden"]{display:none!important}
        .existingBuilderSurface .liveWorkstation .previewSide{grid-template-rows:auto minmax(0,1fr) auto!important}
        .existingBuilderSurface .topControlStrip label:has(select),.existingBuilderSurface .controls label:has(select){position:relative!important;display:grid!important;grid-template-columns:auto 12px minmax(0,1fr)!important;gap:4px!important;align-items:center!important}
        .existingBuilderSurface .topControlStrip label:has(select)::after,.existingBuilderSurface .controls label:has(select)::after{content:"▾";grid-column:2;color:#cbd5e1;font-size:11px;line-height:1;pointer-events:none;align-self:center}
        .existingBuilderSurface .topControlStrip label:has(select)>b,.existingBuilderSurface .controls label:has(select)>b{grid-column:1}
        .existingBuilderSurface .topControlStrip label:has(select)>select,.existingBuilderSurface .controls label:has(select)>select{grid-column:3;appearance:none!important;-webkit-appearance:none!important;background-image:none!important;padding-right:2px!important}
        .globalNavigationRail .railItem small{font-size:11px!important;line-height:1.2!important}.globalNavigationRail .railItem span{font-size:17px!important}.globalNavigationRail .railItem{min-height:54px!important}
        .builderChatFrame .msg{font-size:15px!important;line-height:1.5!important;padding:11px 12px!important}.builderChatFrame .footerComposer input{font-size:16px!important;font-weight:700!important}.builderChatFrame .mobileFooter button{font-size:12px!important}.builderChatFrame .connectionStatus b{font-size:11px!important}.builderChatFrame .connectionStatus span{font-size:13px!important}.builderChatFrame .connectionActions button,.builderChatFrame .fallbackCommand button{font-size:12px!important}.builderChatFrame p{font-size:12px!important;line-height:1.45!important}.builderChatFrame .fallbackCommand summary{font-size:11px!important}.builderChatFrame textarea{font-size:14px!important;line-height:1.45!important}
        .streamsBuilderShell label b,.streamsBuilderShell .statusDrop b{font-size:11px!important}.streamsBuilderShell select,.streamsBuilderShell input,.streamsBuilderShell button{font-size:13px}.streamsBuilderShell .statusDrop span{font-size:12px!important;line-height:1.4!important}
        @media(max-width:1100px){.workspaceBody{grid-template-columns:64px minmax(0,1fr)}.globalNavigationRail .railItem small{font-size:10px!important}.existingBuilderSurface .topControlStrip{flex-basis:600px!important;min-width:600px!important}.existingBuilderSurface .controls{flex-basis:270px!important;min-width:270px!important}}
        @media(max-width:760px){.workspaceBody{grid-template-columns:58px minmax(0,1fr)}.existingBuilderSurface .workArea{grid-template-columns:1fr!important}.existingBuilderSurface .operatorColumn{display:none!important}.globalNavigationRail .railItem small{display:none}.builderChatFrame .msg{font-size:15px!important}.builderChatFrame .footerComposer input{font-size:16px!important}.existingBuilderSurface .topRow{overflow-x:auto!important}.existingBuilderSurface .topControlStrip{flex-basis:560px!important;min-width:560px!important}.existingBuilderSurface .controls{display:grid!important;flex-basis:250px!important;min-width:250px!important}}
      `}</style>
    </main>
  );
}

export default function ProjectWorkspaceShell() {
  return (
    <ProjectWorkspaceController>
      <ShellLayout />
    </ProjectWorkspaceController>
  );
}
