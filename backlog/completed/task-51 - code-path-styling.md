---
id: task-51
title: Code-path styling
status: Done
assignee: []
created_date: '2025-06-11'
updated_date: '2025-06-13'
labels:
  - enhancement
dependencies: []
---

## Description

Goal: Make file paths stand out and easier to scan.

Detailed work:
- In the markdown transform, detect back-ticked paths like \.
- Render them dim grey and place each on its own line if not already isolated.

## Acceptance Criteria
- [x] Regex captures 100% of code paths in test fixture.
- [x] Visual diff shows dim-grey paths, separated from surrounding prose.
