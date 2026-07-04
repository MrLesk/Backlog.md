---
id: BACK-428
title: Document npx backlog.md usage
status: Done
assignee:
  - '@claude'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-04 13:51'
labels:
  - documentation
  - cli
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/566'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #566: clarify that one-off npm execution uses the backlog.md package name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README examples show the correct npx backlog.md command form where one-off execution is documented.
- [x] #2 Global install and direct backlog command examples remain clearly separated.
- [x] #3 Documentation checks or grep verification confirm no misleading npx backlog examples remain.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add npx one-off usage (npx backlog.md <command>) to README Getting started install section, kept separate from global-install examples. 2. Add a short npx note to CLI-INSTRUCTIONS.md. 3. Grep repo to confirm no misleading 'npx backlog' (without .md) examples remain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
README Getting started now has a GitHub TIP callout right after the install block explaining one-off npx usage requires the full package name (npx backlog.md init/board) and why bare npx backlog fails; global install examples untouched and clearly separated. CLI-INSTRUCTIONS.md intro now states all examples assume global install and shows npx backlog.md <command> for one-off runs. Grep verification: no 'npx backlog' (without .md) examples exist in user-facing docs; only historical completed-task records mention it, left untouched. Validation: bunx tsc --noEmit clean; biome check on src/scripts/*.json clean (305 files; note: 'bun run check .' scans 0 files inside .claude worktree paths due to gitignore-based VCS ignore, ran with explicit paths instead); scoped bun test documentation.test.ts 10/10 pass (doc-only change).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented one-off npx usage: README Getting started gains a TIP callout showing npx backlog.md <command> (full package name) and explaining that npx backlog fails because the npm package is backlog.md; CLI-INSTRUCTIONS.md intro notes examples assume a global install and gives the npx backlog.md form. Verified via grep that no misleading npx backlog examples remain in user docs. Doc-only change; tsc + biome clean, scoped test pass.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
