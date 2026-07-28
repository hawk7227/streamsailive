"use client";

import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import { ProjectWorkspaceController } from "./ProjectWorkspaceController";

function ShellLayout() {
  return (
    <main
      className="projectWorkspaceShell"
      data-project-workspace-shell="true"
      data-layout="authoritative-three-column"
    >
      <WorkspaceGrid />
      <style jsx global>{`
        .projectWorkspaceShell{
          width:100%;
          height:100dvh;
          min-width:0;
          min-height:0;
          overflow:hidden;
          background:#020713;
          color:#f8fafc;
        }
        .projectWorkspaceShell>.streamsBuilderShell{
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
