---
id: BACK-111
title: Add editor shortcut (E) to kanban and task views
status: Done
assignee: []
created_date: '2025-07-04'
updated_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Add keyboard shortcut 'E' to open the selected task file in the user's preferred editor from both the kanban board view and individual task view. The editor should be determined from (in order of preference):
1. Configuration file setting (defaultEditor)
2. EDITOR environment variable
3. Platform-specific fallback

## Acceptance Criteria

- [x] Pressing 'E' in kanban view opens selected task in editor
- [x] Pressing 'E' in task view opens current task in editor
- [x] Editor is determined from config.defaultEditor if set
- [x] Falls back to EDITOR environment variable if config not set
- [x] Falls back to platform-specific default if neither is set
- [x] Configuration can be set via `backlog config set defaultEditor <editor>`
- [x] Configuration can be viewed via `backlog config get defaultEditor`
- [x] Help text shows the new 'E' shortcut
- [x] Works on all platforms (Windows/Mac/Linux)

## Implementation Plan

1. **Add defaultEditor to BacklogConfig interface**
   - Update config type definition to include optional `defaultEditor: string` field
   - Update config validation and parsing logic

2. **Create editor resolution function**
   - Function to determine editor in priority order: config.defaultEditor → EDITOR env → platform default
   - Platform defaults: `notepad` (Windows), `nano` (Linux), `vi` (macOS fallback)

3. **Add keyboard shortcut handling**
   - Implement 'E' key handler in kanban board view
   - Implement 'E' key handler in task detail view
   - Use editor resolution function to spawn editor process

4. **Add configuration commands**
   - Allow setting defaultEditor via CLI config commands
   - Validate editor command exists before saving to config

5. **Update UI help text**
   - Add 'E' shortcut to help displays in both views
   - Document editor resolution priority in help

6. **Testing**
   - Test with config setting, env variable, and fallbacks
   - Test on multiple platforms
   - Test error handling for invalid editors

## Implementation Notes

**Completed features:**
- Added `defaultEditor` field to BacklogConfig interface
- Created `src/utils/editor.ts` with editor resolution logic:
  - `resolveEditor()`: Determines editor based on config → env → platform default
  - `isEditorAvailable()`: Checks if editor command exists on system
  - `openInEditor()`: Opens file in resolved editor
- Added 'E' keyboard shortcut to kanban board view (`src/ui/board.ts`)
- Added 'E' keyboard shortcut to task detail view (`src/ui/task-viewer.ts`)
- Updated help text in both views to show "E edit" option
- Comprehensive test coverage in `src/test/editor.test.ts`

**Platform defaults:**
- Windows: `notepad`
- macOS/Linux: `nano`
- Fallback: `vi`

**Technical decisions:**
- Used `spawnSync` with `stdio: "inherit"` to open editor in foreground
- Silent error handling - if editor fails, user simply stays in the UI
- Editor commands can include arguments (e.g., "code --wait")
- Platform detection uses `which`/`where` commands for reliability

**Completed features (continued):**
- Added CLI config commands to set/get defaultEditor value:
  - `backlog config set defaultEditor "code --wait"` - Sets the default editor with validation
  - `backlog config get defaultEditor` - Gets the current default editor setting
  - `backlog config list` - Shows all configuration values including defaultEditor
- Editor validation: The set command validates that the editor exists before saving
- Comprehensive test coverage for config operations in `src/test/config-commands.test.ts`
- Updated documentation:
  - `readme.md` - Added 'E' shortcut notes to CLI reference and defaultEditor to config table
  - `CLAUDE.md` - Added config management commands section
  - `AGENTS.md` - Added config management commands section
  - `.cursorrules` - Added config management commands section and CLI table entries
  - `GEMINI.md` - Added config management commands section
  - `.github/copilot-instructions.md` - Created file with config management commands

**All acceptance criteria now completed!** ✅
