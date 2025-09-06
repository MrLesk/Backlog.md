---
id: task-254
title: 'Init: default ''No'' for Claude agent installation'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-04 19:53'
updated_date: '2025-09-06 13:34'
labels:
  - cli
  - init
  - agents
dependencies: []
priority: medium
---

## Description

Change `backlog init` to not add the Claude custom agent by default. The interactive confirm should default to No (pressing Enter = No). Non-interactive mode already defaults to false via `--install-claude-agent` flag.

Goal: Make Claude agent an explicit opt-in during initialization, with clear prompt copy and docs.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interactive init: Claude agent confirm defaults to No; pressing Enter does not install it.
- [x] #2 Prompt copy clarifies opt-in and target path: “Install Claude Code Backlog.md agent? (y/N) Adds to .claude/agents/”.
- [x] #3 Non-interactive: default remains false; `--install-claude-agent true` opts in explicitly.
- [x] #4 Update documentation/help to reflect the default change and the flag usage.
- [x] #5 Add/adjust a minimal test to assert the prompt initial value is false and flag parsing still works.
<!-- AC:END -->


## Implementation Plan

1. Change init prompt default to No
2. Update prompt copy per spec
3. Ensure non-interactive flag parsing unchanged
4. Add minimal test to ensure default=false and flag true works
5. Update docs/help text


## Implementation Notes

Implemented default "No" for Claude agent install in init.

- Interactive confirm uses initial:false with message "Install Claude Code Backlog.md agent? (y/N)" and hint "Adds to .claude/agents/ (opt-in)".
- Non-interactive keeps default false; flag `--install-claude-agent true` opts in.
- Tests: src/test/cli-init-claude-default.test.ts verifies default non-interactive behavior and flag true installs.
- Docs: README clarifies opt-in default and flag usage.
- Validation: bun test passes across suite locally; Biome check shows unrelated warnings.
