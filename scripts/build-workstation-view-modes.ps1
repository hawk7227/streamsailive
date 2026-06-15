# Streams Builder workstation view/control upgrade
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File scripts/build-workstation-view-modes.ps1
#
# This is a one-command view/control layer only.
# It preserves the existing WorkspaceGrid theme and structure:
# - streamsBuilderShell
# - leftRail
# - centerWorkspace
# - settingsRail
#
# It does not introduce oversized replacement panels, a new visual language,
# a new backend feature, a new provider router, or a new chat system.

$ErrorActionPreference = "Stop"

function Write-RepoFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $directory = Split-Path -Parent $Path
  if ($directory -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  Set-Content -Path $Path -Value $Content -Encoding UTF8 -NoNewline
  Write-Host "WROTE $Path"
}

if (-not (Test-Path "package.json")) {
  throw "Run this script from the streamsailive repo root. package.json was not found."
}

$baseScript = "scripts/build-personal-use-merged-builder.ps1"
if (-not (Test-Path $baseScript)) {
  throw "Missing $baseScript. This view layer must sit on top of the existing personal-use Builder surfaces."
}

$needsBase = $false
if (-not (Test-Path "src/lib/streams-builder/personal-use-merge.ts")) { $needsBase = $true }
if (-not (Test-Path "src/components/streams-builder/BuilderCenterChat.tsx")) { $needsBase = $true }
if (-not (Test-Path "src/app/api/streams-builder/personal-use-bridge/route.ts")) { $needsBase = $true }
if (-not (Test-Path "src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx")) { $needsBase = $true }
if ((Test-Path "src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx") -and ((Get-Content "src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx" -Raw) -notmatch "bridgeResult")) { $needsBase = $true }

if ($needsBase) {
  Write-Host "Existing personal-use Builder surfaces are missing or older. Running base merge script first."
  powershell -ExecutionPolicy Bypass -File $baseScript
}

$workspaceGrid = @'
"use client";

import { useMemo, useState } from "react";
import BuilderCenterChat from "./BuilderCenterChat";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import WorkspaceModulePanel, { type WorkspaceModuleName } from "./workspace-modules/WorkspaceModulePanel";
import {
  PERSONAL_USE_WORKSPACES,
  type PersonalUseBridgeResult,
  type PersonalUsePreviewTarget,
  type PersonalUseWorkspaceId,
  type PersonalUseWorkstationContext,
} from "@/lib/streams-builder/personal-use-merge";

type ViewMode = "multi" | "single" | "focus" | "stack";
type PanelPosition = "right-tab" | "bottom-drawer";
type Workspace = (typeof PERSONAL_USE_WORKSPACES)[number];

const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: "multi", label: "Multi" },
  { id: "single", label: "Single" },
  { id: "focus", label: "Focus" },
  { id: "stack", label: "Stack" },
];

const PANEL_POSITIONS: Array<{ id: PanelPosition; label: string }> = [
  { id: "right-tab", label: "Right Tab" },
  { id: "bottom-drawer", label: "Bottom Drawer" },
];

const PREVIEW_TARGETS: Array<{ id: PersonalUsePreviewTarget; label: string }> = [
  { id: "builder-preview", label: "Builder Preview" },
  { id: "chat-preview", label: "Chat Preview" },
];

function canIframeRoute(route: string) {
  return !route.startsWith("/api/") && route !== "/streams-ai/streams-builder" && route !== "/streams-builder";
}

function frameSrc(workspace: Workspace) {
  const params = new URLSearchParams({
    workstationFrame: "1",
    workspaceId: workspace.id,
    workspaceLabel: workspace.label,
  });
  return `${workspace.route}${workspace.route.includes("?") ? "&" : "?"}${params.toString()}`;
}

function WorkstationFrame({ workspace, active, bridgeResult }: { workspace: Workspace; active: boolean; bridgeResult: PersonalUseBridgeResult | null }) {
  const iframeReady = canIframeRoute(workspace.route);

  return (
    <section className={active ? "workstationFrame active" : "workstationFrame"}>
      <header className="frameHeader">
        <div>
          <b>{workspace.label}</b>
          <span>{workspace.route}</span>
        </div>
        <a href={workspace.route} target="_blank" rel="noreferrer">Open</a>
      </header>

      <div className="frameContent">
        {iframeReady ? (
          <iframe title={`${workspace.label} workstation`} src={frameSrc(workspace)} />
        ) : (
          <div className="compactSurface">
            <p><b>Component</b><span>{workspace.component}</span></p>
            <p><b>File</b><span>{workspace.file}</span></p>
            <p><b>Status</b><span>{active && bridgeResult ? bridgeResult.message : "Ready through existing Builder shell."}</span></p>
          </div>
        )}
      </div>
    </section>
  );
}

function StatusContent({ context, bridgeResult }: { context: PersonalUseWorkstationContext; bridgeResult: PersonalUseBridgeResult | null }) {
  return (
    <>
      <h2>Settings</h2>
      <p><b>Mode</b><span>View/control layer only</span></p>
      <p><b>Active</b><span>{context.workspaceLabel}</span></p>
      <p><b>Preview Target</b><span>{context.previewTarget}</span></p>
      <p><b>Backend Rule</b><span>Use existing personal-use reachability only. No new backend dependency.</span></p>
      <p><b>Status</b><span>{bridgeResult ? bridgeResult.message : "Waiting for bridge request."}</span></p>
      <WorkspaceModulePanel moduleName={context.workspaceLabel as WorkspaceModuleName} context={context} bridgeResult={bridgeResult} />
    </>
  );
}

export default function WorkspaceGrid() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<PersonalUseWorkspaceId>("primary-builder");
  const [previewTarget, setPreviewTarget] = useState<PersonalUsePreviewTarget>("builder-preview");
  const [bridgeResult, setBridgeResult] = useState<PersonalUseBridgeResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("multi");
  const [panelPosition, setPanelPosition] = useState<PanelPosition>("right-tab");
  const [statusOpen, setStatusOpen] = useState(true);

  const activeWorkspace = useMemo(
    () => PERSONAL_USE_WORKSPACES.find((workspace) => workspace.id === activeWorkspaceId) ?? PERSONAL_USE_WORKSPACES[0],
    [activeWorkspaceId],
  );

  const context: PersonalUseWorkstationContext = useMemo(
    () => ({
      workspaceId: activeWorkspace.id,
      workspaceLabel: activeWorkspace.label,
      previewTarget,
      route: activeWorkspace.route,
      component: activeWorkspace.component,
      file: activeWorkspace.file,
      projectId: "personal-use-builder",
    }),
    [activeWorkspace, previewTarget],
  );

  const stackWorkspaces = useMemo(() => {
    const remaining = PERSONAL_USE_WORKSPACES.filter((workspace) => workspace.id !== activeWorkspace.id);
    return [activeWorkspace, ...remaining];
  }, [activeWorkspace]);

  const shellClass = [
    "streamsBuilderShell",
    sidebarOpen ? "sidebarOpen" : "sidebarClosed",
    `view-${viewMode}`,
    `panel-${panelPosition}`,
    statusOpen ? "statusOpen" : "statusClosed",
  ].join(" ");

  return (
    <main className={shellClass}>
      <aside className="leftRail">
        <button className="toggleButton" type="button" onClick={() => setSidebarOpen((value) => !value)}>
          {sidebarOpen ? "Close" : "Open"}
        </button>

        <nav>
          {PERSONAL_USE_WORKSPACES.map((workspace) => (
            <button
              type="button"
              key={workspace.id}
              className={workspace.id === activeWorkspaceId ? "active" : ""}
              onClick={() => {
                setActiveWorkspaceId(workspace.id);
                setBridgeResult(null);
              }}
              title={workspace.label}
            >
              <span>{workspace.number}</span>
              {sidebarOpen ? <b>{workspace.label}</b> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="centerWorkspace">
        <div className="topRow">
          <GitHubRepositoryPicker />
          <div className="activeContext"><b>{activeWorkspace.label}</b><span>{activeWorkspace.route}</span></div>
        </div>

        <div className="controlStrip">
          <div><b>View Mode</b>{VIEW_MODES.map((mode) => <button key={mode.id} className={viewMode === mode.id ? "selected" : ""} type="button" onClick={() => setViewMode(mode.id)}>{mode.label}</button>)}</div>
          <div><b>Panel Position</b>{PANEL_POSITIONS.map((position) => <button key={position.id} className={panelPosition === position.id ? "selected" : ""} type="button" onClick={() => { setPanelPosition(position.id); setStatusOpen(true); }}>{position.label}</button>)}</div>
          <div><b>Preview Target</b>{PREVIEW_TARGETS.map((target) => <button key={target.id} className={previewTarget === target.id ? "selected" : ""} type="button" onClick={() => setPreviewTarget(target.id)}>{target.label}</button>)}</div>
        </div>

        <section className="workArea">
          {viewMode === "stack" ? (
            <div className="stackList">
              {stackWorkspaces.map((workspace) => <WorkstationFrame key={workspace.id} workspace={workspace} active={workspace.id === activeWorkspace.id} bridgeResult={bridgeResult} />)}
            </div>
          ) : (
            <WorkstationFrame workspace={activeWorkspace} active bridgeResult={bridgeResult} />
          )}

          <div className="chatColumn"><BuilderCenterChat context={context} onResult={setBridgeResult} /></div>
        </section>

        {panelPosition === "bottom-drawer" ? (
          <section className={statusOpen ? "bottomDrawer open" : "bottomDrawer closed"}>
            <button type="button" onClick={() => setStatusOpen((value) => !value)}>{statusOpen ? "Hide Status" : "Show Status"}</button>
            {statusOpen ? <StatusContent context={context} bridgeResult={bridgeResult} /> : null}
          </section>
        ) : null}
      </section>

      {panelPosition === "right-tab" ? (
        <aside className={statusOpen ? "settingsRail" : "settingsRail collapsed"}>
          <button className="settingsToggle" type="button" onClick={() => setStatusOpen((value) => !value)}>{statusOpen ? "Hide" : "Status"}</button>
          {statusOpen ? <StatusContent context={context} bridgeResult={bridgeResult} /> : null}
        </aside>
      ) : null}

      <style jsx global>{`
        html,
        body {
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
        }
      `}</style>

      <style jsx>{`
        .streamsBuilderShell {
          width: 100vw;
          height: 100dvh;
          max-width: 100vw;
          max-height: 100dvh;
          min-height: 0;
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr) 180px;
          gap: 6px;
          overflow: hidden;
          background: #020713;
          color: #fff;
          padding: 6px;
          box-sizing: border-box;
        }

        .streamsBuilderShell.sidebarOpen {
          grid-template-columns: 190px minmax(0, 1fr) 180px;
        }

        .streamsBuilderShell.panel-bottom-drawer,
        .streamsBuilderShell.panel-bottom-drawer.sidebarOpen {
          grid-template-columns: ${sidebarOpen ? "190px" : "56px"} minmax(0, 1fr);
        }

        .streamsBuilderShell.statusClosed.panel-right-tab,
        .streamsBuilderShell.statusClosed.panel-right-tab.sidebarOpen {
          grid-template-columns: ${sidebarOpen ? "190px" : "56px"} minmax(0, 1fr) 42px;
        }

        .leftRail,
        .centerWorkspace,
        .settingsRail,
        .bottomDrawer,
        .workstationFrame,
        .chatColumn {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          overflow: hidden;
          box-sizing: border-box;
        }

        .leftRail { padding: 6px; }
        .toggleButton,
        .controlStrip button,
        .settingsToggle,
        .bottomDrawer > button,
        .frameHeader a {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 10px;
          background: #7c3aed;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
        }

        .toggleButton { width: 100%; height: 34px; }
        nav { display: grid; gap: 8px; margin-top: 10px; overflow: auto; }
        nav button {
          min-width: 0;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          background: #020617;
          color: #fff;
          cursor: pointer;
        }
        nav button.active { background: linear-gradient(135deg, #7c3aed, #4c1d95); border-color: rgba(167, 139, 250, 0.55); }
        nav span { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; background: rgba(255, 255, 255, 0.08); font-size: 13px; font-weight: 900; flex: 0 0 auto; }
        nav b { flex: 1; min-width: 0; text-align: left; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .centerWorkspace {
          padding: 6px;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr) auto;
          gap: 6px;
          overflow: hidden;
        }

        .topRow { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 6px; min-width: 0; }
        .activeContext { border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 12px; background: rgba(2, 6, 23, 0.72); padding: 8px; overflow: hidden; }
        .activeContext b { display: block; font-size: 12px; }
        .activeContext span { display: block; color: #cbd5e1; font-size: 10px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .controlStrip { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.9fr); gap: 6px; min-width: 0; }
        .controlStrip > div { min-width: 0; border: 1px solid rgba(148, 163, 184, 0.14); border-radius: 12px; background: rgba(2, 6, 23, 0.48); padding: 6px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .controlStrip b { color: #6ee7b7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 2px; }
        .controlStrip button { background: #020617; padding: 7px 9px; }
        .controlStrip button.selected { background: #7c3aed; border-color: rgba(167, 139, 250, 0.55); }

        .workArea { min-width: 0; min-height: 0; display: grid; gap: 6px; overflow: hidden; }
        .view-multi .workArea { grid-template-columns: minmax(0, 1fr) minmax(360px, 430px); }
        .view-single .workArea { grid-template-columns: minmax(0, 1fr) minmax(340px, 410px); }
        .view-focus .workArea { grid-template-columns: minmax(0, 1fr) minmax(300px, 360px); }
        .view-stack .workArea { grid-template-columns: minmax(0, 1fr) minmax(330px, 400px); }

        .workstationFrame { display: grid; grid-template-rows: auto minmax(0, 1fr); background: rgba(15, 23, 42, 0.58); }
        .workstationFrame.active { border-color: rgba(167, 139, 250, 0.34); }
        .frameHeader { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px; border-bottom: 1px solid rgba(148, 163, 184, 0.14); }
        .frameHeader b { display: block; font-size: 12px; }
        .frameHeader span { display: block; margin-top: 2px; color: #cbd5e1; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .frameHeader a { padding: 6px 8px; background: #020617; }
        .frameContent { min-width: 0; min-height: 0; overflow: hidden; background: #020617; }
        .frameContent iframe { width: 100%; height: 100%; border: 0; display: block; background: #020617; }

        .compactSurface { height: 100%; min-height: 0; overflow: auto; padding: 8px; display: grid; align-content: start; gap: 8px; }
        .compactSurface p { margin: 0; border: 1px solid rgba(148, 163, 184, 0.14); border-radius: 10px; background: rgba(15, 23, 42, 0.62); padding: 8px; }
        .compactSurface b { display: block; color: #6ee7b7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
        .compactSurface span { display: block; color: #cbd5e1; font-size: 11px; margin-top: 4px; overflow-wrap: anywhere; }

        .stackList { min-width: 0; min-height: 0; overflow: auto; display: grid; gap: 6px; }
        .stackList .workstationFrame { min-height: 420px; }
        .chatColumn { overflow: auto; padding: 6px; }

        .settingsRail { padding: 10px; overflow: auto; font-size: 11px; line-height: 1.35; }
        .settingsRail.collapsed { padding: 6px; }
        .settingsRail h2 { margin: 0 0 12px; font-size: 14px; }
        .settingsRail p { margin: 0 0 12px; color: #cbd5e1; }
        .settingsRail b { display: block; color: #6ee7b7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }
        .settingsRail span { display: block; }
        .settingsToggle { width: 100%; min-height: 30px; margin-bottom: 8px; }

        .bottomDrawer { max-height: 34dvh; overflow: auto; padding: 8px 10px 10px; font-size: 11px; line-height: 1.35; }
        .bottomDrawer.closed { max-height: 42px; padding: 6px; }
        .bottomDrawer > button { width: 100%; min-height: 30px; margin-bottom: 8px; }
        .bottomDrawer h2 { margin: 0 0 8px; font-size: 13px; }
        .bottomDrawer p { margin: 0 0 8px; color: #cbd5e1; }
        .bottomDrawer b { display: block; color: #6ee7b7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }

        @media (max-width: 1180px) {
          .streamsBuilderShell,
          .streamsBuilderShell.sidebarOpen,
          .streamsBuilderShell.panel-right-tab,
          .streamsBuilderShell.panel-right-tab.sidebarOpen {
            grid-template-columns: 56px minmax(0, 1fr);
          }
          .settingsRail { display: none; }
          .workArea,
          .view-multi .workArea,
          .view-single .workArea,
          .view-focus .workArea,
          .view-stack .workArea { grid-template-columns: minmax(0, 1fr); overflow: auto; }
          .chatColumn { min-height: 560px; }
          .controlStrip,
          .topRow { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </main>
  );
}
'@

Write-RepoFile -Path "src/components/streams-builder/WorkspaceGrid.tsx" -Content $workspaceGrid

Write-Host "Running production build..."
pnpm build

Write-Host "Theme-preserving workstation view/control upgrade completed."
