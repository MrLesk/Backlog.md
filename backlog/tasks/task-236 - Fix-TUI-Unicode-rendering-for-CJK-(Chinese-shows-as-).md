---
id: task-236
title: Fix TUI Unicode rendering for CJK (Chinese shows as ?)
status: In Progress
assignee:
  - '@codex'
created_date: '2025-08-17 16:30'
updated_date: '2025-08-26 18:29'
labels:
  - tui
  - bug
  - unicode
dependencies: []
priority: high
---

## Description

Chinese characters are rendered as question marks in the terminal board view (see GitHub issue #283). This is likely due to Blessed not being configured for full Unicode width handling.\n\nApproach:\n- Enable Blessed's full Unicode support on all TUI screens (fullUnicode: true in createScreen).\n- Verify rendering in board and task list/detail views.\n- Ensure no code path replaces non-ASCII with fallback characters.\n\nRepro (pre-fix):\n1) backlog task create "测试中文" --plain\n2) backlog board\nExpected: characters display correctly, not as question marks.
## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Set fullUnicode: true in the TUI screen factory and apply consistently
- [ ] #2 Verify Chinese titles render correctly in board and task list/detail (macOS Terminal/iTerm2)
- [ ] #3 No replacement of non-ASCII characters in code (titles are passed through unchanged)
- [ ] #4 Manual repro steps succeed: "测试中文" shows correctly in backlog board
<!-- AC:END -->

## Implementation Plan

Enable Blessed's full Unicode support on all TUI screens (fullUnicode: true in createScreen).\nVerify rendering in board and task list/detail views.\nEnsure no code path replaces non-ASCII with fallback characters.
