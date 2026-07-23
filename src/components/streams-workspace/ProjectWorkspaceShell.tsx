"use client";

import ActiveProjectContextBridge from "./ActiveProjectContextBridge";
import BuilderPrecisionCompatibilityBridge from "./BuilderPrecisionCompatibilityBridge";
import BuilderWorkspacePersistenceBridge from "./BuilderWorkspacePersistenceBridge";
import ReviewedChangePersistenceBridge from "./ReviewedChangePersistenceBridge";
import GlobalNavigationRail from "./GlobalNavigationRail";
import ProjectOverviewBlock from "./ProjectOverviewBlock";
import ProjectTopBar from "./ProjectTopBar";
import { ProjectWorkspaceController } from "./ProjectWorkspaceController";
import WorkspaceBottomTray from "./WorkspaceBottomTray";
import WorkspaceCanvas from "./WorkspaceCanvas";

function ShellLayout() {
  return (
    <main className="universalWorkspaceShell" data-replacement-conversion="true" data-side-panels="removed">
      <ActiveProjectContextBridge />
      <BuilderPrecisionCompatibilityBridge />
      <BuilderWorkspacePersistenceBridge />
      <ReviewedChangePersistenceBridge />
      <ProjectTopBar />
      <div className="workspaceBody">
        <GlobalNavigationRail />
        <section className="workspaceCenter">
          <ProjectOverviewBlock />
          <WorkspaceCanvas />
        </section>
      </div>
      <WorkspaceBottomTray />
      <style jsx global>{`
        .universalWorkspaceShell{height:100dvh;min-height:100dvh;display:grid;grid-template-rows:58px minmax(0,1fr) auto;background:#020713;color:#f8fafc;overflow:hidden}
        .projectTopBar{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 12px;border-bottom:1px solid rgba(148,163,184,.2);background:#07101f;position:relative;z-index:20000}
        .projectIdentity,.projectActions,.canvasTools,.trayTabs{display:flex;align-items:center;gap:8px;min-width:0}
        .brandButton,.profileButton{width:36px;height:36px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:#111c31;color:#f8fafc;font-weight:900}
        .projectTitleBlock{display:grid;gap:2px;min-width:0}.projectTitleBlock strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.projectTitleBlock span{font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .projectActions{justify-content:flex-end;overflow:auto}.projectActions button,.canvasTools button,.canvasTools select,.trayTabs button{min-height:32px;border:1px solid rgba(148,163,184,.24);border-radius:8px;background:#0f1a2d;color:#dbeafe;font-size:11px;font-weight:800;padding:0 10px;white-space:nowrap}.projectActions .primaryAction{background:#4f46e5;border-color:#6366f1;color:#fff}
        .workspaceBody{min-height:0;display:grid;grid-template-columns:232px minmax(0,1fr);overflow:hidden}
        .workspaceCenter{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#020713}.projectOverviewBlock{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:6px;border-bottom:1px solid rgba(148,163,184,.14);background:#050d19}.projectOverviewBlock div{min-width:0;border:1px solid rgba(148,163,184,.14);border-radius:8px;padding:6px 8px;background:#0b1424}.projectOverviewBlock span,.projectOverviewBlock strong{display:block}.projectOverviewBlock span{font-size:8px;text-transform:uppercase;color:#6ee7b7}.projectOverviewBlock strong{font-size:10px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .workspaceCanvas{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.workspaceCanvas.fullscreen{position:fixed;inset:0;z-index:30000;background:#020713}.canvasHeader{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border-bottom:1px solid rgba(148,163,184,.16);background:#07101f}.canvasHeader>div:first-child{display:grid;gap:2px;min-width:0}.canvasHeader strong{font-size:11px}.canvasHeader span{font-size:9px;color:#94a3b8}.canvasTools{overflow:auto}.canvasTools select{max-width:190px}
        .existingBuilderSurface{min-width:0;min-height:0;overflow:auto;position:relative;background:#020713}.existingBuilderSurface .streamsBuilderShell{width:100%!important;max-width:100%!important;height:auto!important;min-height:100%!important}.existingBuilderSurface .centerWorkspace{min-height:100%!important}.existingBuilderSurface .workArea{min-height:calc(100dvh - 180px)!important}.existingBuilderSurface .workstationShell{min-height:calc(100dvh - 180px)!important}
        .workspaceBottomTray{border-top:1px solid rgba(148,163,184,.18);background:#050d19}.trayTabs{min-height:38px;padding:4px 8px;overflow:auto}.trayTabs button.active{background:#1d4ed8;border-color:#3b82f6;color:#fff}.trayToggle{margin-left:auto}.trayContent{min-height:120px;max-height:240px;display:grid;align-content:start;gap:6px;padding:10px;border-top:1px solid rgba(148,163,184,.14);overflow:auto}.trayContent strong{font-size:12px}.trayContent span{font-size:10px;color:#94a3b8}
        @media(max-width:1100px){.workspaceBody{grid-template-columns:210px minmax(0,1fr)}.projectOverviewBlock{grid-template-columns:repeat(2,minmax(0,1fr))}.projectActions button:nth-of-type(-n+4){display:none}}
        @media(max-width:760px){.universalWorkspaceShell{grid-template-rows:54px minmax(0,1fr) auto}.projectTopBar{padding:7px 8px}.projectActions button:not(.profileButton):not(.trayControl){display:none}.workspaceBody{grid-template-columns:190px minmax(0,1fr)}.projectOverviewBlock{grid-template-columns:1fr 1fr}.projectOverviewBlock div:nth-child(n+3){display:none}.canvasTools button:nth-of-type(n+2),.canvasTools select{display:none}.existingBuilderSurface .workArea{grid-template-columns:1fr!important}.existingBuilderSurface .operatorColumn{display:none!important}.existingBuilderSurface .topRow{grid-template-columns:1fr!important}.existingBuilderSurface .controls{display:none!important}}
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
