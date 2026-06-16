# Centers the existing Streams AI chat/iPhone between the restored workstation panels.
# This only changes the workstation grid layout in GitHubRepositoryPicker.tsx.
# It does not touch dropdown data, pull/push, repo/folder/file controls, monitor, proof drawer, or workstation internals.
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File scripts/center-chat-between-workstations.ps1

$ErrorActionPreference = "Stop"

$path = "src/components/streams-builder/GitHubRepositoryPicker.tsx"
if (-not (Test-Path $path)) {
  throw "Missing $path"
}

$content = Get-Content $path -Raw

if ($content -match "chatPhoneCenter") {
  Write-Host "Chat iPhone is already centered in the workstation grid. No changes made."
  exit 0
}

$oldBlock = @'
      <div className="stationGrid">
        {STATIONS.map((label, index) => (
          <Workstation key={label} label={label} index={index} repos={repos} />
        ))}
      </div>
'@

$newBlock = @'
      <div className="stationGrid">
        <Workstation label={STATIONS[0]} index={0} repos={repos} />

        <section className="chatPhoneCenter" aria-label="Streams AI centered chat">
          <iframe title="Streams AI centered chat" src="/streams-ai?builderMode=1" />
        </section>

        <Workstation label={STATIONS[1]} index={1} repos={repos} />
        <Workstation label={STATIONS[2]} index={2} repos={repos} />
        <div className="chatPhoneSpacer" aria-hidden="true" />
        <Workstation label={STATIONS[3]} index={3} repos={repos} />
      </div>
'@

if (-not $content.Contains($oldBlock)) {
  throw "Could not find the restored workstation grid block. Run the restore script first, then rerun this script."
}

$content = $content.Replace($oldBlock, $newBlock)

$content = $content.Replace(
'          grid-template-columns: repeat(2, minmax(0, 1fr));',
'          grid-template-columns: minmax(0, 1fr) minmax(320px, 430px) minmax(0, 1fr);'
)

$content = $content.Replace(
'          grid-auto-rows: minmax(610px, 78vh);',
'          grid-auto-rows: minmax(610px, 78vh);'
)

$cssAnchor = @'
        @media (max-width: 1200px) {
'@

$chatCss = @'
        .chatPhoneCenter,
        .chatPhoneSpacer {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          overflow: hidden;
          box-sizing: border-box;
        }

        .chatPhoneCenter {
          width: min(100%, 430px);
          max-width: 430px;
          justify-self: center;
        }

        .chatPhoneCenter iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          background: #020713;
        }

        .chatPhoneSpacer {
          width: min(100%, 430px);
          max-width: 430px;
          justify-self: center;
          opacity: 0;
          pointer-events: none;
        }

'@

if (-not $content.Contains($cssAnchor)) {
  throw "Could not find CSS insertion point."
}

$content = $content.Replace($cssAnchor, $chatCss + $cssAnchor)

Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline

Write-Host "Centered Streams AI chat/iPhone between restored workstation panels."
Write-Host "Running production build..."
pnpm build
