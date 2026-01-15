---
id: BACK-365
title: Fix acceptance criteria insertion adding blank lines
status: To Do
assignee: []
created_date: '2026-01-15 21:42'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users report that adding a new acceptance criteria always inserts an empty line above it, creating unintended blank lines between criteria groups. The acceptance criteria list should preserve intentional spacing only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adding a new acceptance criteria does not insert an extra empty line above the new entry.
- [ ] #2 Existing acceptance criteria lists remain unchanged unless the user explicitly adds blank lines.
- [ ] #3 Adding multiple acceptance criteria in sequence results in a contiguous list without blank lines by default.
<!-- AC:END -->
