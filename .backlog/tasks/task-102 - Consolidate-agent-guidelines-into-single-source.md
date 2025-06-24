---
id: task-102
title: Consolidate agent guidelines into single source
status: To Do
assignee: []
created_date: '2025-06-23'
labels: ["documentation"]
dependencies: []
---

## Description

Currently the repository maintains three separate files for agent instructions: `AGENTS.md`, `CLAUDE.md`, and `.cursorrules`. Keeping these in sync is cumbersome and risks divergence. Introduce a single canonical guideline file that is copied to the existing locations so agents can continue referencing the same filenames.

## Acceptance Criteria

- [ ] New canonical `AGENT_GUIDELINES.md` (name can vary) created as the single source of truth.
- [ ] Script or process copies this source to `AGENTS.md`, `CLAUDE.md`, and `.cursorrules` depending on what user selected during backlog init.
- [ ] Documentation updated to explain the new workflow.
- [ ] Content of the three final files matches the canonical source after the copy step.

## Implementation Plan

1. Add the canonical guideline file under `src/guidelines/`.
2. Implement a simple copy script (e.g., using Bun/Node) that duplicates this file to the three existing filenames.
3. Hook the script into the build or release workflow so guideline files stay up to date.
4. Remove duplicated text from the old files and replace them with the generated copies.
5. Update README and any references pointing to the old files.