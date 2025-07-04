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
