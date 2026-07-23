"use client";

import ActiveProjectContextBridge from "./ActiveProjectContextBridge";
import BuilderPrecisionCompatibilityBridge from "./BuilderPrecisionCompatibilityBridge";
import BuilderTopRowAttachmentBridge from "./BuilderTopRowAttachmentBridge";
import BuilderUnifiedTopRowBridge from "./BuilderUnifiedTopRowBridge";
import BuilderWorkspacePersistenceBridge from "./BuilderWorkspacePersistenceBridge";
import ReviewedChangePersistenceBridge from "./ReviewedChangePersistenceBridge";
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
    <main
      className="universalWorkspaceShell"
      data-replacement-conversion="true"
      data-side-panels="restored"
      data-top-panels="restored"
      data-bottom-tray="restored"
      data-workstation-tabs="single-top-row"
      data-agent-status-strip="removed"
    >
      <ActiveProjectContextBridge />
      <BuilderPrecisionCompatibilityBridge />
      <BuilderTopRowAttachmentBridge />
      <BuilderUnifiedTopRowBridge />
      <BuilderWorkspacePersistenceBridge />
      <ReviewedChangePersistenceBridge />
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
        .universalWorkspaceShell{height:100dvh;min-height:100dvh;display:grid;grid-template-rows:58px minmax(0,1fr) auto;background:#020713;color:#f8fafc;overflow:hidden;font-size:14px}
        .projectTopBar{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 12px;border-bottom:1px solid rgba(148,163,184,.2);background:#07101f;position:relative;z-index:20000}
        .projectIdentity,.projectActions,.canvasTools,.inspectorTabs,.trayTabs{display:flex;align-items:center;gap:8px;min-width:0}
        .brandButton,.profileButton{width:36px;height:36px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:#111c31;color:#f8fafc;font-weight:900}
        .projectTitleBlock{display:grid;gap:2px;min-width:0}.projectTitleBlock strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.projectTitleBlock span{font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .projectActions{justify-content:flex-end;overflow:auto}.projectActions button,.canvasTools button,.canvasTools select,.inspectorTabs button,.trayTabs button{min-height:32px;border:1px solid rgba(148,163,184,.24);border-radius:8px;background:#0f1a2d;color:#dbeafe;font-size:11px;font-weight:800;padding:0 10px;white-space:nowrap}.projectActions .primaryAction{background:#4f46e5;border-color:#6366f1;color:#fff}
        .workspaceBody{min-height:0;display:grid;transition:grid-template-columns .2s ease;overflow:hidden}
        .globalNavigationRail{min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:8px 6px;border-right:1px solid rgba(148,163,184,.16);background:#050d19;overflow:auto}
        .globalNavigationRail button{display:grid;justify-items:center;gap:2px;min-height:48px;border:0;border-radius:10px;background:transparent;color:#94a3b8;padding:6px 2px}.globalNavigationRail button span{font-size:15px;font-weight:900}.globalNavigationRail button small{font-size:8px}.globalNavigationRail button.active{background:#172554;color:#bfdbfe}
        .projectContextPanel,.contextInspectorPanel{min-width:0;overflow:auto;background:#08111f}.projectContextPanel{border-right:1px solid rgba(148,163,184,.16);padding:10px}.projectContextPanel>header,.inspectorContent>header{display:grid;gap:2px;padding:4px 2px 10px}.projectContextPanel header span,.inspectorContent header span{font-size:10px;color:#94a3b8}.contextGroup{border-top:1px solid rgba(148,163,184,.14);padding:10px 0}.contextGroup h3{margin:0 0 8px;font-size:11px;color:#6ee7b7}.contextGroup ul,.inspectorContent ul{list-style:none;margin:0;padding:0;display:grid;gap:5px}.contextGroup li,.inspectorContent li{font-size:10px;color:#cbd5e1;padding:5px 7px;border-radius:6px;background:rgba(15,23,42,.75)}
        .workspaceCenter{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#020713}.projectOverviewBlock{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:6px;border-bottom:1px solid rgba(148,163,184,.14);background:#050d19}.projectOverviewBlock div{min-width:0;border:1px solid rgba(148,163,184,.14);border-radius:8px;padding:6px 8px;background:#0b1424}.projectOverviewBlock span,.projectOverviewBlock strong{display:block}.projectOverviewBlock span{font-size:8px;text-transform:uppercase;color:#6ee7b7}.projectOverviewBlock strong{font-size:10px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .workspaceCanvas{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.workspaceCanvas.fullscreen{position:fixed;inset:0;z-index:30000;background:#020713}.canvasHeader{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border-bottom:1px solid rgba(148,163,184,.16);background:#07101f}.canvasHeader>div:first-child{display:grid;gap:2px;min-width:0}.canvasHeader strong{font-size:11px}.canvasHeader span{font-size:9px;color:#94a3b8}.canvasTools{overflow:auto}.canvasTools select{max-width:190px}
        .existingBuilderSurface{min-width:0;min-height:0;overflow:auto;position:relative;background:#020713}.existingBuilderSurface .streamsBuilderShell{width:100%!important;max-width:100%!important;height:auto!important;min-height:100%!important}.existingBuilderSurface .centerWorkspace{min-height:100%!important}.existingBuilderSurface .workArea{min-height:calc(100dvh - 180px)!important}.existingBuilderSurface .workstationShell{min-height:calc(100dvh - 180px)!important}
        .existingBuilderSurface .connectionRibbon,.existingBuilderSurface .workstationShell>.wsChrome,.existingBuilderSurface .liveWorkstation .debug{display:none!important}
        .existingBuilderSurface .stationViewport{position:relative!important;overflow:hidden!important;height:100%!important;min-height:0!important}
        .existingBuilderSurface .topRow{height:40px!important;min-height:40px!important;display:flex!important;align-items:center!important;gap:6px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0 4px!important;border-bottom:1px solid #30363d!important;background:#020617!important;scrollbar-width:thin}
        .existingBuilderSurface .topControlStrip{flex:1 1 560px!important;min-width:520px!important;height:36px!important;overflow:hidden!important;column-gap:6px!important}.existingBuilderSurface .topControlStrip>small{display:none!important}
        .existingBuilderSurface .controls{flex:0 0 254px!important;min-width:254px!important;height:36px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important;overflow:hidden!important}
        .existingBuilderSurface .controls label:has(select){display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;gap:5px!important;align-items:center!important;overflow:hidden!important}.existingBuilderSurface .controls label:has(select)::after{display:none!important}.existingBuilderSurface .controls label:has(select)>b{grid-column:1!important;white-space:nowrap!important;font-size:10px!important}.existingBuilderSurface .controls label:has(select)>select{grid-column:2!important;min-width:0!important;padding:0 2px!important;font-size:12px!important;text-overflow:ellipsis!important}
        .existingBuilderSurface .builderUnifiedTopRowActions{flex:0 0 auto;display:flex;align-items:center;gap:2px;height:34px;white-space:nowrap;padding-right:2px}.existingBuilderSurface .builderUnifiedTopRowActions button{height:25px;min-width:0;border:0;border-radius:5px;background:rgba(124,58,237,.72);color:#fff;padding:0 6px;font-size:10px;line-height:1;font-weight:850;cursor:pointer;box-shadow:none}.existingBuilderSurface .builderUnifiedTopRowActions button:hover{background:#7c3aed}.existingBuilderSurface .builderUnifiedTopRowActions button.active{background:#065f46;color:#ccfbf1;outline:1px solid rgba(45,212,191,.75)}.existingBuilderSurface .builderUnifiedTopRowActions button[data-unified-action="Attach"]{background:rgba(15,118,110,.78);color:#ecfeff}.existingBuilderSurface [data-unified-duplicate="hidden"]{display:none!important}
        .contextInspectorPanel{border-left:1px solid rgba(148,163,184,.16);display:grid;grid-template-rows:auto minmax(0,1fr)}.inspectorTabs{padding:6px;overflow:auto;border-bottom:1px solid rgba(148,163,184,.14)}.inspectorTabs button.active,.trayTabs button.active{background:#1d4ed8;border-color:#3b82f6;color:#fff}.inspectorContent{padding:8px;overflow:auto}.askAiPlaceholder{display:grid;gap:10px;font-size:11px;color:#cbd5e1}.askAiPlaceholder button{height:36px;border:1px solid #3b82f6;border-radius:8px;background:#1d4ed8;color:#fff;font-weight:800}.projectGuidancePanel{display:grid;gap:10px}
        .workspaceBottomTray{border-top:1px solid rgba(148,163,184,.18);background:#050d19}.trayTabs{min-height:38px;padding:4px 8px;overflow:auto}.trayToggle{margin-left:auto}.trayContent{min-height:120px;max-height:240px;display:grid;align-content:start;gap:6px;padding:10px;border-top:1px solid rgba(148,163,184,.14);overflow:auto}.trayContent strong{font-size:12px}.trayContent span{font-size:10px;color:#94a3b8}
        .globalNavigationRail .railItem small{font-size:11px!important;line-height:1.2!important}.globalNavigationRail .railItem span{font-size:17px!important}.globalNavigationRail .railItem{min-height:54px!important}
        .builderChatFrame .msg{font-size:15px!important;line-height:1.5!important;padding:11px 12px!important}.builderChatFrame .footerComposer input{font-size:16px!important;font-weight:700!important}.builderChatFrame .mobileFooter button{font-size:12px!important}.builderChatFrame .connectionStatus b{font-size:11px!important}.builderChatFrame .connectionStatus span{font-size:13px!important}.builderChatFrame .connectionActions button,.builderChatFrame .fallbackCommand button{font-size:12px!important}.builderChatFrame p{font-size:12px!important;line-height:1.45!important}.builderChatFrame .fallbackCommand summary{font-size:11px!important}.builderChatFrame textarea{font-size:14px!important;line-height:1.45!important}
        .streamsBuilderShell label b,.streamsBuilderShell .statusDrop b{font-size:11px!important}.streamsBuilderShell select,.streamsBuilderShell input,.streamsBuilderShell button{font-size:13px}.streamsBuilderShell .statusDrop span{font-size:12px!important;line-height:1.4!important}
        @media(max-width:1100px){.workspaceBody{grid-template-columns:64px minmax(220px,260px) minmax(0,1fr)!important}.contextInspectorPanel{display:none}.projectOverviewBlock{grid-template-columns:repeat(2,minmax(0,1fr))}.projectActions button:nth-of-type(-n+4){display:none}.globalNavigationRail .railItem small{font-size:10px!important}.existingBuilderSurface .topControlStrip{flex-basis:510px!important;min-width:490px!important}.existingBuilderSurface .controls{flex-basis:238px!important;min-width:238px!important}.existingBuilderSurface .builderUnifiedTopRowActions button{padding:0 5px;font-size:9px}}
        @media(max-width:760px){.universalWorkspaceShell{grid-template-rows:54px minmax(0,1fr) auto}.projectTopBar{padding:7px 8px}.projectActions button:not(.primaryAction):not(.profileButton):not(.panelControl):not(.trayControl){display:none}.projectActions .primaryAction{display:none}.workspaceBody{grid-template-columns:58px minmax(0,1fr)!important}.projectContextPanel,.contextInspectorPanel{display:none}.projectOverviewBlock{grid-template-columns:1fr 1fr}.projectOverviewBlock div:nth-child(n+3){display:none}.canvasTools button:nth-of-type(n+2),.canvasTools select{display:none}.existingBuilderSurface .workArea{grid-template-columns:1fr!important}.existingBuilderSurface .operatorColumn{display:none!important}.globalNavigationRail .railItem small{display:none}.existingBuilderSurface .topRow{overflow-x:auto!important}.existingBuilderSurface .topControlStrip{flex-basis:500px!important;min-width:500px!important}.existingBuilderSurface .controls{display:grid!important;flex-basis:232px!important;min-width:232px!important}.existingBuilderSurface .builderUnifiedTopRowActions button{height:24px;padding:0 5px;font-size:9px}}
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
