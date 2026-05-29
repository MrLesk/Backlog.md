# Backlog.md status-change dispatcher (PowerShell 5.1 compatible)
#
# Set in backlog.config.yml:
#   shell: "powershell"
#   onStatusChange: 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PWD\backlog\prompts\dispatch.ps1"'
#
# Env vars injected by Backlog.md: TASK_ID, OLD_STATUS, NEW_STATUS, TASK_TITLE.

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot
$promptsDir = $scriptDir

# ── Prompt file selection ────────────────────────────────────────────────────
if ($env:NEW_STATUS -eq 'In Progress') {
    $promptStem = 'code'
} elseif ($env:NEW_STATUS -eq 'In Review') {
    $promptStem = 'review'
} elseif ($env:NEW_STATUS -eq 'Human Review') {
    $promptStem = 'ready'
} else {
    exit 0
}

if ($env:BACKLOG_DISPATCH_MODE -eq 'test') {
    $suffix = '.test.md'
} else {
    $suffix = '.md'
}

$promptFile = Join-Path $promptsDir "$promptStem$suffix"
if (-not (Test-Path $promptFile)) {
    Write-Warning "dispatch.ps1: prompt file not found: $promptFile"
    exit 0
}

$promptBody = Get-Content -Path $promptFile -Raw
$fullPrompt = @"
$promptBody

---
Task: $env:TASK_ID -- $env:TASK_TITLE
Status: $env:OLD_STATUS -> $env:NEW_STATUS
"@

# ── Log file ─────────────────────────────────────────────────────────────────
$logDir = Join-Path $promptsDir 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$safeTaskId = ($env:TASK_ID -replace '[<>:"/\\|?*\s]+', '_')
if (-not $safeTaskId) { $safeTaskId = 'unknown' }
$safeStatus = ($env:NEW_STATUS -replace '[<>:"/\\|?*\s]+', '_')
if (-not $safeStatus) { $safeStatus = 'unknown' }
$logFile = Join-Path $logDir "$timestamp-$PID-$safeTaskId-$safeStatus.log"

$promptPath = "$logFile.prompt"
[System.IO.File]::WriteAllText($promptPath, $fullPrompt, (New-Object System.Text.UTF8Encoding $false))

if ($env:BACKLOG_DISPATCH_DRY_RUN -eq '1') { exit 0 }

# ── Agent resolution ─────────────────────────────────────────────────────────
# Tasks without `agent:` in frontmatter are human tasks -- skip dispatch.
# Exception: Human Review always fires the notifier (ready.md).

$projectRoot = (Resolve-Path (Join-Path $scriptDir '..\..') ).Path
$tasksDir = Join-Path $projectRoot 'backlog\tasks'
$taskFile = Get-ChildItem $tasksDir -Filter "*$env:TASK_ID*" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1

$taskAgentName = ''
$taskReviewAgentName = ''
if ($taskFile) {
    $taskContent = Get-Content $taskFile.FullName -Raw
    if ($taskContent -match '(?m)^agent:\s*[''"]?([^\s''"\r\n]+)[''"]?') {
        $taskAgentName = $matches[1].Trim()
    }
    if ($taskContent -match '(?m)^reviewAgent:\s*[''"]?([^\s''"\r\n]+)[''"]?') {
        $taskReviewAgentName = $matches[1].Trim()
    }
}

if ((-not $taskAgentName) -and ($env:NEW_STATUS -ne 'Human Review')) {
    exit 0
}

if ($env:NEW_STATUS -eq 'In Review') {
    if ($taskReviewAgentName) { $agentName = $taskReviewAgentName } else { $agentName = $taskAgentName }
} elseif ($env:NEW_STATUS -eq 'Human Review') {
    if ($taskAgentName) { $agentName = $taskAgentName } else { $agentName = 'claude' }
} else {
    $agentName = $taskAgentName
}

Write-Host "dispatch.ps1: task=$env:TASK_ID status=$env:NEW_STATUS agent=$agentName"

# ── Binary lookup ─────────────────────────────────────────────────────────────
if ($agentName.ToLower() -eq 'claude') {
    $candidates = @('claude.cmd', 'claude.exe', 'claude')
} elseif ($agentName.ToLower() -eq 'codex') {
    $candidates = @('codex.cmd', 'codex.exe', 'codex')
} elseif ($agentName.ToLower() -eq 'opencode') {
    $candidates = @('opencode.cmd', 'opencode.exe', 'opencode')
} else {
    $candidates = @($agentName)
}

$agentExec = $null
foreach ($candidate in $candidates) {
    $found = Get-Command $candidate -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($found) {
        $agentExec = $found.Source
        break
    }
}

if (-not $agentExec) {
    Write-Warning "dispatch.ps1: '$agentName' not found -- falling back to claude.cmd"
    $found = Get-Command 'claude.cmd' -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($found) { $agentExec = $found.Source }
}

if (-not $agentExec) {
    Write-Warning "dispatch.ps1: no agent binary found. Cannot dispatch."
    exit 1
}

# ── Launch ────────────────────────────────────────────────────────────────────
# Claude reads the prompt from stdin (multi-line safe via -RedirectStandardInput).
# Codex and opencode require the prompt as a positional argument — they reject
# stdin redirection with "stdin is not a terminal".
if ($agentName.ToLower() -eq 'codex') {
    # Codex: prompt as positional arg, --yolo for unattended mode.
    $agentArgs = @('--yolo', $fullPrompt)
    Start-Process `
        -FilePath $agentExec `
        -ArgumentList $agentArgs `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -WindowStyle Hidden `
        -WorkingDirectory $projectRoot | Out-Null
} elseif ($agentName.ToLower() -eq 'opencode') {
    $agentArgs = @('-p', $fullPrompt, '--yes')
    Start-Process `
        -FilePath $agentExec `
        -ArgumentList $agentArgs `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -WindowStyle Hidden `
        -WorkingDirectory $projectRoot | Out-Null
} else {
    # Claude: prompt via stdin (PS5.1 mangles multi-line positional args).
    $agentArgs = @('-p', '--dangerously-skip-permissions')
    Start-Process `
        -FilePath $agentExec `
        -ArgumentList $agentArgs `
        -RedirectStandardInput $promptPath `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -WindowStyle Hidden `
        -WorkingDirectory $projectRoot | Out-Null
}
