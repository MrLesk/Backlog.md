# Backlog.md status-change dispatcher (PowerShell)
#
# Set in backlog.config.yml:
#   shell: "powershell"
#   onStatusChange: '& "$PWD\backlog\prompts\dispatch.ps1"'
#
# Env vars injected by Backlog.md: TASK_ID, OLD_STATUS, NEW_STATUS, TASK_TITLE.
# This script picks the prompt file matching $NEW_STATUS, prepends task context,
# and launches `claude -p` in the background so the hook returns immediately.

$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$promptsDir = $scriptDir

# Set BACKLOG_DISPATCH_MODE=test in the env of the process that launches the
# Backlog.md server to pick the smoke-test prompts (no-op agents that just wait
# and transition to the next status). Anything else uses the real prompts.
$promptStem = @{ 'In Progress' = 'code'; 'In Review' = 'review'; 'Human Review' = 'ready' }[$env:NEW_STATUS]
if (-not $promptStem) { exit 0 }  # Status change we don't dispatch on
$suffix = if ($env:BACKLOG_DISPATCH_MODE -eq 'test') { '.test.md' } else { '.md' }
$promptFile = Join-Path $promptsDir "$promptStem$suffix"

if (-not (Test-Path $promptFile)) {
    Write-Warning "dispatch.ps1: prompt file not found: $promptFile"
    exit 0
}

$promptBody = Get-Content -Path $promptFile -Raw
$fullPrompt = @"
$promptBody

---
Task: $env:TASK_ID — $env:TASK_TITLE
Status: $env:OLD_STATUS → $env:NEW_STATUS
"@

# Per-invocation log file so concurrent hooks don't clobber each other.
# Millisecond timestamp + PID make collisions effectively impossible even when
# the same task transitions twice in the same second. All dynamic segments are
# stripped of characters Windows refuses in filenames (`<>:"/\|?*` plus
# whitespace) so custom status names don't break the dispatcher.
$logDir = Join-Path $promptsDir 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$safeTaskId = ($env:TASK_ID -replace '[<>:"/\\|?*\s]+', '_')
if (-not $safeTaskId) { $safeTaskId = 'unknown' }
$safeStatus = ($env:NEW_STATUS -replace '[<>:"/\\|?*\s]+', '_')
if (-not $safeStatus) { $safeStatus = 'unknown' }
$logFile = Join-Path $logDir "$timestamp-$PID-$safeTaskId-$safeStatus.log"

# Write the prompt sidecar first, before resolving the agent binary, so the
# artifact is available for inspection even when claude isn't on PATH (or when
# this run is a dry-run smoke test). Pass the prompt via stdin instead of as a
# positional arg: Start-Process on Windows PowerShell 5.1 mangles multi-line
# arguments (the child process only sees the first word). UTF-8 without BOM
# so claude doesn't see a leading BOM glyph.
$promptPath = "$logFile.prompt"
[System.IO.File]::WriteAllText($promptPath, $fullPrompt, (New-Object System.Text.UTF8Encoding $false))

# Dry-run mode: do everything except spawn claude. Used by the dispatcher
# regression tests; harmless in production.
if ($env:BACKLOG_DISPATCH_DRY_RUN -eq '1') { exit 0 }

# Resolve the real executable. npm on Windows installs both `claude.cmd` (the
# batch wrapper Start-Process can launch) and a bare `claude` bash shim that
# cannot be launched as a Win32 process. Try the .cmd / .exe variants first.
# `Select-Object -First 1` defends against PATH containing more than one match
# (e.g. user-local npm bin shadowing a system install) — without it, .Source
# returns an array and Start-Process refuses with "cannot convert Object[] to
# String".
$claudeExec = $null
foreach ($candidate in @('claude.cmd', 'claude.exe', 'claude')) {
    $resolved = Get-Command $candidate -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($resolved) { $claudeExec = $resolved.Source; break }
}
if (-not $claudeExec) {
    Write-Warning "dispatch.ps1: 'claude' CLI not found on PATH"
    exit 1
}

# `claude` in headless mode needs --dangerously-skip-permissions to act
# without prompting. Adjust if your trust model differs.
Start-Process `
    -FilePath $claudeExec `
    -ArgumentList @('-p', '--dangerously-skip-permissions') `
    -RedirectStandardInput $promptPath `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError "$logFile.err" `
    -WindowStyle Hidden `
    -WorkingDirectory (Resolve-Path "$scriptDir/../..").Path | Out-Null
