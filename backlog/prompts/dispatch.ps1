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

# ── Alias → binary resolution ─────────────────────────────────────────────────
# Read the agents: block from backlog/config.yml. If the task's agent value
# matches a configured alias, use the corresponding binary; otherwise treat
# the value as a raw binary name (back-compat with existing tasks).
$configFile = Join-Path $projectRoot 'backlog\config.yml'
$aliasMap = @{}
if (Test-Path $configFile) {
    $configContent = Get-Content $configFile -Raw
    # Extract the agents: block line by line — simple enough without gray-matter.
    $inAgents = $false
    $pendingAlias = ''
    foreach ($line in $configContent -split '\r?\n') {
        if ($line -match '^agents:') {
            $inAgents = $true
            continue
        }
        if ($inAgents) {
            # Stop at the next top-level key (not indented).
            if ($line -match '^[A-Za-z_]') { $inAgents = $false; continue }
            if ($line -match '^\s+-\s+alias:\s*[''"]?([^''"]+)[''"]?\s*$') {
                $pendingAlias = $matches[1].Trim()
            } elseif ($line -match '^\s+binary:\s*[''"]?([^''"]+)[''"]?\s*$') {
                if ($pendingAlias -ne '') {
                    $aliasMap[$pendingAlias] = $matches[1].Trim()
                    $pendingAlias = ''
                }
            }
        }
    }
}
$taskFile = Get-ChildItem $tasksDir -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ilike "*$env:TASK_ID*" } |
    Select-Object -First 1

$taskAgentName = ''
$taskReviewAgentName = ''
$coderSessionId = ''
$reviewerSessionId = ''
if ($taskFile) {
    $taskContent = Get-Content $taskFile.FullName -Raw
    if ($taskContent -match '(?m)^agent:\s*[''"]?([^''"\r\n]+?)[''"]?\s*$') {
        $taskAgentName = $matches[1].Trim()
    }
    if ($taskContent -match '(?m)^reviewAgent:\s*[''"]?([^''"\r\n]+?)[''"]?\s*$') {
        $taskReviewAgentName = $matches[1].Trim()
    }
    # Coder session ID — written by the coder in a "## Session" block.
    # Take the LAST match in case there were multiple rounds.
    # Coder session ID — matches both UUID (claude/codex) and ses_* (opencode).
    $coderMatches = [regex]::Matches($taskContent, '(?m)^Session ID:\s*([a-f0-9-]{36}|ses_[A-Za-z0-9]+)')
    if ($coderMatches.Count -gt 0) {
        $coderSessionId = $coderMatches[$coderMatches.Count - 1].Groups[1].Value.Trim()
    }
    # Reviewer session ID — matches both UUID and ses_* formats.
    $reviewerMatches = [regex]::Matches($taskContent, '(?m)^Reviewer Session ID:\s*([a-f0-9-]{36}|ses_[A-Za-z0-9]+)')
    if ($reviewerMatches.Count -gt 0) {
        $reviewerSessionId = $reviewerMatches[$reviewerMatches.Count - 1].Groups[1].Value.Trim()
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

# Resolve alias → binary if configured; otherwise use as-is.
$agentBinary = if ($aliasMap.ContainsKey($agentName)) { $aliasMap[$agentName] } else { $agentName }
Write-Host "dispatch.ps1: task=$env:TASK_ID status=$env:NEW_STATUS agent=$agentName binary=$agentBinary"

# ── Binary lookup ─────────────────────────────────────────────────────────────
if ($agentBinary.ToLower() -eq 'claude') {
    $candidates = @('claude.cmd', 'claude.exe', 'claude')
} elseif ($agentBinary.ToLower() -eq 'codex') {
    $candidates = @('codex.cmd', 'codex.exe', 'codex')
} elseif ($agentBinary.ToLower() -eq 'opencode') {
    $candidates = @('opencode.cmd', 'opencode.exe', 'opencode')
} else {
    $candidates = @($agentBinary)
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
# ── Rework detection (claude only) ───────────────────────────────────────────
# When a task returns to In Progress after a review, the coder should resume
# its previous session (retaining full implementation context) rather than
# starting from scratch. The rework message is minimal: just tell the agent
# to read the task and fix the reviewer's findings — everything else lives in
# the session history and in the task body via MCP.
#
# Conditions for --resume:
#   1. Agent is claude (Codex/opencode don't support --resume)
#   2. Status is "In Progress" (rework trigger)
#   3. A coder session ID exists in the task notes
#   4. The task body contains at least one "CHANGES REQUESTED" review block
#
$resumeCapableAgents = @('claude', 'codex', 'opencode')

$isCoderRework = $false
if ($resumeCapableAgents -contains $agentBinary.ToLower() -and
    $env:NEW_STATUS -eq 'In Progress' -and
    $coderSessionId -ne '' -and
    $taskContent -match 'CHANGES REQUESTED') {
    $isCoderRework = $true
}

$isReviewerResume = $false
if ($resumeCapableAgents -contains $agentBinary.ToLower() -and
    $env:NEW_STATUS -eq 'In Review' -and
    $reviewerSessionId -ne '') {
    $isReviewerResume = $true
}

if ($isCoderRework) {
    $reworkMessage = "The reviewer requested changes on task $env:TASK_ID. Read the task via the Backlog.md MCP (task_view), find the latest Review section with CHANGES REQUESTED, address every finding, run the tests, and move the task back to In Review when done."
    $reworkPath = "$logFile.rework"
    [System.IO.File]::WriteAllText($reworkPath, $reworkMessage, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "dispatch.ps1: coder rework - resuming session $coderSessionId"
    if ($agentBinary.ToLower() -eq 'codex') {
        # codex exec resume <id> - reads follow-up from stdin.
        # --json, --skip-git-repo-check, --yolo must be explicit on resume:
        # without them Codex activates the interactive console path which
        # fails headlessly (sandbox spawn error + MCP approval cancellation).
        $agentArgs = @('exec', '--json', '--skip-git-repo-check', '--yolo', 'resume', $coderSessionId, '-')
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardInput $reworkPath `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot | Out-Null
    } elseif ($agentBinary.ToLower() -eq 'opencode') {
        $agentArgs = @('run', '--dangerously-skip-permissions', '-s', $coderSessionId, '-f', $reworkPath, '--', 'Read and follow the attached instructions.')
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot | Out-Null
    } else {
        $agentArgs = @('--resume', $coderSessionId, '--dangerously-skip-permissions')
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardInput $reworkPath `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot | Out-Null
    }
} elseif ($isReviewerResume) {
    $reviewResumeMessage = "The coder has addressed the findings on task $env:TASK_ID. Re-read the task via the Backlog.md MCP (task_view), verify every fix, run the tests, and move to Human Review if everything passes or request more changes if issues remain."
    $reviewResumePath = "$logFile.resume"
    [System.IO.File]::WriteAllText($reviewResumePath, $reviewResumeMessage, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "dispatch.ps1: reviewer resume - resuming session $reviewerSessionId"
    if ($agentBinary.ToLower() -eq 'codex') {
        $agentArgs = @('exec', '--json', '--skip-git-repo-check', '--yolo', 'resume', $reviewerSessionId, '-')
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardInput $reviewResumePath `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot | Out-Null
    } elseif ($agentBinary.ToLower() -eq 'opencode') {
        $agentArgs = @('run', '--dangerously-skip-permissions', '-s', $reviewerSessionId, '-f', $reviewResumePath, '--', 'Read and follow the attached instructions.')
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot | Out-Null
    } else {
        $agentArgs = @('--resume', $reviewerSessionId, '--dangerously-skip-permissions')
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardInput $reviewResumePath `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot | Out-Null
    }
} elseif ($agentBinary.ToLower() -eq 'codex') {
    # First run: codex exec reads the prompt from stdin via `-`.
    # --json captures thread.started so the coder can extract the session ID.
    # --skip-git-repo-check lets it run outside a git repo root.
    # --yolo = unattended (no confirmation prompts).
    $agentArgs = @('exec', '--json', '--skip-git-repo-check', '--yolo', '-')
    Start-Process `
        -FilePath $agentExec `
        -ArgumentList $agentArgs `
        -RedirectStandardInput $promptPath `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -WindowStyle Hidden `
        -WorkingDirectory $projectRoot | Out-Null
} elseif ($agentBinary.ToLower() -eq 'opencode') {
    # opencode run: attach the prompt file with -f.
    # The message positional must come AFTER -- to prevent opencode from
    # treating it as additional -f arguments.
    $agentArgs = @('run', '--dangerously-skip-permissions', '-f', $promptPath, '--', 'Read and follow the attached instructions completely.')
    Start-Process `
        -FilePath $agentExec `
        -ArgumentList $agentArgs `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -WindowStyle Hidden `
        -WorkingDirectory $projectRoot | Out-Null
} else {
    # Claude: new session, prompt via stdin.
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
