---
id: BACK-491
title: >-
  Cross-Modality CI — enforce feature parity across CLI / TUI / WebUI / MCP /
  REST
status: To Do
assignee: []
created_date: '2026-05-13 10:14'
updated_date: '2026-05-17 20:27'
labels:
  - ci
  - testing
  - engineering-consistency
  - cli
  - tui
  - web-ui
  - mcp
  - rest-api
milestone: m-13
dependencies: []
priority: high
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

Features have shipped in some access modalities but not others, generating upstream review comments. This task prevents that systematically by: updating the project Definition of Done, adding integration test infrastructure that verifies behavioral parity, and optionally creating a Claude skill for automated modality-coverage review.

**The 5 access modalities** that every feature must cover (or explicitly justify N/A):
1. CLI (`backlog` commands)
2. TUI (terminal UI)
3. WebUI (browser, `src/server/`)
4. MCP (MCP tool definitions)
5. REST API (`src/server/index.ts` HTTP endpoints)

**Why this matters**: In a prior implementation, access modalities were missed, generating upstream review comments and requiring follow-up PRs. The DoD and CI must catch this before code review, not after.

**Claude skill** (optional but strongly preferred): A skill file that, when invoked during code review or implementation, reads staged/changed files and flags any access modality that appears to be missing coverage for the changed feature. Skill should be invokable via `/modality-check` or equivalent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DoD updated: `backlog/config.yml` `definition_of_done` gains item: 'Feature implemented (or explicitly N/A with justification) in CLI, TUI, WebUI, MCP, and REST'
- [ ] #2 CLAUDE.md gains a 'Cross-Modality Checklist' section listing the 5 access surfaces, what 'implemented' means for each, and when N/A is acceptable
- [ ] #3 Integration test suite added (e.g. `src/__tests__/modality-parity.test.ts`) exercising a reference feature (label filtering recommended) identically through CLI execution, HTTP API call, and MCP handler invocation — asserting identical result sets
- [ ] #4 Test pattern/template documented (inline comment or `docs/` file) so contributors know how to add parity tests for new features
- [ ] #5 CI step runs parity tests on every PR (add to existing test run or separate workflow step)
- [ ] #6 Claude skill file created at `.codex/skills/modality-parity-check.md` (or `.claude/skills/`) that reviews changed files and flags missing modality coverage; instructions for when to invoke it added to CLAUDE.md
- [ ] #7 All 5 modalities named explicitly in the skill prompt so it cannot miss one by accident
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
