"use client";

import BuilderWorkspacePersistenceBridge from "./BuilderWorkspacePersistenceBridge";
import ContextInspectorPanel from "./ContextInspectorPanel";
import GlobalNavigationRail from "./GlobalNavigationRail";
import ProjectContextPanel from "./ProjectContextPanel";
import ProjectOverviewBlock from "./ProjectOverviewBlock";
import ProjectTopBar from "./ProjectTopBar";
import { ProjectWorkspaceController, useProjectWorkspace } from "./ProjectWorkspaceController";
import WorkspaceBottomTray from "./WorkspaceBottomTray";
import WorkspaceCanvas from "./WorkspaceCanvas";

function ShellLayout() {
  const { state } = useProjectWorkspace();
  const columns = [
    "72px",
    state.projectPanelOpen ? "minmax(260px, 300px)" : "0px",
    "minmax(0, 1fr)",
    state.inspectorOpen ? "minmax(300px, 340px)" : "0px",
  ].join(" ");

  return (
    <main className="universalWorkspaceShell" data-replacement-conversion="true">
      <BuilderWorkspacePersistenceBridge />
      <ProjectTopBar />
      <div className="workspaceBody" style={{ gridTemplateColumns: columns }}>
        <GlobalNavigationRail />
        <ProjectContextPanel />
        <section className="workspaceCenter">
          <ProjectOverviewBlock />
          <WorkspaceCanvas />
        </section>
        <ContextInspectorPanel />
      </div>
      <WorkspaceBottomTray />
      <style jsx global>{`
        .universalWorkspaceShell{height:100dvh;min-height:100dvh;display:grid;grid-template-rows:58px minmax(0,1fr) auto;background:#020713;color:#f8fafc;overflow:hidden}
        .projectTopBar{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 12px;border-bottom:1px solid rgba(148,163,184,.2);background:#07101f;position:relative;z-index:20000}
        .projectIdentity,.projectActions,.canvasTools,.inspectorTabs,.trayTabs{display:flex;align-items:center;gap:8px;min-width:0}
        .brandButton,.profileButton{width:36px;height:36px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:#111c31;color:#f8fafc;font-weight:900}
        .projectTitleBlock{display:grid;gap:2px;min-width:0}.projectTitleBlock strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.projectTitleBlock span{font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .projectActions{justify-content:flex-end;overflow:auto}.projectActions button,.canvasTools button,.canvasTools select,.inspectorTabs button,.trayTabs button{min-height:32px;border:1px solid rgba(148,163,184,.24);border-radius:8px;background:#0f1a2d;color:#dbeafe;font-size:11px;font-weight:800;padding:0 10px;white-space:nowrap}.projectActions .primaryAction{background:#4f46e5;border-color:#6366f1;color:#fff}
        .workspaceBody{min-height:0;display:grid;transition:grid-template-columns .2s ease;overflow:hidden}
        .globalNavigationRail{min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:8px 6px;border-right:1px solid rgba(148,163,184,.16);background:#050d19;overflow:auto}.globalNavigationRail button{display:grid;justify-items:center;gap:2px;min-height:48px;border:0;border-radius:10px;background:transparent;color:#94a3b8;padding:6px 2px}.globalNavigationRail button span{font-size:15px;font-weight:900}.globalNavigationRail button small{font-size:8px}.globalNavigationRail button.active{background:#172554;color:#bfdbfe}
        .projectContextPanel,.contextInspectorPanel{min-width:0;overflow:auto;background:#08111f}.projectContextPanel{border-right:1px solid rgba(148,163,184,.16);padding:10px}.projectContextPanel>header,.inspectorContent>header{display:grid;gap:2px;padding:4px 2px 10px}.projectContextPanel header span,.inspectorContent header span{font-size:10px;color:#94a3b8}.contextGroup{border-top:1px solid rgba(148,163,184,.14);padding:10px 0}.contextGroup h3{margin:0 0 8px;font-size:11px;color:#6ee7b7}.contextGroup ul,.inspectorContent ul{list-style:none;margin:0;padding:0;display:grid;gap:5px}.contextGroup li,.inspectorContent li{font-size:10px;color:#cbd5e1;padding:5px 7px;border-radius:6px;background:rgba(15,23,42,.75)}
        .workspaceCenter{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#020713}.projectOverviewBlock{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:6px;border-bottom:1px solid rgba(148,163,184,.14);background:#050d19}.projectOverviewBlock div{min-width:0;border:1px solid rgba(148,163,184,.14);border-radius:8px;padding:6px 8px;background:#0b1424}.projectOverviewBlock span,.projectOverviewBlock strong{display:block}.projectOverviewBlock span{font-size:8px;text-transform:uppercase;color:#6ee7b7}.projectOverviewBlock strong{font-size:10px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .workspaceCanvas{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.workspaceCanvas.fullscreen{position:fixed;inset:0;z-index:30000;background:#020713}.canvasHeader{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border-bottom:1px solid rgba(148,163,184,.16);background:#07101f}.canvasHeader>div:first-child{display:grid;gap:2px;min-width:0}.canvasHeader strong{font-size:11px}.canvasHeader span{font-size:9px;color:#94a3b8}.canvasTools{overflow:auto}.canvasTools select{max-width:190px}
        .existingBuilderSurface{min-width:0;min-height:0;overflow:auto;position:relative;background:#020713}.existingBuilderSurface .streamsBuilderShell{width:100%!important;max-width:100%!important;height:auto!important;min-height:100%!important}.existingBuilderSurface .centerWorkspace{min-height:100%!important}.existingBuilderSurface .workArea{min-height:calc(100dvh - 180px)!important}.existingBuilderSurface .workstationShell{min-height:calc(100dvh - 180px)!important}
        .contextInspectorPanel{border-left:1px solid rgba(148,163,184,.16);display:grid;grid-template-rows:auto minmax(0,1fr)}.inspectorTabs{padding:6px;overflow:auto;border-bottom:1px solid rgba(148,163,184,.14)}.inspectorTabs button.active,.trayTabs button.active{background:#1d4ed8;border-color:#3b82f6;color:#fff}.inspectorContent{padding:8px;overflow:auto}.askAiPlaceholder{display:grid;gap:10px;font-size:11px;color:#cbd5e1}.askAiPlaceholder button{height:36px;border:1px solid #3b82f6;border-radius:8px;background:#1d4ed8;color:#fff;font-weight:800}
        .workspaceBottomTray{border-top:1px solid rgba(148,163,184,.18);background:#050d19}.trayTabs{min-height:38px;padding:4px 8px;overflow:auto}.trayToggle{margin-left:auto}.trayContent{min-height:120px;max-height:240px;display:grid;align-content:start;gap:6px;padding:10px;border-top:1px solid rgba(148,163,184,.14);overflow:auto}.trayContent strong{font-size:12px}.trayContent span{font-size:10px;color:#94a3b8}
        @media(max-width:1100px){.workspaceBody{grid-template-columns:60px minmax(220px,260px) minmax(0,1fr)!important}.contextInspectorPanel{display:none}.projectOverviewBlock{grid-template-columns:repeat(2,minmax(0,1fr))}.projectActions button:nth-of-type(-n+4){display:none}}
        @media(max-width:760px){.universalWorkspaceShell{grid-template-rows:54px minmax(0,1fr) auto}.projectTopBar{padding:7px 8px}.projectActions button:not(.primaryAction):not(.profileButton){display:none}.projectActions .primaryAction{display:none}.workspaceBody{grid-template-columns:54px minmax(0,1fr)!important}.projectContextPanel{display:none}.projectOverviewBlock{grid-template-columns:1fr 1fr}.projectOverviewBlock div:nth-child(n+3){display:none}.canvasTools button:nth-of-type(n+2),.canvasTools select{display:none}.existingBuilderSurface .workArea{grid-template-columns:1fr!important}.existingBuilderSurface .operatorColumn{display:none!important}.existingBuilderSurface .topRow{grid-template-columns:1fr!important}.existingBuilderSurface .controls{display:none!important}.globalNavigationRail button small{display:none}}
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
