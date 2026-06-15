# Restore the correct Streams Builder layout:
# - Streams AI chat on the left
# - ONE restored workstation on the right
# - Full workspace dropdown list inside that one workstation
# - Repo / branch / folder / file / Pull / Push controls preserved
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File scripts/restore-builder-dropdowns-only.ps1

$ErrorActionPreference = "Stop"

$restoreCommit = "2c2baf854b930c9631326460676d954a0ad8e985"

if (-not (Test-Path "package.json")) {
  throw "Run this from the streamsailive repo root."
}

Write-Host "Restoring working workstation dropdown file..."
git checkout $restoreCommit -- src/components/streams-builder/GitHubRepositoryPicker.tsx

$pickerPath = "src/components/streams-builder/GitHubRepositoryPicker.tsx"
$picker = Get-Content $pickerPath -Raw

# Keep the complete built workstation component, but limit the layout to one workstation.
$picker = $picker.Replace('const STATIONS = ["Agent 1", "Agent 2", "Agent 3", "Agent 4"];', 'const STATIONS = ["Agent 1"];')
$picker = $picker.Replace('4 Equal Workstations · Editor · Browser · Mobile · Advanced · Proof', 'Single Workstation · Editor · Browser · Mobile · Advanced · Proof')
$picker = $picker.Replace('grid-template-columns: repeat(2, minmax(0, 1fr));', 'grid-template-columns: minmax(0, 1fr);')
$picker = $picker.Replace('grid-auto-rows: minmax(610px, 78vh);', 'grid-auto-rows: minmax(720px, calc(100dvh - 28px));')
Set-Content -Path $pickerPath -Value $picker -Encoding UTF8 -NoNewline

$workspaceGridPath = "src/components/streams-builder/WorkspaceGrid.tsx"
$workspaceGrid = @'
"use client";

import GitHubRepositoryPicker from "./GitHubRepositoryPicker";

export default function WorkspaceGrid() {
  return (
    <main className="streamsBuilderShell">
      <section className="chatFrame" aria-label="Streams AI chat">
        <iframe title="Streams AI" src="/streams-ai?builderMode=1" />
      </section>

      <section className="centerWorkspace" aria-label="Single restored workstation">
        <GitHubRepositoryPicker />
      </section>

      <style jsx>{`
        .streamsBuilderShell {
          width: 100vw;
          height: 100dvh;
          max-width: 100vw;
          max-height: 100dvh;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(320px, 430px) minmax(0, 1fr);
          gap: 6px;
          overflow: hidden;
          background: #020713;
          color: #fff;
          padding: 6px;
          box-sizing: border-box;
        }

        .chatFrame,
        .centerWorkspace {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          box-sizing: border-box;
          overflow: hidden;
        }

        .chatFrame iframe {
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
          background: #020713;
        }

        .centerWorkspace {
          padding: 6px;
          overflow: auto;
        }

        @media (max-width: 1180px) {
          .streamsBuilderShell {
            grid-template-columns: minmax(0, 1fr);
            overflow: auto;
          }

          .chatFrame {
            min-height: 760px;
          }

          .centerWorkspace {
            min-height: 760px;
          }
        }
      `}</style>
    </main>
  );
}
'@

Set-Content -Path $workspaceGridPath -Value $workspaceGrid -Encoding UTF8 -NoNewline

$picker = Get-Content $pickerPath -Raw
if ($picker -notmatch "WORKSPACE_MODES.map") { throw "Workspace dropdown list was not restored." }
if ($picker -notmatch "Primary Builder" -or $picker -notmatch "Truth Panel") { throw "Full workspace dropdown list was not restored." }
if ($picker -notmatch "Pull" -or $picker -notmatch "Push") { throw "Pull/Push controls were not restored." }
if ($picker -match 'const STATIONS = \["Agent 1", "Agent 2", "Agent 3", "Agent 4"\];') { throw "Still rendering four workstations. Restore failed." }

Write-Host "Running production build..."
pnpm build

Write-Host "Restore complete: chat + one workstation + full dropdown list."
