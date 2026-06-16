# Adds only ONE dropdown list: the Workspace Mode dropdown options.
# Does not touch layout, chat, repo/folder/file, Pull/Push, monitor, proof drawer, or workstation internals.
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File scripts/add-one-workspace-mode-dropdown-list-only.ps1

$ErrorActionPreference = "Stop"

$path = "src/components/streams-builder/GitHubRepositoryPicker.tsx"
if (-not (Test-Path $path)) {
  throw "Missing $path"
}

$content = Get-Content $path -Raw

$fullOptions = @'
<option>Primary Builder</option>
<option>Visual Editing</option>
<option>Component Mapping</option>
<option>Approval Center</option>
<option>Browser Verification</option>
<option>Repository Truth</option>
<option>Projects Dashboard</option>
<option>Truth Panel</option>
'@

if ($content -match "<option>Primary Builder</option>" -and $content -match "<option>Truth Panel</option>") {
  Write-Host "Workspace Mode dropdown already has the full list. No changes made."
  exit 0
}

$singleOption = '<option>Visual Editing</option>'
if (-not $content.Contains($singleOption)) {
  throw "Could not find single Visual Editing option to expand. No files changed."
}

# Replace only the first single Visual Editing option. This is intentionally narrow.
$index = $content.IndexOf($singleOption)
$content = $content.Substring(0, $index) + $fullOptions + $content.Substring($index + $singleOption.Length)

Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline

Write-Host "Added only the Workspace Mode dropdown full list."
Write-Host "Running production build..."
pnpm build
