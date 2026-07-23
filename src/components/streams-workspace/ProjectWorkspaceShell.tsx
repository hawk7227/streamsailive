"use client";

import ActiveProjectContextBridge from "./ActiveProjectContextBridge";
import BuilderPrecisionCompatibilityBridge from "./BuilderPrecisionCompatibilityBridge";
import BuilderWorkspacePersistenceBridge from "./BuilderWorkspacePersistenceBridge";
import ReviewedChangePersistenceBridge from "./ReviewedChangePersistenceBridge";
import GlobalNavigationRail from "./GlobalNavigationRail";
import { ProjectWorkspaceController } from "./ProjectWorkspaceController";
import WorkspaceBottomTray from "./WorkspaceBottomTray";
import WorkspaceCanvas from "./WorkspaceCanvas";

function ShellLayout() {
  return (
    <main className="universalWorkspaceShell" data-replacement-conversion="true" data-side-panels="removed" data-top-panels="removed">
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
      <WorkspaceBottomTray />
      <style jsx global>{`
        .universalWorkspaceShell{height:100dvh;min-height:100dvh;display:grid;grid-template-rows:minmax(0,1fr) auto;background:#020713;color:#f8fafc;overflow:hidden;font-size:14px}
        .workspaceBody{min-height:0;display:grid;grid-template-columns:72px minmax(0,1fr);overflow:hidden}
        .workspaceCenter{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden;background:#020713}
        .workspaceCanvas{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden}.workspaceCanvas.fullscreen{position:fixed;inset:0;z-index:30000;background:#020713}
        .existingBuilderSurface{min-width:0;min-height:0;overflow:auto;position:relative;background:#020713}.existingBuilderSurface .streamsBuilderShell{width:100%!important;max-width:100%!important;height:auto!important;min-height:100%!important}.existingBuilderSurface .centerWorkspace{min-height:100%!important}.existingBuilderSurface .workArea{min-height:calc(100dvh - 46px)!important}.existingBuilderSurface .workstationShell{min-height:calc(100dvh - 46px)!important}
        .workspaceBottomTray{border-top:1px solid rgba(148,163,184,.18);background:#050d19}.trayTabs{min-height:42px;padding:5px 8px;overflow:auto}.trayTabs button{min-height:34px;border:1px solid rgba(148,163,184,.24);border-radius:8px;background:#0f1a2d;color:#dbeafe;font-size:13px;font-weight:800;padding:0 11px;white-space:nowrap}.trayTabs button.active{background:#1d4ed8;border-color:#3b82f6;color:#fff}.trayToggle{margin-left:auto}.trayContent{min-height:120px;max-height:240px;display:grid;align-content:start;gap:8px;padding:12px;border-top:1px solid rgba(148,163,184,.14);overflow:auto}.trayContent strong{font-size:15px}.trayContent span{font-size:13px;line-height:1.4;color:#94a3b8}
        .globalNavigationRail .railItem small{font-size:11px!important;line-height:1.2!important}.globalNavigationRail .railItem span{font-size:17px!important}.globalNavigationRail .railItem{min-height:54px!important}
        .builderChatFrame .msg{font-size:15px!important;line-height:1.5!important;padding:11px 12px!important}.builderChatFrame .footerComposer input{font-size:16px!important;font-weight:700!important}.builderChatFrame .mobileFooter button{font-size:12px!important}.builderChatFrame .connectionStatus b{font-size:11px!important}.builderChatFrame .connectionStatus span{font-size:13px!important}.builderChatFrame .connectionActions button,.builderChatFrame .fallbackCommand button{font-size:12px!important}.builderChatFrame p{font-size:12px!important;line-height:1.45!important}.builderChatFrame .fallbackCommand summary{font-size:11px!important}.builderChatFrame textarea{font-size:14px!important;line-height:1.45!important}
        .streamsBuilderShell label b,.streamsBuilderShell .statusDrop b{font-size:11px!important}.streamsBuilderShell select,.streamsBuilderShell input,.streamsBuilderShell button{font-size:13px}.streamsBuilderShell .connectionRibbon,.streamsBuilderShell .statusDrop span{font-size:12px!important;line-height:1.4!important}
        @media(max-width:1100px){.workspaceBody{grid-template-columns:64px minmax(0,1fr)}.globalNavigationRail .railItem small{font-size:10px!important}}
        @media(max-width:760px){.workspaceBody{grid-template-columns:58px minmax(0,1fr)}.existingBuilderSurface .workArea{grid-template-columns:1fr!important}.existingBuilderSurface .operatorColumn{display:none!important}.existingBuilderSurface .topRow{grid-template-columns:1fr!important}.existingBuilderSurface .controls{display:none!important}.globalNavigationRail .railItem small{display:none}.builderChatFrame .msg{font-size:15px!important}.builderChatFrame .footerComposer input{font-size:16px!important}}
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
