---
id: BACK-34
title: Split README.md for users and contributors
status: Done
assignee:
  - "@codex"
created_date: '2025-06-09'
labels:
  - docs
dependencies: []
---

## Description

Split the current README.md into two separate files: one focused on how to use the Backlog.md CLI, and another covering how to run the project locally for contributors.

## Acceptance Criteria
- [x] README for users explains how to install and use Backlog.md CLI
- [x] Separate documentation describes how to run the project locally for contributors
- [x] Both docs link to each other from the repository root
- [x] Task committed to repository

## Implementation Notes
- Created `DEVELOPMENT.md` with instructions for running and testing the project locally.
- Removed development sections from `README.md` and added a link to the new document.
- Added reciprocal link back to `README.md` from `DEVELOPMENT.md`.
