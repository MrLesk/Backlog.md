---
id: BACK-410
title: 'Init: keep Cursor on AGENTS.md and remove obsolete rule artifacts'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-25 18:13'
updated_date: '2026-08-01 22:03'
labels:
  - cli
  - init
  - agents
  - cursor
dependencies: []
references:
  - >-
    https://cursor.com/docs (verify current rules/skills paths when
    implementing)
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Treat Cursor as a first-class Backlog init choice through the shared `AGENTS.md` instruction target. The `cursor` non-interactive alias, CLI wizard labels, agents update flow, and Web initialization must consistently direct Cursor users to `AGENTS.md`. Remove only obsolete Backlog-owned Cursor rule templates or references. Do not inspect, migrate, delete, or overwrite unrelated user-managed `.cursor/rules` content, and preserve existing `AGENTS.md` content and idempotent Backlog marker updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI initialization accepts `--agent-instructions cursor` and maps it to `AGENTS.md`, while interactive CLI and agents-update selections identify Cursor under `AGENTS.md`
- [ ] #2 Web initialization identifies `AGENTS.md` as the Cursor instruction file and sends that shared target to the init API
- [ ] #3 Cursor selection creates or updates `AGENTS.md` and does not create `.cursor/rules`, `.cursorrules`, or another Cursor-specific Backlog instruction file
- [ ] #4 Existing `AGENTS.md` content is preserved and repeated initialization keeps one current Backlog marker block
- [ ] #5 Combined Cursor and other agent selections create each shared instruction target once without changing the behavior of Claude, Gemini, Copilot, MCP setup, or skip options
- [ ] #6 Documentation and public init help explain that Cursor uses `AGENTS.md` and that unrelated user-managed Cursor rules may coexist without implicit migration or removal
- [ ] #7 Focused real CLI tests cover non-interactive Cursor selection, combined selections, repeated init, and a PTY run that completes without opening an editor; focused Web coverage verifies the Cursor selector copy and `AGENTS.md` target
- [ ] #8 Obsolete Backlog-owned Cursor rule templates and references are removed without deleting ambiguous or user-owned Cursor content
- [ ] #9 Relevant focused and full tests, `bunx tsc --noEmit`, `bun run check .`, and `bun run build` pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove only dead Backlog-owned Cursor-specific guideline exports and marker branches; leave user Cursor rule paths untouched.
2. Keep the existing cursor-to-AGENTS.md mappings across CLI and Web init, and document the shared target plus coexistence with user-managed Cursor rules.
3. Add real CLI, PTY, idempotency, combined-selection, and Web selector coverage, then run focused and repository-wide verification before finalizing the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approved direction implemented by PR #799: Cursor remains mapped to the shared AGENTS.md target across CLI, agents-update, and Web initialization. The change removes only obsolete Backlog-owned Cursor guideline and marker code; user-managed `.cursor/rules` content is preserved and may coexist without migration or removal. Focused coverage verifies existing AGENTS.md preservation, repeated init, shared-target deduplication, non-creation of Backlog Cursor rule files, a PTY no-editor flow, and the Web selector payload.
<!-- SECTION:NOTES:END -->
