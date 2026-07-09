---
id: BACK-529
title: Sort browser label filters alphabetically
status: Done
assignee:
  - '@codex'
created_date: '2026-07-09 06:09'
updated_date: '2026-07-09 20:53'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/733'
modified_files:
  - src/utils/label-filter.ts
  - src/test/label-filter.test.ts
  - src/test/web-task-list-labels-menu.test.tsx
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #733 reports that the Web UI All Tasks Labels dropdown shows labels in creation/configuration order rather than alphabetical order. The browser label filter menu should present labels lexicographically so users can scan and select labels predictably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The All Tasks Labels dropdown renders available labels in alphabetical/lexicographic order regardless of task creation order.
- [x] #2 Label sorting is case-insensitive and deterministic for configured labels and labels discovered from tasks.
- [x] #3 A Web UI regression test covers unordered input labels rendering alphabetically in the Labels dropdown.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review the shared label collector, its callers, existing tests, and nearby deterministic string-ordering conventions.
2. Replace locale-sensitive label ordering with locale-independent normalized sort keys and a final raw code-unit tie-breaker while preserving case-insensitive de-duplication and first-seen spelling.
3. Add focused utility tests for accented cross-locale ordering and reversed NFC/NFD input, retaining the existing Web regression coverage.
4. Run focused label/Web tests, TypeScript, Biome, and build; do not run the full suite from the live worktree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced issue #733 with a focused TaskList Web UI test: before the fix, the Labels dropdown rendered zeta before Alpha because available labels preserved insertion order. Updated collectAvailableLabels to sort de-duplicated labels case-insensitively while preserving first-seen casing. Validation passed: bun test src/test/web-task-list-labels-menu.test.tsx src/test/label-filter.test.ts; bunx tsc --noEmit; bun run check .; bun test (1447 pass, 2 skip, 0 fail).

Reopened to address the confirmed review gap: label ordering must be independent of host locale and input order for canonically equivalent Unicode forms. Full bun test is intentionally excluded in this live worktree because of the known destructive worktree-test interaction.

Replaced the host-default Intl.Collator and localeCompare ordering with locale-independent UTF-16 code-unit comparison over lowercase NFD sort keys, followed by the original label as a raw code-unit tie-breaker. Case-insensitive de-duplication and first-seen spelling remain unchanged.

Added focused coverage for accented ordering across locale expectations, reversed NFC/NFD inputs, and first-seen casing. Validation passed: bun test src/test/label-filter.test.ts src/test/web-task-list-labels-menu.test.tsx (12 pass); label utility tests also passed under en_US.UTF-8 and sv_SE.UTF-8; bunx tsc --noEmit; bun run check .; bun run build. The full suite was not run from this live worktree because of the reported destructive worktree-test interaction; GitHub CI will run the full matrix after push.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made browser label ordering deterministic across host locales and input order by sorting on lowercase NFD keys with a raw code-unit tie-breaker, while preserving case-insensitive de-duplication and first-seen spelling. Added accented and NFC/NFD regression coverage; focused label/Web tests, TypeScript, Biome, and build pass. The full suite is delegated to GitHub CI because it is unsafe in the live worktree.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
