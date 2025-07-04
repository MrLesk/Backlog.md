---
id: task-105
title: Remove dot from .backlog folder name
status: To Do
assignee: []
created_date: '2025-07-03'
labels: []
dependencies: []
---

## Description

Currently tasks are stored in .backlog directory which is hidden. This causes issues with file referencing (e.g., Claude's @ tool) and user interaction outside the CLI. Remove the dot to make it a visible 'backlog' folder.

**Migration Strategy**: Make the backlog directory configurable with 'backlog' as the new default. For backward compatibility, existing installations without the `backlogDirectory` config field will automatically default to '.backlog' to preserve existing folder structures. Users can manually migrate by renaming their folder and updating their config.

## Acceptance Criteria

- [x] Folder renamed from .backlog to backlog (now configurable with 'backlog' as default)
- [x] All documentation files updated to reference 'backlog' instead of '.backlog'
- [x] All test files updated to use 'backlog' instead of '.backlog'
- [x] All source code references updated from '.backlog' to 'backlog'
- [x] All functionality works correctly after the change
- [x] Made configurable via backlog_directory setting in config.yml
- [x] Backward compatibility maintained through configuration
- [x] Migration logic: configs without backlogDirectory field default to '.backlog' for backward compatibility
- [x] New installations use 'backlog' as default directory name
- [x] Users can manually migrate by renaming folder and updating config

## Implementation Notes

**Approach taken:**
- Made the backlog directory configurable through a new `backlogDirectory` field in `BacklogConfig`
- Changed the default from ".backlog" to "backlog" in constants
- Implemented automatic migration logic to detect legacy configs and set them to use ".backlog"
- Updated all hardcoded references throughout the codebase to use the configurable directory

**Features implemented:**
- Configurable backlog directory via `backlog_directory` setting in config.yml
- Automatic backward compatibility migration that writes missing config field
- Updated FileSystem class to use async directory getters based on config
- Updated GitOperations to accept configurable directory parameter
- Updated CLI and core classes to use configurable directory paths

**Technical decisions and trade-offs:**
- **Simple migration approach**: Instead of complex folder detection, we simply auto-add `backlogDirectory: ".backlog"` to configs missing this field. This is much cleaner and avoids runtime fallbacks.
- **Explicit config updates**: The migration writes the config field permanently rather than using runtime defaults, ensuring clarity.
- **Manual user migration**: Users who want the new visible folder must manually rename and update config, giving them full control.

**Modified files:**
- `src/types/index.ts`: Added `backlogDirectory` field to BacklogConfig interface
- `src/constants/index.ts`: Changed DEFAULT_DIRECTORIES.BACKLOG from ".backlog" to "backlog"
- `src/file-system/operations.ts`: Added configurable directory logic and migration
- `src/core/backlog.ts`: Updated to use configurable directory for git operations
- `src/git/operations.ts`: Made stageBacklogDirectory accept directory parameter
- `src/cli.ts`: Updated to use configurable directory for remote task loading
- `src/core/cross-branch-tasks.ts`: Updated to use configurable directory paths
- `src/core/remote-tasks.ts`: Updated to use configurable directory paths
- All test files: Updated to use new "backlog" default
- All documentation files: Updated references from ".backlog" to "backlog"
