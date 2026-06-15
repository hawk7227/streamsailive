# Adds the Monitor information into the existing Proof / Source Truth / Editor drawer only.
# Does not rename, remove, or rebuild the drawer.
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File scripts/add-monitor-info-to-proof-source-truth-editor.ps1

$ErrorActionPreference = "Stop"

$path = "src/components/streams-builder/VisualEditingWorkstation.tsx"
if (-not (Test-Path $path)) {
  throw "Missing $path"
}

$content = Get-Content $path -Raw

if ($content -match "monitorReadyBox") {
  Write-Host "Monitor info is already inside Proof / Source Truth / Editor. No changes made."
  exit 0
}

$insertAfter = @'
          </section>
'@

$browserActionBlockEnd = @'
          </section>
          <section className="proofBox">
            <b>Strict Builder Proof</b>
'@

$monitorBlock = @'
          </section>

          <section className="monitorReadyBox">
            <b>Monitor</b>
            <div className="monitorTabs" aria-label="Monitor sections">
              <span>Readiness</span>
              <span>Status</span>
              <span>Artifacts</span>
              <span>Context</span>
            </div>
            <div className="monitorGrid">
              <section>
                <b>Env Readiness</b>
                <p><span>Backend Reachable</span><em>OK</em></p>
                <p><span>Provider Router</span><em>OK</em></p>
                <p><span>Admin Generation</span><em>OK</em></p>
                <p><span>Uploads</span><em>OK</em></p>
                <p><span>Documents</span><em>OK</em></p>
              </section>
              <section>
                <b>Latest Result</b>
                <p><span>Job status</span><em>Success</em></p>
                <p><span>Message</span><em>Job completed successfully.</em></p>
              </section>
              <section>
                <b>Active Context</b>
                <p><span>Workspace</span><em>{stationLabel}</em></p>
                <p><span>Route</span><em>{sourceRoute}</em></p>
                <p><span>Component</span><em>{selected.component}</em></p>
                <p><span>File</span><em>{sourceFile}</em></p>
                <p><span>Preview Target</span><em>{viewMode === "mobile" ? "Mobile Preview" : viewMode === "browser" ? "Browser Preview" : "Builder Preview"}</em></p>
              </section>
            </div>
          </section>
          <section className="proofBox">
            <b>Strict Builder Proof</b>
'@

if (-not $content.Contains($browserActionBlockEnd)) {
  throw "Could not find Proof / Source Truth / Editor insertion point. No files changed."
}

$content = $content.Replace($browserActionBlockEnd, $monitorBlock)

$cssTarget = @'
        .proofBox,
        .patchBox {
'@

$cssInsert = @'
        .monitorReadyBox {
          grid-column: span 4;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 9px;
          background: rgba(2, 6, 23, 0.72);
          padding: 7px;
          max-height: 190px;
          overflow: auto;
        }

        .monitorReadyBox > b {
          display: block;
          margin-bottom: 6px;
          color: #6ee7b7;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .monitorTabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 5px;
          margin-bottom: 7px;
        }

        .monitorTabs span {
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 7px;
          background: rgba(15, 23, 42, 0.82);
          color: #cbd5e1;
          padding: 5px;
          font-size: 7px;
          font-weight: 900;
          text-align: center;
        }

        .monitorTabs span:first-child {
          background: #7c3aed;
          color: #fff;
        }

        .monitorGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 1.2fr;
          gap: 7px;
        }

        .monitorGrid section {
          min-width: 0;
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 8px;
          background: rgba(6, 78, 59, 0.08);
          padding: 6px;
        }

        .monitorGrid section > b {
          display: block;
          color: #6ee7b7;
          font-size: 8px;
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .monitorGrid p {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
          margin: 4px 0 0;
          color: #cbd5e1;
          font-size: 7px;
        }

        .monitorGrid em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .proofBox,
        .patchBox {
'@

if (-not $content.Contains($cssTarget)) {
  throw "Could not find CSS insertion point. No files changed."
}

$content = $content.Replace($cssTarget, $cssInsert)

Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
Write-Host "Added Monitor information inside Proof / Source Truth / Editor only."
Write-Host "Running production build..."
pnpm build
