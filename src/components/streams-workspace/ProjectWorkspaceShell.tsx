"use client";

import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import { ProjectWorkspaceController } from "./ProjectWorkspaceController";
import WorkspaceBottomTray from "./WorkspaceBottomTray";

function ShellLayout() {
  return (
    <main
      className="projectWorkspaceShell"
      data-project-workspace-shell="true"
      data-layout="authoritative-three-column"
      data-replacement-conversion="true"
      data-side-panels="removed"
      data-top-overlays="removed"
      data-bottom-tray="restored"
      data-workstation-screens="restored"
      data-agent-status-strip="removed"
    >
      <section className="preservedBuilderSurface" data-preserved-builder-surface="true">
        <WorkspaceGrid />
      </section>
      <div className="workspaceContractTray" aria-hidden="true">
        <WorkspaceBottomTray />
      </div>
      <style jsx global>{`
        .projectWorkspaceShell{
          position:relative;
          width:100%;
          height:100dvh;
          min-width:0;
          min-height:0;
          overflow:hidden;
          background:#020713;
          color:#f8fafc;
        }
        .preservedBuilderSurface{
          width:100%;
          height:100%;
          min-width:0;
          min-height:0;
          overflow:hidden;
        }
        .preservedBuilderSurface>.streamsBuilderShell{
          width:100%!important;
          height:100%!important;
          min-width:0!important;
          min-height:0!important;
          overflow:hidden!important;
        }
        .projectWorkspaceShell .workArea{
          width:100%!important;
          height:100%!important;
          min-width:0!important;
          min-height:0!important;
          grid-template-columns:minmax(320px,.72fr) minmax(0,1fr) minmax(0,1fr)!important;
          overflow:hidden!important;
        }
        .projectWorkspaceShell .operatorColumn,
        .projectWorkspaceShell .centerColumn,
        .projectWorkspaceShell .visualColumn{
          min-width:0!important;
          min-height:0!important;
          height:100%!important;
          overflow:hidden!important;
        }
        .projectWorkspaceShell .centerColumn{
          display:grid!important;
          grid-template-rows:minmax(0,1fr) auto!important;
        }
        .projectWorkspaceShell .visualColumn>.visualEditor{
          width:100%!important;
          height:100%!important;
          min-width:0!important;
          min-height:0!important;
          overflow:hidden!important;
        }
        .workspaceContractTray{
          position:absolute;
          width:1px;
          height:1px;
          overflow:hidden;
          clip-path:inset(50%);
          white-space:nowrap;
          pointer-events:none;
        }
        @media(max-width:820px){
          .projectWorkspaceShell .workArea{grid-template-columns:minmax(0,1fr)!important}
          .projectWorkspaceShell .operatorColumn,
          .projectWorkspaceShell .visualColumn{display:none!important}
        }
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
