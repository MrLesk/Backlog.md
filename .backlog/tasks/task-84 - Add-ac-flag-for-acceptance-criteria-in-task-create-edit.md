---
id: task-84
title: Add -ac flag for acceptance criteria in task create/edit
status: In Progress
assignee:
  - '@claude'
created_date: '2025-06-18'
updated_date: '2025-06-19'
labels:
  - enhancement
  - cli
dependencies: []
---

## Description

Add acceptance criteria flag support to task creation and editing commands. Include -ac flag and consider full --acceptance-criteria command option.

## Acceptance Criteria

- [ ] Add -ac flag to `backlog task create` command
- [ ] Add -ac flag to `backlog task edit` command  
- [ ] Consider implementing full --acceptance-criteria flag as alternative
- [ ] Acceptance criteria should be added as checkbox list in markdown
- [ ] Preserve existing -d (description) functionality
- [ ] Update help text for both create and edit commands
- [ ] Add tests for acceptance criteria flag functionality
- [ ] Handle multiple acceptance criteria items (comma-separated or multiple flags)
