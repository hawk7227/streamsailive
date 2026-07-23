"use client";

import ActiveProjectContextBridge from "./ActiveProjectContextBridge";
import BuilderPrecisionCompatibilityBridge from "./BuilderPrecisionCompatibilityBridge";
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
      data-workstation-tabs="top-edge"
    >
      <ActiveProjectContextBridge />
      <BuilderPrecisionCompatibilityBridge />
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
        .existingBuilderSurface{min-width:0;min-height:0;overflow:auto;position:relative;background:#020713}.existingBuilderSurface .streamsBuilderShell{width:100%!important;max-width:100%!important;height:auto!important;min-height:100%!important}.existingBuilderSurface .centerWorkspace{min-height:100%!important}.existingBuilderSurface .workArea{min-height:100dvh!important}.existingBuilderSurface .workstationShell{min-height:100dvh!important;grid-template-rows:minmax(0,1fr) auto auto auto!important}
        .existingBuilderSurface .connectionRibbon{display:none!important}
        .existingBuilderSurface .stationViewport{position:relative!important;overflow:hidden!important}
        .existingBuilderSurface .liveWorkstation .workstationHeader{position:sticky!important;top:0!important;z-index:120!important;height:40px!important;min-height:40px!important;padding:0 8px!important;background:#020617!important;border-bottom:1px solid #30363d!important;box-shadow:0 1px 0 rgba(255,255,255,.02)!important}
        .existingBuilderSurface .liveWorkstation .topTabs{height:40px!important;align-items:stretch!important;gap:0!important;overflow-x:auto!important;overflow-y:hidden!important}
        .existingBuilderSurface .liveWorkstation .topTabs button{height:40px!important;border:0!important;border-bottom:2px solid transparent!important;border-radius:0!important;background:transparent!important;color:#8b949e!important;padding:0 14px!important;font-size:12px!important;font-weight:700!important}
        .existingBuilderSurface .liveWorkstation .topTabs button:hover{background:#0d1117!important;color:#f0f6fc!important}
        .existingBuilderSurface .liveWorkstation .topTabs button.active{border-bottom-color:#f78166!important;background:#0d1117!important;color:#f0f6fc!important}
        .existingBuilderSurface .liveWorkstation .routePill{height:40px!important;border-left:1px solid #30363d!important}
        .globalNavigationRail .railItem small{font-size:11px!important;line-height:1.2!important}.globalNavigationRail .railItem span{font-size:17px!important}.globalNavigationRail .railItem{min-height:54px!important}
        .builderChatFrame .msg{font-size:15px!important;line-height:1.5!important;padding:11px 12px!important}.builderChatFrame .footerComposer input{font-size:16px!important;font-weight:700!important}.builderChatFrame .mobileFooter button{font-size:12px!important}.builderChatFrame .connectionStatus b{font-size:11px!important}.builderChatFrame .connectionStatus span{font-size:13px!important}.builderChatFrame .connectionActions button,.builderChatFrame .fallbackCommand button{font-size:12px!important}.builderChatFrame p{font-size:12px!important;line-height:1.45!important}.builderChatFrame .fallbackCommand summary{font-size:11px!important}.builderChatFrame textarea{font-size:14px!important;line-height:1.45!important}
        .streamsBuilderShell label b,.streamsBuilderShell .statusDrop b{font-size:11px!important}.streamsBuilderShell select,.streamsBuilderShell input,.streamsBuilderShell button{font-size:13px}.streamsBuilderShell .statusDrop span{font-size:12px!important;line-height:1.4!important}
        @media(max-width:1100px){.workspaceBody{grid-template-columns:64px minmax(0,1fr)}.globalNavigationRail .railItem small{font-size:10px!important}}
        @media(max-width:760px){.workspaceBody{grid-template-columns:58px minmax(0,1fr)}.existingBuilderSurface .workArea{grid-template-columns:1fr!important}.existingBuilderSurface .operatorColumn{display:none!important}.existingBuilderSurface .topRow{grid-template-columns:1fr!important}.existingBuilderSurface .controls{display:none!important}.globalNavigationRail .railItem small{display:none}.builderChatFrame .msg{font-size:15px!important}.builderChatFrame .footerComposer input{font-size:16px!important}.existingBuilderSurface .liveWorkstation .topTabs button{padding:0 10px!important;font-size:11px!important}}
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
