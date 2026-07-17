# Token-usage reporter (PowerShell 5.1 compatible)
#
# Records the token usage of a finished coder/reviewer agent session, read
# OUT-OF-BAND from the agent's own session transcript (so it costs the agent
# zero extra tokens to self-measure). Called by dispatch.ps1 when a task leaves
# a working state — OLD_STATUS tells us who just finished:
#   OLD_STATUS=In Progress -> coder finished   -> record coder session
#   OLD_STATUS=In Review    -> reviewer finished -> record reviewer session
#
# It writes two places:
#   1. backlog/prompts/logs/tokens.csv  (central ledger, one row per session)
#   2. a "Token usage (<role>): ..." line under the matching Session ID line in
#      the task .md (so it shows per-task in the backlog UI)
#
# Sources by agent binary:
#   claude   -> ~/.claude/projects/**/<sessionId>.jsonl (sum usage per turn)
#   codex    -> ~/.codex/sessions/**/rollout-*-<sessionId>.jsonl (last total_token_usage)
#   opencode -> stored in opencode.db (sqlite) — extraction pending; row written as 'pending'

param(
    [Parameter(Mandatory = $true)] [string]$TaskId,
    [Parameter(Mandatory = $true)] [string]$SessionId,
    [Parameter(Mandatory = $true)] [ValidateSet('coder', 'reviewer')] [string]$Role,
    [Parameter(Mandatory = $true)] [string]$AgentBinary,
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot -or $ProjectRoot -eq '') {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

$result = [ordered]@{
    input = 0; output = 0; cacheCreate = 0; cacheRead = 0; total = 0; status = 'ok'
}

function Sum-ClaudeJsonl([string]$path) {
    # Each assistant line carries one "usage":{...} (with nested cache_creation /
    # server_tool_use objects). The token field names are unique, so extract them
    # directly per line rather than trying to isolate the nested object.
    # Note: the leading quote in "input_tokens" avoids matching the nested
    # ephemeral_*_input_tokens fields (those are preceded by '_', not '"').
    $in = 0; $out = 0; $cc = 0; $cr = 0
    foreach ($line in [System.IO.File]::ReadLines($path)) {
        if ($line -notmatch '"usage"') { continue }
        if ($line -match '"input_tokens":\s*(\d+)')                { $in += [int]$matches[1] }
        if ($line -match '"output_tokens":\s*(\d+)')               { $out += [int]$matches[1] }
        if ($line -match '"cache_creation_input_tokens":\s*(\d+)') { $cc += [int]$matches[1] }
        if ($line -match '"cache_read_input_tokens":\s*(\d+)')     { $cr += [int]$matches[1] }
    }
    return @{ input = $in; output = $out; cacheCreate = $cc; cacheRead = $cr }
}

function Sum-CodexRollout([string]$path) {
    # Codex emits a cumulative total_token_usage; the LAST one is the session total.
    $lastInput = 0; $lastOutput = 0; $lastCached = 0
    $blockRe = [regex]'"total_token_usage":\{(?:[^{}]|\{[^{}]*\})*\}'
    $content = [System.IO.File]::ReadAllText($path)
    $matchesAll = $blockRe.Matches($content)
    if ($matchesAll.Count -gt 0) {
        $b = $matchesAll[$matchesAll.Count - 1].Value
        if ($b -match '"input_tokens":\s*(\d+)')        { $lastInput  = [int]$matches[1] }
        if ($b -match '"output_tokens":\s*(\d+)')       { $lastOutput = [int]$matches[1] }
        if ($b -match '"cached_input_tokens":\s*(\d+)') { $lastCached = [int]$matches[1] }
    }
    # Codex folds cache into input; report cached separately as cacheRead.
    return @{ input = ($lastInput - $lastCached); output = $lastOutput; cacheCreate = 0; cacheRead = $lastCached }
}

$bin = $AgentBinary.ToLower()
try {
    if ($bin -eq 'claude') {
        # Claude encodes the project path into the transcript dir name, but the
        # exact encoding varies; search every project dir for this session's file
        # so this works in any consumer project without hardcoding the path.
        $projectsRoot = Join-Path $env:USERPROFILE '.claude\projects'
        $file = Get-ChildItem $projectsRoot -Recurse -Filter "$SessionId.jsonl" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($file) {
            $s = Sum-ClaudeJsonl $file.FullName
            $result.input = $s.input; $result.output = $s.output
            $result.cacheCreate = $s.cacheCreate; $result.cacheRead = $s.cacheRead
        } else {
            $result.status = 'transcript-not-found'
        }
    } elseif ($bin -eq 'codex') {
        $sessRoot = Join-Path $env:USERPROFILE '.codex\sessions'
        $file = Get-ChildItem $sessRoot -Recurse -Filter "rollout-*-$SessionId.jsonl" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($file) {
            $s = Sum-CodexRollout $file.FullName
            $result.input = $s.input; $result.output = $s.output
            $result.cacheCreate = $s.cacheCreate; $result.cacheRead = $s.cacheRead
        } else {
            $result.status = 'transcript-not-found'
        }
    } elseif ($bin -eq 'opencode') {
        # opencode stores usage in opencode.db (sqlite); extraction is a follow-up.
        $result.status = 'pending-opencode'
    } else {
        $result.status = "unknown-agent:$bin"
    }
} catch {
    $result.status = "error:$($_.Exception.Message)"
}

$result.total = [int]$result.input + [int]$result.output + [int]$result.cacheCreate + [int]$result.cacheRead

# ── 1. Central ledger ─────────────────────────────────────────────────────────
$logDir = Join-Path $ProjectRoot 'backlog\prompts\logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$csv = Join-Path $logDir 'tokens.csv'
if (-not (Test-Path $csv)) {
    'timestamp,task,role,agent,session_id,input,output,cache_create,cache_read,total,status' |
        Out-File -FilePath $csv -Encoding utf8
}
# Idempotent: skip if this session id is already recorded.
$already = $false
if (Test-Path $csv) {
    $already = (Select-String -Path $csv -SimpleMatch $SessionId -Quiet)
}
if (-not $already) {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $row = "$ts,$TaskId,$Role,$bin,$SessionId,$($result.input),$($result.output),$($result.cacheCreate),$($result.cacheRead),$($result.total),$($result.status)"
    Add-Content -Path $csv -Value $row -Encoding utf8
}

# ── 2. Per-task line under the Session ID ─────────────────────────────────────
$tasksDir = Join-Path $ProjectRoot 'backlog\tasks'
$taskFile = Get-ChildItem $tasksDir -Recurse -Filter "*$TaskId*.md" -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($taskFile) {
    $idLabel = if ($Role -eq 'reviewer') { 'Reviewer Session ID:' } else { 'Session ID:' }
    $usageLine = "Token usage ($Role): total=$($result.total) output=$($result.output) input=$($result.input) cacheCreate=$($result.cacheCreate) cacheRead=$($result.cacheRead) [$($result.status)]"
    $lines = [System.IO.File]::ReadAllLines($taskFile.FullName)
    $out = New-Object System.Collections.Generic.List[string]
    $i = 0
    $inserted = $false
    while ($i -lt $lines.Count) {
        $out.Add($lines[$i]) | Out-Null
        if (-not $inserted -and $lines[$i] -match [regex]::Escape($idLabel) -and $lines[$i] -match [regex]::Escape($SessionId)) {
            # Replace an existing follow-up usage line, else insert a new one.
            if ($i + 1 -lt $lines.Count -and $lines[$i + 1] -match '^Token usage \(') {
                $i++  # skip the stale usage line
            }
            $out.Add($usageLine) | Out-Null
            $inserted = $true
        }
        $i++
    }
    if ($inserted) {
        [System.IO.File]::WriteAllLines($taskFile.FullName, $out, (New-Object System.Text.UTF8Encoding $false))
    }
}

Write-Host "token-report: $TaskId $Role $bin -> total=$($result.total) output=$($result.output) [$($result.status)]"
