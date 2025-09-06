---
id: task-200
title: Add Claude Code integration with workflow commands during init
status: To Do
assignee: []
created_date: '2025-07-23'
updated_date: '2025-09-06 21:22'
labels:
  - enhancement
  - developer-experience
dependencies:
  - task-24.1
  - task-208
priority: medium
---

## Description

Enable users to leverage Claude Code's custom commands feature by generating a .claude directory with pre-configured workflow prompts when running 'backlog init'. This will streamline common backlog.md workflows like parsing PRDs, planning tasks, managing branches, and conducting code reviews.

Based on contribution from PR #235: https://github.com/MrLesk/Backlog.md/pull/235

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Claude Code template files are stored in src/templates/claude/
- [ ] #2 backlog init copies .claude directory to user's project with workflow commands
- [ ] #3 Commands include: parse-prd, plan-task, suggest-next-task, daily-standup, finish-task, branch-status, cleanup-branches, milestone-review
- [ ] #4 Generated claude.yaml references local workflow markdown files correctly
- [ ] #5 Documentation updated to explain Claude Code integration
- [ ] #6 init command prompts user whether to include Claude Code integration (similar to agent instructions)
- [ ] #7 Init wizard asks user if they want to add Claude Code commands during setup
- [ ] #8 If .claude/claude.yaml already exists, merge new commands intelligently (append new commands, preserve existing ones)
<!-- AC:END -->
