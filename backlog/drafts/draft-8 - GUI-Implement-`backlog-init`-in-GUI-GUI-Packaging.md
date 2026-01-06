---
id: DRAFT-8
title: 'GUI: Implement `backlog init` in GUI & GUI Packaging'
status: To Do
assignee: []
reporter: '@MrLesk'
created_date: '2025-06-04'
labels:
  - gui
  - feature
milestone: M3 - GUI
dependencies:
  - task-8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- Implement a GUI mechanism to perform the `backlog init` action
- Set up build process for the Tauri build tool to create distributable packages.
- Implement the `backlog gui` command in the CLI to launch the packaged GUI application or guide download.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GUI can initialize a new Backlog.md project.
- [ ] #2 GUI can be packaged into distributable formats (.exe, .dmg, .AppImage).
- [ ] #3 `backlog gui` command in CLI successfully launches the GUI or provides download instructions.
<!-- AC:END -->
