# Backlog.md status-change dispatcher (PowerShell)
#
# Set in backlog.config.yml:
#   shell: "powershell"
#   onStatusChange: 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PWD\backlog\prompts\dispatch.ps1"'
#
# Env vars injected by Backlog.md: TASK_ID, OLD_STATUS, NEW_STATUS, TASK_TITLE.
# This script picks the prompt file matching $NEW_STATUS, reads the per-task
# agent/reviewAgent field from the task frontmatter, and launches the right
# CLI binary in the background so the hook returns immediately.

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
# artifact is available for inspection even when the agent CLI isn't on PATH
# (or when this run is a dry-run smoke test).
$promptPath = "$logFile.prompt"
[System.IO.File]::WriteAllText($promptPath, $fullPrompt, (New-Object System.Text.UTF8Encoding $false))

# Dry-run mode: do everything except spawn the agent. Used by the dispatcher
# regression tests; harmless in production.
if ($env:BACKLOG_DISPATCH_DRY_RUN -eq '1') { exit 0 }

# ── Agent resolution ────────────────────────────────────────────────────────
#
# Priority order:
#   1. Per-task frontmatter field: `agent:` (for coder) or `reviewAgent:` (for reviewer)
#   2. BACKLOG_DEFAULT_AGENT env var (set in the shell that runs the server)
#   3. Hard-coded fallback: "claude"
#
# The "In Review" transition uses `reviewAgent:` from the task; if absent it
# falls back to `agent:`, then to the default. This lets you set a different
# model for review than for implementation on a per-task basis without touching
# dispatcher code.
#
# Supported agent names: claude | codex | opencode
# You can also set an absolute path to any binary that accepts:
#   <binary> -p <prompt>  --<permission-flag>   (via stdin)
#
$projectRoot = (Resolve-Path "$scriptDir/../..").Path
$tasksDir = Join-Path $projectRoot 'backlog\tasks'
$taskFile = Get-ChildItem $tasksDir -Filter "*$env:TASK_ID*" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1

$taskAgentName = ''
$taskReviewAgentName = ''
if ($taskFile) {
    $taskContent = Get-Content $taskFile.FullName -Raw
    if ($taskContent -match '(?m)^agent:\s*[''"]?([^\s''"]+)[''"]?') {
        $taskAgentName = $matches[1].Trim()
    }
    if ($taskContent -match '(?m)^reviewAgent:\s*[''"]?([^\s''"]+)[''"]?') {
        $taskReviewAgentName = $matches[1].Trim()
    }
}

# If no per-task `agent:` field is set AND BACKLOG_DEFAULT_AGENT is not
# configured, the task is assumed to be assigned to a human. In that case:
#   - "In Progress" / "In Review" → do not dispatch (exit silently so the
#     human does their work without an agent firing in the background).
#   - "Human Review" → the ready.md notifier is still useful (someone needs
#     to look at it), so we continue regardless.
$hasExplicitAgent = [bool]$taskAgentName
$hasDefaultAgent  = [bool]$env:BACKLOG_DEFAULT_AGENT

if (-not $hasExplicitAgent -and -not $hasDefaultAgent -and $env:NEW_STATUS -ne 'Human Review') {
    # No agent configured — human task. Skip dispatch.
    exit 0
}

$defaultAgent = if ($env:BACKLOG_DEFAULT_AGENT) { $env:BACKLOG_DEFAULT_AGENT } else { '' }

$agentName = switch ($env:NEW_STATUS) {
    'In Review' {
        if ($taskReviewAgentName) { $taskReviewAgentName }
        elseif ($taskAgentName) { $taskAgentName }
        else { $defaultAgent }
    }
    'Human Review' {
        # Notifier prompt — agent field doesn't matter; use claude as the
        # runner since it's the lightest invocation (just logs a summary).
        if ($taskAgentName) { $taskAgentName }
        elseif ($defaultAgent) { $defaultAgent }
        else { 'claude' }
    }
    default {
        if ($taskAgentName) { $taskAgentName } else { $defaultAgent }
    }
}

Write-Host "dispatch.ps1: task=$env:TASK_ID status=$env:NEW_STATUS agent=$agentName"

# ── Binary lookup ────────────────────────────────────────────────────────────
#
# Each agent entry lists the preferred candidate names in order. On Windows,
# npm installs a bare shim (no extension) alongside a .cmd wrapper; Start-Process
# only works with the .cmd or .exe form, so we probe those first.
# Select-Object -First 1 guards against PATH returning an array when multiple
# installs exist (which crashes Start-Process with "cannot convert Object[]").
#
$agentCandidates = switch ($agentName.ToLower()) {
    'claude'    { @('claude.cmd',    'claude.exe',    'claude')    }
    'codex'     { @('codex.cmd',     'codex.exe',     'codex')     }
    'opencode'  { @('opencode.cmd',  'opencode.exe',  'opencode')  }
    default {
        # Treat as an absolute or relative path to the binary directly.
        @($agentName)
    }
}

$agentExec = $null
foreach ($candidate in $agentCandidates) {
    $resolved = Get-Command $candidate -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($resolved) { $agentExec = $resolved.Source; break }
}

if (-not $agentExec) {
    Write-Warning "dispatch.ps1: agent '$agentName' not found on PATH — falling back to claude"
    $agentExec = (Get-Command 'claude.cmd' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1)?.Source
}
if (-not $agentExec) {
    Write-Warning "dispatch.ps1: 'claude' fallback also not found. Cannot dispatch."
    exit 1
}

# ── Per-agent launch arguments ───────────────────────────────────────────────
#
# All three supported agents accept: <binary> -p <prompt> <permission-flag>
# The prompt is passed via stdin (-RedirectStandardInput) to avoid PowerShell
# 5.1 mangling multi-line strings in ArgumentList.
#
$agentArgs = switch ($agentName.ToLower()) {
    'codex'    { @('--full-auto') }                            # codex: full-auto mode
    'opencode' { @('-p', '--yes') }                            # opencode: -p + skip confirms
    default    { @('-p', '--dangerously-skip-permissions') }   # claude default
}

Start-Process `
    -FilePath $agentExec `
    -ArgumentList $agentArgs `
    -RedirectStandardInput $promptPath `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError "$logFile.err" `
    -WindowStyle Hidden `
    -WorkingDirectory $projectRoot | Out-Null
