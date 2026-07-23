"use client";

import ActiveProjectContextBridge from "./ActiveProjectContextBridge";
import BuilderPrecisionCompatibilityBridge from "./BuilderPrecisionCompatibilityBridge";
import BuilderTopRowAttachmentBridge from "./BuilderTopRowAttachmentBridge";
import BuilderWorkspacePersistenceBridge from "./BuilderWorkspacePersistenceBridge";
import ReviewedChangePersistenceBridge from "./ReviewedChangePersistenceBridge";
import GlobalNavigationRail from "./GlobalNavigationRail";
import { ProjectWorkspaceController } from "./ProjectWorkspaceController";
import WorkspaceBottomTray from "./WorkspaceBottomTray";
import WorkspaceCanvas from "./WorkspaceCanvas";

function ShellLayout() {
  return (
    <main
      className="universalWorkspaceShell"
      data-replacement-conversion="true"
      data-side-panels="removed"
      data-top-overlays="removed"
      data-bottom-tray="restored"
      data-workstation-screens="restored"
      data-agent-status-strip="removed"
    >
      <ActiveProjectContextBridge />
      <BuilderPrecisionCompatibilityBridge />
      <BuilderTopRowAttachmentBridge />
      <BuilderWorkspacePersistenceBridge />
      <ReviewedChangePersistenceBridge />
      <div className="workspaceBody">
        <GlobalNavigationRail />
        <section className="workspaceCenter">
          <WorkspaceCanvas />
        </section>
      </div>
      <WorkspaceBottomTray />
      <style jsx global>{`
        .universalWorkspaceShell{height:100dvh;min-height:100dvh;display:grid;grid-template-rows:minmax(0,1fr) auto;background:#020713;color:#f8fafc;overflow:hidden;font-size:14px}
        .workspaceBody{min-height:0;display:grid;grid-template-columns:72px minmax(0,1fr);overflow:hidden}
        .globalNavigationRail{min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:8px 6px;border-right:1px solid rgba(148,163,184,.16);background:#050d19;overflow:auto}
        .globalNavigationRail button{display:grid;justify-items:center;gap:2px;min-height:48px;border:0;border-radius:10px;background:transparent;color:#94a3b8;padding:6px 2px}.globalNavigationRail button span{font-size:15px;font-weight:900}.globalNavigationRail button small{font-size:8px}.globalNavigationRail button.active{background:#172554;color:#bfdbfe}
        .workspaceCenter{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden;background:#020713}
        .workspaceCanvas{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden}.workspaceCanvas.fullscreen{position:fixed;inset:0;z-index:30000;background:#020713}
        .existingBuilderSurface{min-width:0;min-height:0;overflow:auto;position:relative;background:#020713}.existingBuilderSurface .streamsBuilderShell{width:100%!important;max-width:100%!important;height:auto!important;min-height:100%!important}.existingBuilderSurface .centerWorkspace{min-height:100%!important}.existingBuilderSurface .workArea{min-height:calc(100dvh - 52px)!important}.existingBuilderSurface .workstationShell{min-height:calc(100dvh - 52px)!important}
        .existingBuilderSurface .connectionRibbon,.existingBuilderSurface .workstationShell>.wsChrome{display:none!important}
        .existingBuilderSurface .stationViewport{position:relative!important;overflow:hidden!important;height:100%!important;min-height:0!important}
        .existingBuilderSurface .topRow{height:40px!important;min-height:40px!important;display:flex!important;align-items:center!important;gap:6px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0 4px!important;border-bottom:1px solid #30363d!important;background:#020617!important;scrollbar-width:thin}
        .existingBuilderSurface .topControlStrip{flex:1 1 560px!important;min-width:520px!important;height:36px!important;overflow:hidden!important;column-gap:6px!important}.existingBuilderSurface .topControlStrip>small{display:none!important}
        .existingBuilderSurface .controls{flex:0 0 254px!important;min-width:254px!important;height:36px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important;overflow:hidden!important}
        .existingBuilderSurface .controls label:has(select){display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;gap:5px!important;align-items:center!important;overflow:hidden!important}.existingBuilderSurface .controls label:has(select)::after{display:none!important}.existingBuilderSurface .controls label:has(select)>b{grid-column:1!important;white-space:nowrap!important;font-size:10px!important}.existingBuilderSurface .controls label:has(select)>select{grid-column:2!important;min-width:0!important;padding:0 2px!important;font-size:12px!important;text-overflow:ellipsis!important}
        .existingBuilderSurface .liveWorkstation .workstationHeader{display:flex!important}.existingBuilderSurface .liveWorkstation .toolStrip{display:grid!important}.existingBuilderSurface .liveWorkstation .debug{display:grid!important}.existingBuilderSurface .liveWorkstation .content,.existingBuilderSurface .liveWorkstation .codeOnly,.existingBuilderSurface .liveWorkstation .codePreviewSplit{min-height:520px!important}
        .workspaceBottomTray{border-top:1px solid rgba(148,163,184,.18);background:#050d19}.trayTabs{min-height:38px;padding:4px 8px;overflow:auto}.trayToggle{margin-left:auto}.trayContent{min-height:120px;max-height:240px;display:grid;align-content:start;gap:6px;padding:10px;border-top:1px solid rgba(148,163,184,.14);overflow:auto}.trayContent strong{font-size:12px}.trayContent span{font-size:10px;color:#94a3b8}
        .globalNavigationRail .railItem small{font-size:11px!important;line-height:1.2!important}.globalNavigationRail .railItem span{font-size:17px!important}.globalNavigationRail .railItem{min-height:54px!important}
        .builderChatFrame .msg{font-size:15px!important;line-height:1.5!important;padding:11px 12px!important}.builderChatFrame .footerComposer input{font-size:16px!important;font-weight:700!important}.builderChatFrame .mobileFooter button{font-size:12px!important}.builderChatFrame .connectionStatus b{font-size:11px!important}.builderChatFrame .connectionStatus span{font-size:13px!important}.builderChatFrame .connectionActions button,.builderChatFrame .fallbackCommand button{font-size:12px!important}.builderChatFrame p{font-size:12px!important;line-height:1.45!important}.builderChatFrame .fallbackCommand summary{font-size:11px!important}.builderChatFrame textarea{font-size:14px!important;line-height:1.45!important}
        .streamsBuilderShell label b,.streamsBuilderShell .statusDrop b{font-size:11px!important}.streamsBuilderShell select,.streamsBuilderShell input,.streamsBuilderShell button{font-size:13px}.streamsBuilderShell .statusDrop span{font-size:12px!important;line-height:1.4!important}
        @media(max-width:1100px){.workspaceBody{grid-template-columns:64px minmax(0,1fr)}.globalNavigationRail .railItem small{font-size:10px!important}.existingBuilderSurface .topControlStrip{flex-basis:510px!important;min-width:490px!important}.existingBuilderSurface .controls{flex-basis:238px!important;min-width:238px!important}.existingBuilderSurface .liveWorkstation .toolStrip{overflow-x:auto!important;display:flex!important}}
        @media(max-width:760px){.universalWorkspaceShell{grid-template-rows:minmax(0,1fr) auto}.workspaceBody{grid-template-columns:58px minmax(0,1fr)}.existingBuilderSurface .workArea{grid-template-columns:1fr!important}.existingBuilderSurface .operatorColumn{display:none!important}.globalNavigationRail .railItem small{display:none}.existingBuilderSurface .topRow{overflow-x:auto!important}.existingBuilderSurface .topControlStrip{flex-basis:500px!important;min-width:500px!important}.existingBuilderSurface .controls{display:grid!important;flex-basis:232px!important;min-width:232px!important}.existingBuilderSurface .liveWorkstation .workstationHeader,.existingBuilderSurface .liveWorkstation .toolStrip{overflow-x:auto!important}}
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
