# Restore the working Streams Builder dropdowns into the workstation controls.
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File scripts/restore-builder-dropdowns-only.ps1

$ErrorActionPreference = "Stop"

$restoreCommit = "2c2baf854b930c9631326460676d954a0ad8e985"

if (-not (Test-Path "package.json")) {
  throw "Run this from the streamsailive repo root."
}

Write-Host "Restoring working workstation dropdown file..."
git checkout $restoreCommit -- src/components/streams-builder/GitHubRepositoryPicker.tsx

$workspaceGridPath = "src/components/streams-builder/WorkspaceGrid.tsx"
$workspaceGrid = @'
"use client";

import GitHubRepositoryPicker from "./GitHubRepositoryPicker";

export default function WorkspaceGrid() {
  return (
    <main className="streamsBuilderShell">
      <section className="centerWorkspace">
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
          grid-template-columns: minmax(0, 1fr);
          gap: 6px;
          overflow: hidden;
          background: #020713;
          color: #fff;
          padding: 6px;
          box-sizing: border-box;
        }

        .centerWorkspace {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          overflow: auto;
          box-sizing: border-box;
          padding: 6px;
        }
      `}</style>
    </main>
  );
}
'@

Set-Content -Path $workspaceGridPath -Value $workspaceGrid -Encoding UTF8 -NoNewline

$picker = Get-Content "src/components/streams-builder/GitHubRepositoryPicker.tsx" -Raw
if ($picker -notmatch "WORKSPACE_MODES.map") { throw "Workspace dropdown list was not restored." }
if ($picker -notmatch "Pull" -or $picker -notmatch "Push") { throw "Pull/Push controls were not restored." }

Write-Host "Running production build..."
pnpm build

Write-Host "Restore complete."
