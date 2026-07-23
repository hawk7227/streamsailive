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
      data-agent-status-strip="removed"
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
        .existingBuilderSurface{min-width:0;min-height:0;overflow:auto;position:relative;background:#020713}.existingBuilderSurface .streamsBuilderShell{width:100%!important;max-width:100%!important;height:auto!important;min-height:100%!important}.existingBuilderSurface .centerWorkspace{min-height:100%!important}.existingBuilderSurface .workArea{min-height:calc(100dvh - 40px)!important}.existingBuilderSurface .workstationShell{min-height:calc(100dvh - 40px)!important;grid-template-rows:minmax(0,1fr)!important}
        .existingBuilderSurface .connectionRibbon,.existingBuilderSurface .workstationShell>.wsChrome,.existingBuilderSurface .liveWorkstation .debug{display:none!important}
        .existingBuilderSurface .stationViewport{position:relative!important;overflow:hidden!important;grid-row:1!important;height:100%!important;min-height:0!important}
        .existingBuilderSurface .topRow{height:40px!important;min-height:40px!important;display:flex!important;align-items:center!important;gap:6px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0 4px!important;border-bottom:1px solid #30363d!important;background:#020617!important;scrollbar-width:thin}
        .existingBuilderSurface .topControlStrip{flex:1 1 560px!important;min-width:520px!important;height:36px!important;overflow:hidden!important;column-gap:6px!important}
        .existingBuilderSurface .topControlStrip>small{display:none!important}
        .existingBuilderSurface .controls{flex:0 0 254px!important;min-width:254px!important;height:36px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important;overflow:hidden!important}
        .existingBuilderSurface .controls label:has(select){display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;gap:5px!important;align-items:center!important;overflow:hidden!important}
        .existingBuilderSurface .controls label:has(select)::after{display:none!important}
        .existingBuilderSurface .controls label:has(select)>b{grid-column:1!important;white-space:nowrap!important;font-size:10px!important}
        .existingBuilderSurface .controls label:has(select)>select{grid-column:2!important;min-width:0!important;padding:0 2px!important;font-size:12px!important;text-overflow:ellipsis!important}
        .existingBuilderSurface .builderUnifiedTopRowActions{flex:0 0 auto;display:flex;align-items:center;gap:2px;height:34px;white-space:nowrap;padding-right:2px}
        .existingBuilderSurface .builderUnifiedTopRowActions button{height:25px;min-width:0;border:0;border-radius:5px;background:rgba(124,58,237,.72);color:#fff;padding:0 6px;font-size:10px;line-height:1;font-weight:850;cursor:pointer;box-shadow:none}
        .existingBuilderSurface .builderUnifiedTopRowActions button:hover{background:#7c3aed;filter:none}
        .existingBuilderSurface .builderUnifiedTopRowActions button.active{background:#065f46;color:#ccfbf1;outline:1px solid rgba(45,212,191,.75)}
        .existingBuilderSurface .builderUnifiedTopRowActions button[data-unified-action="Attach"]{background:rgba(15,118,110,.78);color:#ecfeff}
        .existingBuilderSurface [data-unified-duplicate="hidden"]{display:none!important}
        .existingBuilderSurface .liveWorkstation .previewSide{grid-template-rows:minmax(0,1fr) auto auto!important;height:100%!important}
        .existingBuilderSurface .topControlStrip label:has(select){position:relative!important;display:grid!important;grid-template-columns:auto 10px minmax(0,1fr)!important;gap:3px!important;align-items:center!important;overflow:hidden!important}
        .existingBuilderSurface .topControlStrip label:has(select)::after{content:"▾";grid-column:2;color:#cbd5e1;font-size:9px;line-height:1;pointer-events:none;align-self:center}
        .existingBuilderSurface .topControlStrip label:has(select)>b{grid-column:1;white-space:nowrap}
        .existingBuilderSurface .topControlStrip label:has(select)>select{grid-column:3;appearance:none!important;-webkit-appearance:none!important;background-image:none!important;padding-right:1px!important}
        .globalNavigationRail .railItem small{font-size:11px!important;line-height:1.2!important}.globalNavigationRail .railItem span{font-size:17px!important}.globalNavigationRail .railItem{min-height:54px!important}
        .builderChatFrame .msg{font-size:15px!important;line-height:1.5!important;padding:11px 12px!important}.builderChatFrame .footerComposer input{font-size:16px!important;font-weight:700!important}.builderChatFrame .mobileFooter button{font-size:12px!important}.builderChatFrame .connectionStatus b{font-size:11px!important}.builderChatFrame .connectionStatus span{font-size:13px!important}.builderChatFrame .connectionActions button,.builderChatFrame .fallbackCommand button{font-size:12px!important}.builderChatFrame p{font-size:12px!important;line-height:1.45!important}.builderChatFrame .fallbackCommand summary{font-size:11px!important}.builderChatFrame textarea{font-size:14px!important;line-height:1.45!important}
        .streamsBuilderShell label b,.streamsBuilderShell .statusDrop b{font-size:11px!important}.streamsBuilderShell select,.streamsBuilderShell input,.streamsBuilderShell button{font-size:13px}.streamsBuilderShell .statusDrop span{font-size:12px!important;line-height:1.4!important}
        @media(max-width:1100px){.workspaceBody{grid-template-columns:64px minmax(0,1fr)}.globalNavigationRail .railItem small{font-size:10px!important}.existingBuilderSurface .topControlStrip{flex-basis:510px!important;min-width:490px!important}.existingBuilderSurface .controls{flex-basis:238px!important;min-width:238px!important}.existingBuilderSurface .builderUnifiedTopRowActions button{padding:0 5px;font-size:9px}}
        @media(max-width:760px){.workspaceBody{grid-template-columns:58px minmax(0,1fr)}.existingBuilderSurface .workArea{grid-template-columns:1fr!important}.existingBuilderSurface .operatorColumn{display:none!important}.globalNavigationRail .railItem small{display:none}.builderChatFrame .msg{font-size:15px!important}.builderChatFrame .footerComposer input{font-size:16px!important}.existingBuilderSurface .topRow{overflow-x:auto!important}.existingBuilderSurface .topControlStrip{flex-basis:500px!important;min-width:500px!important}.existingBuilderSurface .controls{display:grid!important;flex-basis:232px!important;min-width:232px!important}.existingBuilderSurface .builderUnifiedTopRowActions button{height:24px;padding:0 5px;font-size:9px}}
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
