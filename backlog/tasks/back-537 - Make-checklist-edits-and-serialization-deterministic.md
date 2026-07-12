---
id: BACK-537
title: Make checklist edits and serialization deterministic
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 23:02'
updated_date: '2026-07-12 12:16'
labels: []
dependencies: []
priority: high
ordinal: 185000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Acceptance-criteria replacement currently appends only the final repeated value, and repeated checklist edits can reorder structured sections or accumulate blank lines. Make the canonical CLI contract and shared Markdown checklist serialization deterministic for acceptance criteria and Definition of Done while preserving line endings and unrelated sections.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `--ac` remains additive and repeatable, while repeated `--acceptance-criteria` values atomically replace the complete acceptance-criteria checklist without splitting commas.
- [x] #2 The CLI provides an explicit clear-all acceptance-criteria operation and rejects ambiguous combinations of replacement or clearing with incremental checklist mutations.
- [x] #3 Removing and re-adding a checklist preserves canonical structured-section order with exactly one blank line between sections and no orphan whitespace.
- [x] #4 Repeated checklist set, add, remove, check, uncheck, and clear cycles are byte-stable aside from the intended semantic change, including files with custom sections and CRLF line endings.
- [x] #5 Shared checklist serialization provides analogous deterministic behavior for Definition of Done where the same mutation path applies.
- [x] #6 Regression tests cover replacement, commas, additive edits, clear-all, canonical reinsertion, whitespace stability, surrounding sections, Definition of Done, and CRLF preservation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep --ac additive; wire repeated --acceptance-criteria to atomic replacement, add --clear-ac, preserve commas, and reject ambiguous replacement/clear combinations with incremental mutations.
2. Normalize to LF once, tokenize known Backlog sentinel families, mask balanced foreign ranges, and strictly resolve visible AC/DoD target markers.
3. Route checklist parse, discovery, replacement, composition, anchors, and migration through the shared resolver while preserving masked foreign bytes.
4. Unify zero-item and nonzero rewrites: compose the existing body with an empty queue, remove visible checkbox rows, preserve all non-checkbox residual content in place, retain a canonical marked shell when residual content remains, and remove only whitespace-only shells.
5. Canonicalize only section-boundary blank lines, preserve residual interior bytes and CRLF, keep duplicate consolidation, and prove deterministic AC/DoD clear and re-add cycles with cross-target isolation.
6. Run exact focused and adjacent regression suites, the full suite on final bytes, TypeScript, Biome, build, diff checks, and simplification review before fresh independent review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented strict shared AC/DoD marker resolution with actionable failures for malformed or ambiguous structures; wired repeatable atomic acceptance-criteria replacement and explicit clear-all while retaining additive --ac semantics; canonicalized checklist placement and boundary whitespace without altering custom content or line endings.

Verification on the reviewed implementation: focused acceptance-criteria and Markdown serializer regressions, full Bun test suite, TypeScript, Biome, production build, and independent specification and quality reviews passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made acceptance-criteria editing deterministic: replacement, additive, clear, and conflict behavior now have explicit CLI semantics, while shared AC/DoD serialization preserves canonical section order, custom content, stable whitespace, and CRLF. Malformed or ambiguous checklist markers fail without writing and explain how to repair the task. Verified with focused and full tests, type checking, Biome, build, and independent reviews.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
