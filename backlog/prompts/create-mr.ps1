# Deterministic GitLab MR creation for the dispatch pipeline (PowerShell 5.1).
#
# Invoked by dispatch.ps1 when a task transitions to Human Review, so MR
# creation no longer depends on the reviewer agent remembering to do it.
# Idempotent: if an MR already exists for the branch (any state) it does nothing.
# Non-fatal by contract: prints a status line and returns; never throws in a way
# that would block the caller. ASCII-ONLY source (PS 5.1 reads .ps1 as ANSI).
#
# GitLab-specific. To enable it in a consumer project set:
#   GITLAB_PROJECT_ID  - numeric project id (required; script skips if unset)
#   GITLAB_TOKEN       - PAT (else resolved from .mcp.json / ~/.codex/config.toml)
# On a GitHub project this script simply skips (no project id) and the reviewer
# agent's own MR/PR step in review.md remains the path.
#
# Usage: create-mr.ps1 -TaskId TASK-189 -ProjectRoot <path> [-TaskFile <path>]

param(
    [Parameter(Mandatory = $true)] [string] $TaskId,
    [Parameter(Mandatory = $true)] [string] $ProjectRoot,
    [string] $TaskFile = ''
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot

# GitLab.com requires TLS 1.2; PS 5.1 may default lower.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Write-Status([string] $msg) { Write-Host "create-mr.ps1: $msg" }

$projectId = $env:GITLAB_PROJECT_ID
if (-not $projectId) {
    Write-Status "GITLAB_PROJECT_ID not set - skipping MR creation (GitHub project, or configure the env var to enable)"
    return
}
$targetBranch = if ($env:GITLAB_TARGET_BRANCH) { $env:GITLAB_TARGET_BRANCH } else { 'main' }

# -- Resolve the GitLab token --------------------------------------------------
# Order: env GITLAB_TOKEN -> .mcp.json (gitlab server) -> ~/.codex/config.toml.
function Resolve-GitlabToken {
    if ($env:GITLAB_TOKEN) { return $env:GITLAB_TOKEN }

    $mcpPath = Join-Path $ProjectRoot '.mcp.json'
    if (Test-Path $mcpPath) {
        try {
            $json = Get-Content $mcpPath -Raw | ConvertFrom-Json
            $tok = $json.mcpServers.gitlab.env.GITLAB_TOKEN
            if ($tok) { return $tok }
        } catch {}
    }

    $codexCfg = Join-Path $env:USERPROFILE '.codex\config.toml'
    if (Test-Path $codexCfg) {
        $m = Select-String -Path $codexCfg -Pattern 'GITLAB_TOKEN\s*=\s*"([^"]+)"' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($m) { return $m.Matches[0].Groups[1].Value }
    }
    return ''
}

# -- Resolve the implementation branch -----------------------------------------
# Primary source: a "Branch:" line in the task notes (take the LAST one). Never
# use `git branch --show-current` (the shared main worktree HEAD is unreliable).
# Fallback: match an origin branch by the task number on a word boundary so
# task-18 does not match task-189.
function Resolve-Branch([string] $taskContent, [string] $taskNum) {
    if ($taskContent) {
        $matches = [regex]::Matches($taskContent, '(?im)^\s*Branch:\s*(feature/[A-Za-z0-9._/-]+)\s*$')
        if ($matches.Count -gt 0) {
            return $matches[$matches.Count - 1].Groups[1].Value.Trim()
        }
    }
    # Fallback: ls-remote, anchored on the number boundary.
    $heads = & git -C $ProjectRoot ls-remote --heads origin 2>$null
    if ($heads) {
        $pattern = "refs/heads/(feature/(?:task|issue)-$taskNum(?:-[A-Za-z0-9._-]+)?)$"
        foreach ($line in $heads) {
            $mm = [regex]::Match($line, $pattern)
            if ($mm.Success) { return $mm.Groups[1].Value }
        }
    }
    return ''
}

# -- Locate the task file ------------------------------------------------------
if (-not $TaskFile -or -not (Test-Path $TaskFile)) {
    $tasksDir = Join-Path $ProjectRoot 'backlog\tasks'
    $found = Get-ChildItem $tasksDir -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ilike "*$TaskId*" } | Select-Object -First 1
    if ($found) { $TaskFile = $found.FullName }
}

$taskContent = ''
if ($TaskFile -and (Test-Path $TaskFile)) { $taskContent = Get-Content $TaskFile -Raw }

$taskNum = ''
$nm = [regex]::Match($TaskId, '(\d+)')
if ($nm.Success) { $taskNum = $nm.Groups[1].Value }

$branch = Resolve-Branch $taskContent $taskNum
if (-not $branch) {
    Write-Status "no implementation branch found for $TaskId - skipping MR (investigation/process task, or branch not recorded)"
    return
}

# Verify the branch is actually on origin.
$onOrigin = & git -C $ProjectRoot ls-remote --heads origin $branch 2>$null
if (-not $onOrigin) {
    Write-Status "branch '$branch' not on origin - skipping MR (caller should ensure it is pushed)"
    return
}

$token = Resolve-GitlabToken
if (-not $token) {
    Write-Status "no GitLab token resolved - skipping MR (set GITLAB_TOKEN or .mcp.json gitlab env)"
    return
}

$apiBase = "https://gitlab.com/api/v4/projects/$projectId/merge_requests"
$headers = @{ 'PRIVATE-TOKEN' = $token }

# -- Idempotency: skip if an MR already exists for this source branch ----------
try {
    $enc = [System.Uri]::EscapeDataString($branch)
    $listUri = "$apiBase" + "?source_branch=$enc" + "&state=all"
    $existing = Invoke-RestMethod -Method Get -Headers $headers -Uri $listUri -ErrorAction Stop
    if ($existing -and $existing.Count -gt 0) {
        $iid = $existing[0].iid
        $state = $existing[0].state
        Write-Status "MR already exists for '$branch' (!$iid, $state) - nothing to do"
        return
    }
} catch {
    Write-Status "could not query existing MRs ($($_.Exception.Message)) - attempting create anyway"
}

# -- Resolve a title from frontmatter (single-line or folded block scalar) -----
function Resolve-Title([string] $content, [string] $taskId) {
    if ($content) {
        $lines = $content -split "`r?`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^title:\s*(.*)$') {
                $val = $matches[1].Trim()
                if ($val -eq '>-' -or $val -eq '>' -or $val -eq '|' -or $val -eq '|-' -or $val -eq '') {
                    # Folded/block scalar: gather following indented lines.
                    $parts = @()
                    for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                        if ($lines[$j] -match '^\s+\S') { $parts += $lines[$j].Trim() } else { break }
                    }
                    if ($parts.Count -gt 0) { return ($parts -join ' ') }
                } else {
                    return ($val.Trim("'").Trim('"'))
                }
            }
        }
    }
    return "$taskId changes"
}

$title = Resolve-Title $taskContent $TaskId
$mrTitle = "$title ($TaskId)"
$mrDescription = "Automated MR opened by the dispatch hook when $TaskId reached Human Review.`n`nCloses $TaskId"

$body = @{
    source_branch = $branch
    target_branch = $targetBranch
    title         = $mrTitle
    description   = $mrDescription
    remove_source_branch = $false
} | ConvertTo-Json

try {
    $created = Invoke-RestMethod -Method Post -Headers $headers -Uri $apiBase -ContentType 'application/json; charset=utf-8' -Body $body -ErrorAction Stop
    Write-Status "created MR !$($created.iid) for '$branch' -> $targetBranch ($($created.web_url))"
} catch {
    Write-Status "MR create failed for '$branch': $($_.Exception.Message)"
}
