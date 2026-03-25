---
id: BACK-44
title: Checklist alignment
status: Done
assignee: []
created_date: '2025-06-11'
updated_date: '2025-06-13'
labels:
  - ui
  - enhancement
dependencies: []
---

## Description

Goal: Make checkbox lists flush-left and tidy.

Detailed work:
- During markdown-to-UI transform, replace "- [x] " / "- [ ] " with " [x] " / " [ ] " (or another padding scheme you prefer)

## Acceptance Criteria

- [x] All checklist lines start at the same column (snapshot diff)
- [x] Regex unit test passes for both checked and unchecked cases
