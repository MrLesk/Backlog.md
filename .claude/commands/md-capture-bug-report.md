# Capture Bug Report

Creates a new task for a bug report.

## Parameters
- `bug_summary`: Summary of the bug
- `steps_to_reproduce`: Steps to reproduce the bug
- `priority`: Priority level
- `labels`: Additional labels for the bug

## Prompt

A user has reported a bug. Create a new task for this bug report.

**Bug Summary:** "{{.bug_summary}}"
**Steps to Reproduce:** "{{.steps_to_reproduce}}"
**Priority:** "{{.priority}}"
**Labels:** "bug, {{.labels}}"

Use the `backlog task create` command. Set the priority and labels accordingly. The description should contain the steps to reproduce.