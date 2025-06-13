---
id: task-45
title: Safe line-wrapping
status: Done
assignee: []
created_date: '2025-06-11'
updated_date: '2025-06-13'
labels:
  - enhancement
dependencies: []
---

## Description

Goal: Prevent mid-word breaks and over-wide lines.

Detailed work:
- Set wrap:true and width:\100%\ on every prose box.
- Introduce a global config wrapLimit = 72.

## Acceptance Criteria
- [ ] Automated test shows no rendered line exceeds 72 chars.
- [ ] Manual resize to 60 cols shows clean wrapping, no split words.
