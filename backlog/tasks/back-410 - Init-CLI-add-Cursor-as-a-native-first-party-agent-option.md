---
id: BACK-410
title: 'Init: keep Cursor on AGENTS.md and remove obsolete rule artifacts'
status: Done
assignee:
  - '@codex'
created_date: '2026-03-25 18:13'
updated_date: '2026-07-17 06:59'
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
modified_files:
  - CLI-INSTRUCTIONS.md
  - README.md
  - src/agent-instructions.ts
  - src/cli.ts
  - src/guidelines/index.ts
  - src/test/cli-init-create.test.ts
  - src/test/cli-init-cursor-pty.test.ts
  - src/test/web-initialization-cursor.test.tsx
  - src/web/components/InitializationScreen.tsx
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Treat Cursor as a first-class Backlog init choice through the shared AGENTS.md instruction target. The `cursor` non-interactive alias, CLI wizard labels, agents update flow, and Web initialization must consistently direct Cursor users to AGENTS.md. Remove only obsolete Backlog-owned Cursor rule templates or references. Do not inspect, migrate, delete, or overwrite unrelated user-managed `.cursor/rules` content, and preserve existing AGENTS.md content and idempotent Backlog marker updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI initialization accepts `--agent-instructions cursor` and maps it to AGENTS.md, while interactive CLI and agents-update selections identify Cursor under AGENTS.md
- [x] #2 Web initialization identifies AGENTS.md as the Cursor instruction file and sends that shared target to the init API
- [x] #3 Cursor selection creates or updates AGENTS.md and does not create `.cursor/rules`, `.cursorrules`, or another Cursor-specific Backlog instruction file
- [x] #4 Existing AGENTS.md content is preserved and repeated initialization keeps one current Backlog marker block
- [x] #5 Combined Cursor and other agent selections create each shared instruction target once without changing the behavior of Claude, Gemini, Copilot, MCP setup, or skip options
- [x] #6 Documentation and public init help explain that Cursor uses AGENTS.md and that unrelated user-managed Cursor rules may coexist without implicit migration or removal
- [x] #7 Focused real CLI tests cover non-interactive Cursor selection, combined selections, repeated init, and a PTY run that completes without opening an editor; focused Web coverage verifies the Cursor selector copy and AGENTS.md target
- [x] #8 Obsolete Backlog-owned Cursor rule templates and references are removed without deleting ambiguous or user-owned Cursor content
- [x] #9 Relevant focused and full tests, `bunx tsc --noEmit`, `bun run check .`, and `bun run build` pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove only dead Backlog-owned Cursor-specific guideline exports and marker branches; leave user Cursor rule paths untouched.
2. Keep the existing cursor-to-AGENTS.md mappings across CLI and Web init, and document the shared target plus coexistence with user-managed Cursor rules.
3. Add real CLI, PTY, idempotency, combined-selection, and Web selector coverage, then run focused and repository-wide verification before finalizing the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the unused Backlog-owned CURSOR_GUIDELINES export and the dead .cursorrules marker/version branches. Kept the existing cursor alias and Web selector mapped to AGENTS.md. Updated public help and docs to state that user-managed .cursor/rules files may coexist and are not migrated or removed. Added real CLI coverage for existing AGENTS.md preservation, repeated init, combined selections, shared-target deduplication, and absence of Backlog Cursor rule output; added a PTY no-editor test and focused Web selector/payload coverage.

Ownership review: origin/main contained no tracked .cursor/rules or .cursorrules files or templates, so no Cursor rule file was deleted. Tests prove a user-owned .cursor/rules/team-owned.mdc file remains byte-for-byte unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cursor remains a first-class init choice through the shared AGENTS.md target in CLI and Web flows. Obsolete Backlog-owned Cursor guideline and marker code was removed, while user-managed Cursor rules and existing AGENTS.md content remain untouched.

Verification: focused tests 46 passed with 222 assertions; opt-in PTY test 1 passed with 4 assertions; full bun test 1725 passed, 5 skipped, 0 failed with 7315 assertions across 199 files; bunx tsc --noEmit passed; bun run check . passed; bun run build passed; git diff --check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
