# Streams Builder workstation view/control upgrade
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File scripts/build-workstation-view-modes.ps1
#
# Scope:
# - Writes one complete production WorkspaceGrid.tsx upgrade.
# - Preserves existing center chat, bridge flow, readiness monitor, workstation context, and status/artifact return.
# - Adds Multi / Single / Focus / Stack view modes.
# - Adds Right Tab / Bottom Drawer monitor placement.
# - Adds Builder Preview / Chat Preview target controls.
# - Does not create or depend on new backend features.

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

$requiredFiles = @(
  "src/lib/streams-builder/personal-use-merge.ts",
  "src/components/streams-builder/BuilderCenterChat.tsx",
  "src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx"
)

foreach ($file in $requiredFiles) {
  if (-not (Test-Path $file)) {
    throw "Required existing Builder surface is missing: $file. Run the base personal-use merged Builder script first. This view layer does not create backend or bridge systems."
  }
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

type WorkstationViewMode = "multi" | "single" | "focus" | "stack";
type PanelPosition = "right-tab" | "bottom-drawer";

type WorkspaceEntry = (typeof PERSONAL_USE_WORKSPACES)[number];

const VIEW_MODES: Array<{ id: WorkstationViewMode; label: string; helper: string }> = [
  { id: "multi", label: "Multi", helper: "Overview with chat, workstation, and monitor surfaces." },
  { id: "single", label: "Single", helper: "One selected workstation fills the Builder area while chat stays available." },
  { id: "focus", label: "Focus", helper: "Selected workstation gets maximum room; monitor moves to tab/drawer." },
  { id: "stack", label: "Stack", helper: "Active workstation first, additional workstation screens below." },
];

const PANEL_POSITIONS: Array<{ id: PanelPosition; label: string }> = [
  { id: "right-tab", label: "Right Tab" },
  { id: "bottom-drawer", label: "Bottom Drawer" },
];

const PREVIEW_TARGETS: Array<{ id: PersonalUsePreviewTarget; label: string }> = [
  { id: "builder-preview", label: "Builder Preview" },
  { id: "chat-preview", label: "Chat Preview" },
];

function isBrowserFrameSafe(route: string) {
  if (route.startsWith("/api/")) return false;
  if (route === "/streams-ai/streams-builder") return false;
  if (route === "/streams-builder") return false;
  return true;
}

function makeFrameSrc(workspace: WorkspaceEntry) {
  const params = new URLSearchParams({
    workstationFrame: "1",
    workspaceId: workspace.id,
    workspaceLabel: workspace.label,
  });
  return `${workspace.route}${workspace.route.includes("?") ? "&" : "?"}${params.toString()}`;
}

function WorkstationFrame({
  workspace,
  active,
  bridgeResult,
}: {
  workspace: WorkspaceEntry;
  active: boolean;
  bridgeResult: PersonalUseBridgeResult | null;
}) {
  const safeForIframe = isBrowserFrameSafe(workspace.route);

  return (
    <section className={active ? "workstationFrame active" : "workstationFrame"} aria-label={`${workspace.label} workstation frame`}>
      <header className="frameHeader">
        <div className="frameTitleGroup">
          <span className="frameNumber">{workspace.number}</span>
          <div>
            <b>{workspace.label}</b>
            <small>{active ? "Active workstation context" : "Available workstation"}</small>
          </div>
        </div>
        <a href={workspace.route} target="_blank" rel="noreferrer">
          Open route
        </a>
      </header>

      <div className="frameBody">
        {safeForIframe ? (
          <iframe title={`${workspace.label} preview`} src={makeFrameSrc(workspace)} loading="lazy" />
        ) : (
          <div className="internalSurface" role="region" aria-label={`${workspace.label} internal surface`}>
            <b>{workspace.label}</b>
            <p>
              This workstation is already wired through the Builder shell, so this view renders it as an internal Builder surface instead of recursively iframe-loading the same Builder route.
            </p>
            <dl>
              <div>
                <dt>Route</dt>
                <dd>{workspace.route}</dd>
              </div>
              <div>
                <dt>Component</dt>
                <dd>{workspace.component}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{workspace.file}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{active && bridgeResult ? bridgeResult.message : "Ready through existing Builder shell surfaces."}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

function MonitorPanel({
  context,
  bridgeResult,
  panelPosition,
  statusPanelOpen,
  setStatusPanelOpen,
}: {
  context: PersonalUseWorkstationContext;
  bridgeResult: PersonalUseBridgeResult | null;
  panelPosition: PanelPosition;
  statusPanelOpen: boolean;
  setStatusPanelOpen: (value: boolean) => void;
}) {
  return (
    <aside
      className={[
        "monitorPanel",
        panelPosition === "right-tab" ? "rightTab" : "bottomDrawer",
        statusPanelOpen ? "open" : "closed",
      ].join(" ")}
      aria-label="Status monitor panel"
    >
      <button className="monitorHandle" type="button" onClick={() => setStatusPanelOpen(!statusPanelOpen)}>
        {statusPanelOpen ? "Hide Monitor" : "Show Monitor"}
      </button>

      <div className="monitorContent">
        <WorkspaceModulePanel
          moduleName={context.workspaceLabel as WorkspaceModuleName}
          context={context}
          bridgeResult={bridgeResult}
        />
      </div>
    </aside>
  );
}

export default function WorkspaceGrid() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<PersonalUseWorkspaceId>("primary-builder");
  const [previewTarget, setPreviewTarget] = useState<PersonalUsePreviewTarget>("builder-preview");
  const [bridgeResult, setBridgeResult] = useState<PersonalUseBridgeResult | null>(null);
  const [viewMode, setViewMode] = useState<WorkstationViewMode>("multi");
  const [panelPosition, setPanelPosition] = useState<PanelPosition>("right-tab");
  const [statusPanelOpen, setStatusPanelOpen] = useState(true);

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

  const orderedStackWorkspaces = useMemo(() => {
    const rest = PERSONAL_USE_WORKSPACES.filter((workspace) => workspace.id !== activeWorkspace.id);
    return [activeWorkspace, ...rest];
  }, [activeWorkspace]);

  const activeViewHelper = VIEW_MODES.find((mode) => mode.id === viewMode)?.helper ?? "Builder workstation view";

  return (
    <main
      className={[
        "streamsBuilderShell",
        sidebarOpen ? "sidebarOpen" : "sidebarClosed",
        `mode-${viewMode}`,
        `panel-${panelPosition}`,
        statusPanelOpen ? "monitorOpen" : "monitorClosed",
      ].join(" ")}
    >
      <aside className="leftRail" aria-label="Builder workstation list">
        <button className="railToggle" type="button" onClick={() => setSidebarOpen((value) => !value)}>
          {sidebarOpen ? "Collapse" : "Open"}
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

      <section className="workspaceMain" aria-label="Streams Builder workstation view layer">
        <header className="topStrip">
          <div className="repoSlot">
            <GitHubRepositoryPicker />
          </div>

          <section className="activeContextCard" aria-label="Active workstation context">
            <span>Active workstation</span>
            <b>{activeWorkspace.label}</b>
            <small>{activeWorkspace.route}</small>
          </section>
        </header>

        <section className="controlBar" aria-label="Builder view controls">
          <div className="controlGroup">
            <span>View Mode</span>
            <div>
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={viewMode === mode.id ? "selected" : ""}
                  onClick={() => setViewMode(mode.id)}
                  title={mode.helper}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="controlGroup">
            <span>Panel Position</span>
            <div>
              {PANEL_POSITIONS.map((position) => (
                <button
                  key={position.id}
                  type="button"
                  className={panelPosition === position.id ? "selected" : ""}
                  onClick={() => {
                    setPanelPosition(position.id);
                    setStatusPanelOpen(true);
                  }}
                >
                  {position.label}
                </button>
              ))}
            </div>
          </div>

          <div className="controlGroup">
            <span>Preview Target</span>
            <div>
              {PREVIEW_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className={previewTarget === target.id ? "selected" : ""}
                  onClick={() => setPreviewTarget(target.id)}
                >
                  {target.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="modeHint" aria-live="polite">
          <b>{VIEW_MODES.find((mode) => mode.id === viewMode)?.label}</b>
          <span>{activeViewHelper}</span>
        </section>

        <section className="workArea" aria-label="Active Builder work area">
          {viewMode === "stack" ? (
            <div className="stackScroller">
              {orderedStackWorkspaces.map((workspace) => (
                <WorkstationFrame
                  key={workspace.id}
                  workspace={workspace}
                  active={workspace.id === activeWorkspace.id}
                  bridgeResult={bridgeResult}
                />
              ))}
            </div>
          ) : (
            <div className="activeFrameSlot">
              <WorkstationFrame workspace={activeWorkspace} active bridgeResult={bridgeResult} />
            </div>
          )}

          <section className="chatSlot" aria-label="Center Streams chat">
            <BuilderCenterChat context={context} onResult={setBridgeResult} />
          </section>
        </section>

        {panelPosition === "bottom-drawer" ? (
          <MonitorPanel
            context={context}
            bridgeResult={bridgeResult}
            panelPosition={panelPosition}
            statusPanelOpen={statusPanelOpen}
            setStatusPanelOpen={setStatusPanelOpen}
          />
        ) : null}
      </section>

      {panelPosition === "right-tab" ? (
        <MonitorPanel
          context={context}
          bridgeResult={bridgeResult}
          panelPosition={panelPosition}
          statusPanelOpen={statusPanelOpen}
          setStatusPanelOpen={setStatusPanelOpen}
        />
      ) : null}

      <style jsx global>{`
        html,
        body {
          width: 100vw;
          min-width: 0;
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
        }
      `}</style>

      <style jsx>{`
        .streamsBuilderShell {
          width: 100vw;
          max-width: 100vw;
          height: 100dvh;
          min-height: 0;
          display: grid;
          grid-template-columns: 64px minmax(0, 1fr) 0;
          gap: 8px;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.16), transparent 34%),
            radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.11), transparent 30%),
            #020617;
          color: #f8fafc;
          padding: 8px;
          box-sizing: border-box;
        }

        .streamsBuilderShell.sidebarOpen {
          grid-template-columns: 218px minmax(0, 1fr) 0;
        }

        .streamsBuilderShell.panel-right-tab.monitorOpen {
          grid-template-columns: 64px minmax(0, 1fr) minmax(292px, 340px);
        }

        .streamsBuilderShell.sidebarOpen.panel-right-tab.monitorOpen {
          grid-template-columns: 218px minmax(0, 1fr) minmax(292px, 340px);
        }

        .leftRail,
        .workspaceMain,
        .monitorPanel.rightTab {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.78);
          box-shadow: 0 22px 80px rgba(0, 0, 0, 0.28);
          overflow: hidden;
        }

        .leftRail {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 10px;
          padding: 8px;
        }

        .railToggle,
        .controlGroup button,
        .monitorHandle,
        .frameHeader a {
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.92);
          color: #e2e8f0;
          cursor: pointer;
          font-weight: 900;
        }

        .railToggle {
          width: 100%;
          min-height: 38px;
          background: linear-gradient(135deg, #7c3aed, #4c1d95);
          color: #fff;
          font-size: 11px;
        }

        nav {
          display: grid;
          align-content: start;
          gap: 8px;
          overflow: auto;
          min-height: 0;
          padding-right: 1px;
        }

        nav button {
          min-width: 0;
          min-height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.72);
          color: #fff;
          cursor: pointer;
          padding: 7px;
        }

        nav button.active {
          border-color: rgba(167, 139, 250, 0.62);
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.98), rgba(49, 46, 129, 0.92));
          box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.18), 0 12px 30px rgba(76, 29, 149, 0.28);
        }

        nav span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.1);
          font-size: 13px;
          font-weight: 1000;
        }

        nav b {
          flex: 1;
          min-width: 0;
          text-align: left;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .workspaceMain {
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr) auto;
          gap: 8px;
          padding: 8px;
        }

        .topStrip {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, 310px);
          gap: 8px;
        }

        .repoSlot,
        .activeContextCard,
        .modeHint,
        .controlBar {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.46);
        }

        .activeContextCard {
          padding: 10px 12px;
        }

        .activeContextCard span,
        .modeHint span,
        .controlGroup span,
        .frameTitleGroup small,
        .internalSurface dt {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .activeContextCard b,
        .modeHint b,
        .frameTitleGroup b,
        .internalSurface b {
          display: block;
          margin-top: 3px;
          color: #f8fafc;
          font-size: 14px;
          font-weight: 1000;
        }

        .activeContextCard small {
          display: block;
          margin-top: 3px;
          color: #cbd5e1;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .controlBar {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(190px, 0.65fr) minmax(210px, 0.7fr);
          gap: 8px;
          padding: 8px;
        }

        .controlGroup {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .controlGroup > div {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          min-width: 0;
        }

        .controlGroup button {
          min-height: 34px;
          padding: 7px 10px;
          font-size: 11px;
        }

        .controlGroup button.selected {
          border-color: rgba(167, 139, 250, 0.65);
          background: linear-gradient(135deg, #7c3aed, #5b21b6);
          color: #fff;
        }

        .modeHint {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
        }

        .modeHint span {
          flex: 1;
          text-align: right;
          letter-spacing: 0;
          text-transform: none;
          color: #cbd5e1;
        }

        .workArea {
          min-width: 0;
          min-height: 0;
          display: grid;
          gap: 8px;
          overflow: hidden;
        }

        .mode-multi .workArea {
          grid-template-columns: minmax(0, 1fr) minmax(390px, 430px);
        }

        .mode-single .workArea,
        .mode-focus .workArea {
          grid-template-columns: minmax(0, 1fr) minmax(380px, 430px);
        }

        .mode-stack .workArea {
          grid-template-columns: minmax(0, 1fr) minmax(370px, 430px);
        }

        .activeFrameSlot,
        .stackScroller,
        .chatSlot {
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        .stackScroller {
          display: grid;
          gap: 10px;
          overflow: auto;
          padding-right: 2px;
        }

        .mode-stack .workstationFrame {
          min-height: 500px;
        }

        .chatSlot {
          overflow: auto;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.32);
          padding: 8px;
        }

        .workstationFrame {
          min-width: 0;
          min-height: 0;
          height: 100%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.5);
          overflow: hidden;
        }

        .workstationFrame.active {
          border-color: rgba(34, 197, 94, 0.36);
          box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.08);
        }

        .frameHeader {
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(15, 23, 42, 0.72);
        }

        .frameTitleGroup {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .frameNumber {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 12px;
          background: rgba(124, 58, 237, 0.26);
          color: #ddd6fe;
          font-weight: 1000;
        }

        .frameTitleGroup div {
          min-width: 0;
        }

        .frameTitleGroup b,
        .frameTitleGroup small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .frameHeader a {
          flex: 0 0 auto;
          padding: 8px 10px;
          color: #e2e8f0;
          font-size: 11px;
          text-decoration: none;
        }

        .frameBody {
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          background: #020617;
        }

        .frameBody iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          background: #020617;
        }

        .internalSurface {
          height: 100%;
          min-height: 0;
          overflow: auto;
          padding: 16px;
          background:
            linear-gradient(135deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.96)),
            #020617;
        }

        .internalSurface p {
          max-width: 760px;
          margin: 8px 0 16px;
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.5;
        }

        .internalSurface dl {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 0;
        }

        .internalSurface div {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.62);
          padding: 10px;
        }

        .internalSurface dd {
          margin: 5px 0 0;
          color: #e2e8f0;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .monitorPanel {
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        .monitorPanel.rightTab {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          padding: 8px;
        }

        .monitorPanel.rightTab.closed {
          width: 0;
          padding: 0;
          border: 0;
        }

        .monitorPanel.bottomDrawer {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          max-height: 34dvh;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.88);
        }

        .monitorPanel.bottomDrawer.closed {
          max-height: 48px;
        }

        .monitorHandle {
          width: 100%;
          min-height: 38px;
          padding: 8px 10px;
          background: rgba(6, 78, 59, 0.28);
          color: #bbf7d0;
          font-size: 11px;
        }

        .monitorContent {
          min-height: 0;
          overflow: auto;
          padding: 0 2px 2px;
        }

        .monitorPanel.bottomDrawer .monitorContent {
          padding: 0 8px 8px;
        }

        .monitorPanel.closed .monitorContent {
          display: none;
        }

        @media (max-width: 1280px) {
          .streamsBuilderShell,
          .streamsBuilderShell.sidebarOpen,
          .streamsBuilderShell.panel-right-tab.monitorOpen,
          .streamsBuilderShell.sidebarOpen.panel-right-tab.monitorOpen {
            grid-template-columns: 64px minmax(0, 1fr);
          }

          .monitorPanel.rightTab {
            display: none;
          }

          .mode-multi .workArea,
          .mode-single .workArea,
          .mode-focus .workArea,
          .mode-stack .workArea {
            grid-template-columns: minmax(0, 1fr);
            overflow: auto;
          }

          .chatSlot {
            min-height: 600px;
          }
        }

        @media (max-width: 980px) {
          .streamsBuilderShell,
          .streamsBuilderShell.sidebarOpen,
          .streamsBuilderShell.panel-right-tab.monitorOpen,
          .streamsBuilderShell.sidebarOpen.panel-right-tab.monitorOpen {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto minmax(0, 1fr);
          }

          .leftRail {
            grid-row: 1;
            max-height: 176px;
          }

          nav {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          nav button {
            min-height: 40px;
          }

          nav b {
            display: none;
          }

          .workspaceMain {
            grid-row: 2;
          }

          .topStrip,
          .controlBar {
            grid-template-columns: minmax(0, 1fr);
          }

          .modeHint {
            display: grid;
          }

          .modeHint span {
            text-align: left;
          }

          .internalSurface dl {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </main>
  );
}
'@

Write-RepoFile -Path "src/components/streams-builder/WorkspaceGrid.tsx" -Content $workspaceGrid

Write-Host "Running production build..."
pnpm build

Write-Host "Workstation view/control upgrade completed. Review git diff, then deploy when ready."
