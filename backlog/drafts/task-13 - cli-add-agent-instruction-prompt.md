---
id: task-13
title: 'CLI: Add Agent Instruction Prompt'
status: Done
assignee: []
reporter: @MrLesk
created_date: 2025-06-08
updated_date: 2025-06-09
labels: [cli, agents]
dependencies: []
---

## Description

Add an interactive step to `backlog init` that asks the user if they want to include instructions for AI agents such as Codex, Claude Code, or Google Jules. When confirmed, the command should create the appropriate guideline files (`AGENTS.md`, `.CLAUDE.md`, `.cursorrules`) if they do not exist, or append the instructions if they are already present.

## Acceptance Criteria

- [x] `backlog init` prompts: "Add instructions for AI agents? [y/N]".
- [x] On confirmation, guideline files are created or updated with Backlog usage instructions.
- [x] Existing files are appended rather than overwritten.
- [x] Declining the prompt leaves the repository unchanged.
- [x] Feature covered by automated tests.

## Implementation Notes

Added interactive agent instructions prompt to the CLI `backlog init` command. Key technical details:

**CLI Integration (src/cli.ts:48-57):**
- Added prompt "Add instructions for AI agents? [y/N]" after reporter configuration
- Only calls `addAgentInstructions()` when user confirms with "y" or "yes"
- Integrated with existing git operations for automatic commit

**Agent Instructions Module (src/agent-instructions.ts):**
- Creates three guideline files: `AGENTS.md`, `CLAUDE.md`, and `.cursorrules`
- Reads existing files and appends new content rather than overwriting
- Handles missing files by creating them with default content
- Automatically commits changes via GitOperations when provided

**Guideline Content (src/guidelines/):**
- `AGENTS.md`: General guidelines for AI agents working with Backlog projects
- `CLAUDE.md`: Specific instructions for Claude Code integration
- `.cursorrules`: Configuration for Cursor AI editor

**Testing:**
- Unit tests in `src/test/agent-instructions.test.ts` verify file creation and appending behavior
- CLI integration test in `src/test/cli.test.ts` verifies end-to-end functionality
- All 127 tests pass including the new integration test

**File Handling:**
- Uses Bun.file() for efficient file I/O operations
- Preserves existing content by reading before writing
- Ensures proper newline handling when appending content
