---
id: BACK-494
title: >-
  Backlog-Guard: PreToolUse hook to enforce MCP/CLI access to backlog
  directories
status: Done
assignee:
  - '@lenucksi'
created_date: '2026-05-13 11:12'
updated_date: '2026-05-13 11:22'
labels:
  - tooling
  - hooks
  - dx
  - agent
dependencies: []
priority: medium
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents routinely attempt direct Read/Write/Edit/Bash operations on markdown files inside the `backlog/` directory tree. This bypasses Backlog.md's data model (status transitions, ID allocation, lock files, git integration) and is explicitly forbidden.

Implement a Claude Code PreToolUse hook — modelled after serena-guard — that hard-blocks any tool call targeting configured protected directories and redirects the agent to the correct MCP tool or CLI command with pre-filled parameters.

Configuration is file-based: a `.backlog-guard` YAML file in the project root lists the protected directories. The hook discovers this file by walking up from CWD to the git root, with a fallback auto-detect via `backlog/config.yml`.

A `.codex/skills/backlog-guard-setup/SKILL.md` skill enables one-command setup that:
- Auto-detects the backlog directory
- Creates the `.backlog-guard` config file
- Writes the hook entry into the appropriate settings file
- Optionally adds `mcp__backlog__*` tool permissions to the settings allowlist

The hook ships inside the Backlog.md repo under `hooks/backlog-guard/` so it is co-located and discoverable without a separate repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 hooks/backlog-guard/guard.sh exists, is executable, reads stdin JSON, exports env vars, calls check.py
- [x] #2 hooks/backlog-guard/check.py blocks Read/Write/Edit when file_path is under any protected dir
- [x] #3 hooks/backlog-guard/check.py blocks Bash commands (cat/head/tail/grep non-pipeline/find) targeting protected dirs
- [x] #4 Protected dirs read from .backlog-guard config file (YAML, dirs: key) discovered by walking up to git root
- [x] #5 Fallback auto-detection when no config file: scan CWD and up to 3 parents for backlog/config.yml
- [x] #6 Task ID extracted from filename (back-NNN-...) appears in block message for task files
- [x] #7 Block message includes both MCP tool call AND equivalent CLI command for every operation type
- [x] #8 hooks/backlog-guard/README.md documents installation, config file format, and what is blocked/allowed
- [x] #9 .codex/skills/backlog-guard-setup/SKILL.md creates .backlog-guard file and writes hook into settings
- [x] #10 Setup skill offers to add mcp__backlog__* tool permissions to the settings allowlist
- [x] #11 At least 6 Python tests covering: block task/doc, allow non-backlog, bash cat block, auto-detect, no-config clean exit
- [x] #12 All changes on feature branch rebased on upstream-master, clean PR
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Architecture

- `hooks/backlog-guard/guard.sh` — bash wrapper (identical pattern to serena-guard): reads stdin JSON, exports env vars (HOOK_TOOL, HOOK_FP, HOOK_CMD, HOOK_INPUT), calls check.py
- `hooks/backlog-guard/check.py` — path-prefix blocking logic (not extension-based). Discovers `.backlog-guard` YAML config by walking up to git root; fallback auto-detects `backlog/config.yml`. Generates targeted MCP+CLI suggestions from the blocked path.
- `hooks/backlog-guard/test_check.py` — 8 pytest tests covering all block/allow/edge cases
- `hooks/backlog-guard/README.md` — installation and configuration docs
- `.codex/skills/backlog-guard-setup/SKILL.md` — Claude Code setup skill

### Config File Format (`.backlog-guard` at git root)

```yaml
# Directories agents must not access directly. Paths relative to this file.
dirs:
  - backlog/
```

Discovery order in check.py:
1. `git rev-parse --show-toplevel` → look for `.backlog-guard` there
2. Walk CWD up to 4 levels looking for `.backlog-guard`
3. Fallback: walk CWD looking for `backlog/config.yml` (auto-detect)
4. If nothing found: `sys.exit(0)` — clean exit, no false positives

### Blocking Logic

- **Read/Write/Edit**: block if `file_path` resolves under any protected dir
- **Bash**: parse first pipeline segment only; block if `cat/head/tail/less/more/bat` args, `grep`/`egrep`/`fgrep` file args (not pattern position), or `find` root arg resolves under protected dir
- **Block message**: extract task ID from filename (`back-NNN-title.md` → `BACK-NNN`), classify path (task/doc/decision/milestone/config), produce exact MCP call + CLI command

### Setup Skill Workflow

1. Detect `backlog/config.yml` (walk up from CWD)
2. Locate `guard.sh` (source tree → global npm install → ask user)
3. Create `.backlog-guard` YAML in git root
4. Ask: project-local (`.claude/settings.local.json`) or user-global (`~/.claude/settings.json`)?
5. Write hook entry (matcher: `Read|Edit|Write|Bash`, command: abs path to guard.sh)
6. Offer to add full `mcp__backlog__*` allowlist to `permissions.allow`
7. Report and remind user to reload Claude Code

### Branch / PR Strategy

- Worktree at `./worktrees/backlog-guard` from `origin/main`
- Branch: `feature/back-494-backlog-guard-hook`
- PR title: `BACK-494 - Backlog-Guard: PreToolUse hook to enforce MCP/CLI access to backlog directories`
- No existing source files modified — all changes are additive

### serena-guard Reference

Both serena-guard versions (standalone + non-standalone) use identical hard-blocking (`permissionDecision: "deny"`). backlog-guard follows the same pattern. The only difference: path-prefix detection instead of file-extension detection.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All 5 files created via Serena (serena-guard blocked direct Write on .sh/.py):
- hooks/backlog-guard/guard.sh (executable, bash wrapper)
- hooks/backlog-guard/check.py (path-prefix blocking, YAML config discovery, MCP+CLI suggestions)
- hooks/backlog-guard/test_check.py (8 pytest tests, all passing in 1.65s)
- hooks/backlog-guard/README.md (installation, config format, block/allow table, serena-guard comparison)
- .codex/skills/backlog-guard-setup/SKILL.md (setup skill with 7-step workflow)
- .gitignore: added __pycache__/ and *.pyc

Branch: feature/back-494-backlog-guard-hook
Commit: 59308c6
PR: https://github.com/MrLesk/Backlog.md/pull/649

### OpenCode support (added post-initial-implementation)

OpenCode does NOT have Claude Code-style declarative shell-script hooks. Verified
against https://opencode.ai/docs. The equivalent mechanism is a JS plugin with a
`tool.execute.before` handler that throws an Error to hard-block a tool call.

Added `hooks/backlog-guard/opencode-plugin.js`:
- Mirrors check.py logic entirely in JavaScript (no external deps — YAML parsed
  with a targeted regex since the format is self-authored)
- Config discovery uses the same 4-step order as check.py (git root → CWD walk →
  auto-detect → no-op)
- Cache (`_cache` sentinel) avoids re-running `git rev-parse` + FS walk on every
  tool call within a long OpenCode session
- Block method: `throw new Error(message)` vs check.py's JSON stdout protocol

Updated README.md and SKILL.md to cover both tools:
- README: global/per-project install matrix for both Claude Code and OpenCode,
  mechanism comparison table
- SKILL.md: added Steps 7–8 for OpenCode (global symlink to
  `~/.config/opencode/plugins/` or per-project `plugin` array in opencode.json)

Also added `opencode.json` at repo root for use when developing Backlog.md itself
with OpenCode (MCP server + plugin wired up together).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented backlog-guard: a Claude Code PreToolUse hook that hard-blocks direct Read/Edit/Write/Bash access to configured backlog directories and redirects agents to the correct MCP tool or CLI command.

Files delivered (all additive, no existing source modified):
- hooks/backlog-guard/guard.sh — bash wrapper, identical pattern to serena-guard
- hooks/backlog-guard/check.py — path-prefix detection, YAML config discovery (git root walk-up + auto-detect fallback), targeted MCP+CLI suggestions with task ID extracted from filename
- hooks/backlog-guard/test_check.py — 8 pytest tests, all passing (1.65s)
- hooks/backlog-guard/README.md — installation, config format, block/allow table, serena-guard comparison
- .codex/skills/backlog-guard-setup/SKILL.md — 7-step setup skill: auto-detects backlog dir, creates .backlog-guard, writes hook entry, optionally adds mcp__backlog__* allowlist

Notable: serena-guard blocked direct Write on .py/.sh files during implementation — correctly redirected to mcp__plugin_serena_serena__create_text_file.

Commit: 59308c6
PR: https://github.com/MrLesk/Backlog.md/pull/649
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
