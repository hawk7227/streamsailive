#!/usr/bin/env pwsh
# install-hooks.ps1
# Run once from repo root: .\scripts\install-hooks.ps1
# Installs a git pre-commit hook that runs audit.py before every commit.
# If audit finds ANY violation, the commit is blocked.

$RepoRoot = git rev-parse --show-toplevel
$HooksDir = Join-Path $RepoRoot ".git\hooks"
$HookFile = Join-Path $HooksDir "pre-commit"

# Ensure hooks directory exists
if (-not (Test-Path $HooksDir)) {
    New-Item -ItemType Directory -Path $HooksDir | Out-Null
}

# Write the pre-commit hook
$HookContent = @'
#!/bin/sh
echo ""
echo "================================================="
echo " Streams Pre-commit Audit"
echo "================================================="
python3 scripts/audit.py
if [ $? -ne 0 ]; then
  echo ""
  echo "================================================="
  echo " COMMIT BLOCKED — fix all violations above."
  echo " Re-run: python3 scripts/audit.py"
  echo "================================================="
  echo ""
  exit 1
fi
echo " Audit passed — committing."
'@

Set-Content -Path $HookFile -Value $HookContent -Encoding UTF8 -NoNewline

# Git requires the hook to be executable (applies in WSL/Git Bash context)
# On Windows with Git for Windows this is handled automatically
git config core.hooksPath .git/hooks

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host " Pre-commit hook installed." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Every 'git commit' will now run audit.py first."
Write-Host " Commits with violations will be blocked."
Write-Host ""
Write-Host " To verify the hook is active:"
Write-Host "   cat .git\hooks\pre-commit"
Write-Host ""
Write-Host " To test the audit manually:"
Write-Host "   python3 scripts/audit.py"
Write-Host ""
