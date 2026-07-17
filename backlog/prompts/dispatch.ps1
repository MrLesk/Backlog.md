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

# ── Force subscription auth for dispatched agents ────────────────────────────
# The repo-root .env carries ANTHROPIC_API_KEY for the app (OCR / WhatsApp LLM),
# and docker-compose / the watcher shell leak it into this process's environment.
# The Claude CLI prefers an API key over the subscription OAuth token whenever the
# var is present, so every dispatched coder/reviewer was silently billing to the
# API account (cost spike + "Credit balance is too low" when it ran dry) instead
# of the Pro subscription. The dispatcher never calls the Anthropic API itself,
# and Codex/opencode don't use this var, so stripping it here forces every
# dispatched Claude to fall back to the subscription token. The app's own key is
# untouched — it's injected straight into the containers by docker-compose.
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

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

# ── Deduplication guard ───────────────────────────────────────────────────────
# The onStatusChange hook can fire twice for the same event when the in-process
# dispatch and the file-watcher dispatch race (both within the same millisecond).
# File::Open with CreateNew is atomic on Windows: the first caller wins, the
# second gets an IOException and exits — no second agent is launched.
# The dedup key is per (taskId, status) within a 1-second window.
$dedupeKey  = "$(Get-Date -Format 'yyyyMMdd-HHmmss')-$safeTaskId-$safeStatus.dedup"
$dedupeLock = Join-Path $logDir $dedupeKey
try {
    $s = [System.IO.File]::Open($dedupeLock,
             [System.IO.FileMode]::CreateNew,
             [System.IO.FileAccess]::ReadWrite,
             [System.IO.FileShare]::None)
    $s.Close()
} catch {
    Write-Host "dispatch.ps1: duplicate suppressed for $env:TASK_ID -> $env:NEW_STATUS"
    exit 0
}
# Prune dedup files older than 60 s so they don't accumulate.
Get-ChildItem $logDir -Filter '*.dedup' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddSeconds(-60) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

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
$modelMap = @{}
$effortMap = @{}
if (Test-Path $configFile) {
    $configContent = Get-Content $configFile -Raw
    # Extract the agents: block line by line — simple enough without gray-matter.
    # `alias:` opens a new entry; `binary:`/`model:`/`effort:` attach to the
    # current alias (model/effort follow binary in the YAML, so we keep the
    # alias as context until the next entry rather than clearing it on binary).
    $inAgents = $false
    $currentAlias = ''
    foreach ($line in $configContent -split '\r?\n') {
        if ($line -match '^agents:') {
            $inAgents = $true
            continue
        }
        if ($inAgents) {
            # Stop at the next top-level key (not indented).
            if ($line -match '^[A-Za-z_]') { $inAgents = $false; continue }
            if ($line -match '^\s+-\s+alias:\s*[''"]?([^''"]+)[''"]?\s*$') {
                $currentAlias = $matches[1].Trim()
            } elseif ($currentAlias -ne '' -and $line -match '^\s+binary:\s*[''"]?([^''"]+)[''"]?\s*$') {
                $aliasMap[$currentAlias] = $matches[1].Trim()
            } elseif ($currentAlias -ne '' -and $line -match '^\s+model:\s*[''"]?([^''"]+)[''"]?\s*$') {
                $modelMap[$currentAlias] = $matches[1].Trim()
            } elseif ($currentAlias -ne '' -and $line -match '^\s+effort:\s*[''"]?([^''"]+)[''"]?\s*$') {
                $effortMap[$currentAlias] = $matches[1].Trim()
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

# ── Record token usage of the session that just finished ──────────────────────
# OLD_STATUS tells us who was working: In Progress -> coder, In Review -> reviewer.
# token-report.ps1 reads the count out-of-band from the agent's own transcript
# (zero extra agent tokens). A reporting failure must never block dispatch.
try {
    $finishedRole = ''; $finishedSession = ''; $finishedAlias = ''
    if ($env:OLD_STATUS -eq 'In Progress') {
        $finishedRole = 'coder'; $finishedSession = $coderSessionId; $finishedAlias = $taskAgentName
    } elseif ($env:OLD_STATUS -eq 'In Review') {
        $finishedRole = 'reviewer'; $finishedSession = $reviewerSessionId
        $finishedAlias = if ($taskReviewAgentName) { $taskReviewAgentName } else { $taskAgentName }
    }
    if ($finishedSession -ne '' -and $finishedAlias -ne '') {
        $finishedBinary = if ($aliasMap.ContainsKey($finishedAlias)) { $aliasMap[$finishedAlias] } else { $finishedAlias.ToLower() }
        & (Join-Path $scriptDir 'token-report.ps1') `
            -TaskId $env:TASK_ID -SessionId $finishedSession -Role $finishedRole `
            -AgentBinary $finishedBinary -ProjectRoot $projectRoot
    }
} catch {
    Write-Host "dispatch.ps1: token-report skipped - $($_.Exception.Message)"
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

# ── Deterministic MR creation on Human Review ─────────────────────────────────
# The reviewer agent is supposed to open the MR (review.md Step 6) but does so
# unreliably (esp. on the rework -> re-review resume path). Create it here too,
# deterministically and idempotently, so an approved task always gets its MR.
# create-mr.ps1 resolves the branch from the task notes, skips if an MR already
# exists, and never throws fatally. A failure here must not block the notifier.
if ($env:NEW_STATUS -eq 'Human Review') {
    try {
        $taskFilePath = if ($taskFile) { $taskFile.FullName } else { '' }
        & (Join-Path $scriptDir 'create-mr.ps1') `
            -TaskId $env:TASK_ID -ProjectRoot $projectRoot -TaskFile $taskFilePath
    } catch {
        Write-Host "dispatch.ps1: create-mr skipped - $($_.Exception.Message)"
    }
}

# ── Model / effort resolution (claude only) ───────────────────────────────────
# Per-agent model/effort from the config alias drive --model/--effort. Only
# claude supports these flags; codex/opencode launches are left unchanged.
$claudeModelArgs = @()
if ($agentBinary.ToLower() -eq 'claude') {
    if ($modelMap.ContainsKey($agentName) -and $modelMap[$agentName] -ne '') {
        $claudeModelArgs += @('--model', $modelMap[$agentName])
    }
    if ($effortMap.ContainsKey($agentName) -and $effortMap[$agentName] -ne '') {
        $claudeModelArgs += @('--effort', $effortMap[$agentName])
    }
}

# ── Role-scoped MCP config (claude only) ──────────────────────────────────────
# Every claude session was loading all 7 MCP servers from .mcp.json (gitlab's
# ~100 tool schemas + 4 cloudflare servers + playwright + backlog), inflating
# context before any work began. Scope the server set to what the role actually
# needs and pass it with --strict-mcp-config so .mcp.json is ignored:
#   coder (In Progress)   -> backlog + playwright
#   reviewer (In Review)  -> backlog + gitlab + playwright (gitlab for the MR)
#   notifier (Human Review) -> coder set (only needs backlog)
$claudeMcpArgs = @()
if ($agentBinary.ToLower() -eq 'claude') {
    if ($env:NEW_STATUS -eq 'In Review') {
        $mcpConfigFile = Join-Path $projectRoot '.claude\mcp-reviewer.json'
    } else {
        $mcpConfigFile = Join-Path $projectRoot '.claude\mcp-coder.json'
    }
    if (Test-Path $mcpConfigFile) {
        $claudeMcpArgs += @('--strict-mcp-config', '--mcp-config', $mcpConfigFile)
    } else {
        Write-Host "dispatch.ps1: MCP config not found ($mcpConfigFile) - falling back to .mcp.json"
    }
}

# ── Append resolved model/effort to the prompt context ────────────────────────
# The prompt file was written above (before agent resolution), so the model/
# effort the agent is launched with aren't in it yet. Append them now so the
# agent can copy exact values into its Session block. claude only — codex/
# opencode aren't launched with these flags and self-report. Not reached on the
# dry-run / dedup early exits (no launch happens there anyway).
if ($agentBinary.ToLower() -eq 'claude' -and (Test-Path $promptPath)) {
    $resolvedModel  = if ($modelMap.ContainsKey($agentName))  { $modelMap[$agentName] }  else { '' }
    $resolvedEffort = if ($effortMap.ContainsKey($agentName)) { $effortMap[$agentName] } else { '' }
    if ($resolvedModel -ne '' -or $resolvedEffort -ne '') {
        [System.IO.File]::AppendAllText($promptPath, "`nModel: $resolvedModel`nEffort: $resolvedEffort`n", (New-Object System.Text.UTF8Encoding $false))
    }
}

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
# Conditions for --resume (post-review rework):
#   1. Agent is claude (Codex/opencode don't support --resume)
#   2. Status is "In Progress" (rework trigger)
#   3. A coder session ID exists in the task notes
#   4. The task body contains at least one "CHANGES REQUESTED" review block
#
# A second, distinct case is a stranded-retry: the coder's first run died
# (provider usage/rate limit) before ever reaching review, so there's no
# "CHANGES REQUESTED" block to match on. The dispatcher's stranded-agent
# recovery re-fires with OLD_STATUS=NEW_STATUS='In Progress' -- a signature
# that never occurs on a normal fresh dispatch (which is always
# To Do -> In Progress). When that signature is present and a coder session
# ID was already captured, resume that session instead of paying to re-read
# the whole repo from scratch.
#
$resumeCapableAgents = @('claude', 'codex', 'opencode')

$isPostReviewRework = $false
if ($resumeCapableAgents -contains $agentBinary.ToLower() -and
    $env:NEW_STATUS -eq 'In Progress' -and
    $coderSessionId -ne '' -and
    $taskContent -match 'CHANGES REQUESTED') {
    $isPostReviewRework = $true
}

$isStrandedRetry = $false
if ($resumeCapableAgents -contains $agentBinary.ToLower() -and
    $env:OLD_STATUS -eq 'In Progress' -and
    $env:NEW_STATUS -eq 'In Progress' -and
    $coderSessionId -ne '' -and
    -not $isPostReviewRework) {
    $isStrandedRetry = $true
}

$isCoderRework = $isPostReviewRework -or $isStrandedRetry

$isReviewerResume = $false
if ($resumeCapableAgents -contains $agentBinary.ToLower() -and
    $env:NEW_STATUS -eq 'In Review' -and
    $reviewerSessionId -ne '') {
    $isReviewerResume = $true
}

if ($isCoderRework) {
    if ($isStrandedRetry) {
        $reworkMessage = "Your previous session on task $env:TASK_ID was interrupted before finishing (e.g. a provider usage/rate limit) and no implementation was committed. Read the task via the Backlog.md MCP (task_view) and resume from where you left off -- you may already have useful context on the codebase in this session. Finish the implementation, run the tests, commit, and move the task to In Review when done."
    } else {
        $reworkMessage = "The reviewer requested changes on task $env:TASK_ID. Read the task via the Backlog.md MCP (task_view), find the latest Review section with CHANGES REQUESTED, address every finding, run the tests, and move the task back to In Review when done."
    }
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
            -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
    } elseif ($agentBinary.ToLower() -eq 'opencode') {
        $agentArgs = @('run', '--dangerously-skip-permissions', '-s', $coderSessionId, '-f', $reworkPath, '--', 'Read and follow the attached instructions.')
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
    } else {
        $agentArgs = @('--resume', $coderSessionId, '--dangerously-skip-permissions') + $claudeModelArgs + $claudeMcpArgs
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardInput $reworkPath `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
    }
} elseif ($isReviewerResume) {
    $reviewResumeMessage = "The coder has addressed the findings on task $env:TASK_ID. Re-read the task via the Backlog.md MCP (task_view), verify every fix, and run the tests. If anything still fails, request more changes (set status In Progress). If everything passes, you MUST complete the FULL approval routing from review.md Step 6 before finishing. Do NOT just move the status. In order: (1) check the satisfied acceptance criteria, (2) ensure the implementation branch is pushed to origin, (3) create the GitLab Merge Request into main via the gitlab MCP create_merge_request with dry_run set to false, using the implementation branch recorded in the task notes as source_branch and NOT the git current branch, then (4) set status to Human Review. If you cannot create the MR, append a clearly-flagged note that the MR was NOT created and still proceed. Never skip the MR step silently."
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
            -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
    } elseif ($agentBinary.ToLower() -eq 'opencode') {
        $agentArgs = @('run', '--dangerously-skip-permissions', '-s', $reviewerSessionId, '-f', $reviewResumePath, '--', 'Read and follow the attached instructions.')
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
    } else {
        $agentArgs = @('--resume', $reviewerSessionId, '--dangerously-skip-permissions') + $claudeModelArgs + $claudeMcpArgs
        Start-Process `
            -FilePath $agentExec `
            -ArgumentList $agentArgs `
            -RedirectStandardInput $reviewResumePath `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -WindowStyle Hidden `
            -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
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
        -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
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
        -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
} else {
    # Claude: new session, prompt via stdin.
    $agentArgs = @('-p', '--dangerously-skip-permissions') + $claudeModelArgs + $claudeMcpArgs
    Start-Process `
        -FilePath $agentExec `
        -ArgumentList $agentArgs `
        -RedirectStandardInput $promptPath `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -WindowStyle Hidden `
        -WorkingDirectory $projectRoot -PassThru | ForEach-Object { $script:agentProc = $_ }
}

# Write the launched agent's PID so the web UI can check whether the process is
# still alive. The dispatch.ps1 PID ($PID in the filename) exits immediately after
# Start-Process — the .pid file holds the actual agent process's ID.
if ($script:agentProc) {
    "$($script:agentProc.Id)" | Set-Content "$logFile.pid" -Encoding utf8 -NoNewline
}
