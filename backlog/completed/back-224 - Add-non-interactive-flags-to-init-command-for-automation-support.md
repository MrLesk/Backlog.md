---
id: BACK-224
title: Add non-interactive flags to init command for automation support
status: Done
assignee:
  - '@claude'
created_date: '2025-08-04 16:54'
updated_date: '2025-08-04 17:07'
labels:
  - cli
  - enhancement
dependencies: []
---

## Description

Support non-interactive initialization for automation tools like terminal-bench where interactive prompts are not possible. The command should accept all configuration options as CLI flags to enable seamless integration with CI/CD pipelines and automated workflows.

## Acceptance Criteria

- [x] All interactive prompts can be bypassed with CLI flags
- [x] A --defaults flag uses sensible defaults for all options
- [x] Existing interactive behavior remains unchanged when no flags are provided
- [x] Help text documents all new flags clearly
- [x] Non-interactive mode works correctly in CI/CD environments

## Implementation Plan

1. Add --agent-files option to init command with comma-separated values support
2. Skip agent files prompt when --agent-files is provided
3. Parse and validate the provided agent file names
4. Use defaults for all other prompts when --agent-files is used
5. Ensure backward compatibility - interactive prompts work when no flags provided
6. Add proper help text documenting the new flag
7. Test with 'backlog init "Test Project" --agent-files CLAUDE.md'

## Implementation Notes

Implemented comprehensive non-interactive support for the init command with the following features:

**Core Implementation:**
- Added 11 new CLI flags covering all interactive prompts: `--agent-instructions`, `--check-branches`, `--include-remote`, `--branch-days`, `--bypass-git-hooks`, `--zero-padded-ids`, `--default-editor`, `--web-port`, `--auto-open-browser`, `--install-claude-agent`, and `--defaults`
- Created helper functions `parseBoolean()` and `parseNumber()` for robust flag parsing
- Non-interactive mode automatically activates when any flag is provided

**Key Features:**
- `--agent-instructions` supports friendly names (claude, cursor, copilot) that map to actual filenames (CLAUDE.md, .cursorrules, etc.)
- `--defaults` flag bypasses all prompts using sensible defaults
- All flags support both explicit values and fallback to existing config or defaults
- Boolean flags accept 'true'/'false' or '1'/'0' values
- Maintains full backward compatibility - interactive mode unchanged when no flags provided

**Usage Examples:**
- `backlog init "Project" --defaults` - Uses all defaults
- `backlog init "Project" --agent-instructions claude --web-port 8080` - Specific options
- `backlog init "Project" --install-claude-agent true --bypass-git-hooks true` - Multiple flags

**Files Modified:**
- `src/cli.ts`: Added all CLI options and updated prompt logic for non-interactive mode
