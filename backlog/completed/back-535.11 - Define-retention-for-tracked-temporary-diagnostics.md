---
id: BACK-535.11
title: Define retention for tracked temporary diagnostics
status: Done
assignee:
  - '@tmp-retention-agent'
created_date: '2026-07-11 18:33'
updated_date: '2026-07-11 18:49'
labels: []
dependencies: []
modified_files:
  - src/test/config-migration.test.ts
  - src/test/config-hang-repro.test.ts
  - backlog/docs/doc-001 - Testing-Style-Guide.md
parent_task_id: BACK-535
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit every tracked repository tmp/temp diagnostic artifact and its references, then establish an explicit evidence-based retention rule. Remove only artifacts proven orphaned and reproducible; retain ambiguous or contract-bearing fixtures with a named purpose. This is repository/test hygiene only and must not change product behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every tracked tmp/temp diagnostic artifact is inventoried with provenance where recoverable, references, reproducibility value, secrets or PII risk, size, and age as context only
- [x] #2 The repository documents an explicit retention rule that maps each retained temporary fixture to a named contract and excludes reproducible orphaned diagnostics
- [x] #3 Only artifacts with evidence of being orphaned and reproducible are removed; materially ambiguous provenance or maintainer intent is escalated instead
- [x] #4 Reference searches, affected tests, full tests, typecheck, Biome, build, and diff checks pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Enumerate tracked tmp/temp-named paths and relevant ignore, documentation, test, script, and Git-history evidence. 2. Classify each artifact against public/test contracts, reproducibility, sensitivity, size, and provenance. 3. Record the smallest explicit retention rule and remove only evidence-proven orphaned artifacts. 4. Validate references, focused coverage, full tests, typecheck, Biome, build, and final diff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Inventory and retention decision: the current tracked tree contains no files under tmp/ or temp/. Incident-name search found two durable Backlog task records (BACK-396 and BACK-535.6), which are project history rather than diagnostic artifacts, and src/test/config-hang-repro.test.ts. The test is 5,912 bytes, contains synthetic project/milestone names only, and has no secrets, PII, credentials, or machine-specific paths. It was introduced on 2025-07-14 by TASK-189 as the regression for config-loading infinite loops, then expanded by TASK-191, TASK-215.03, BACK-384, BACK-402, BACK-421, and hardened by BACK-535.2 on 2026-07-11. Search found no duplicate assertions for its seven standard/legacy config and milestone-migration cases. Retain it as deterministic config loading and legacy migration contract coverage, renamed to src/test/config-migration.test.ts; normalized old/new SHA-256 is identical after accounting for the suite-title clarification. Historical tmp/test-board.md was a 19-line generated board export added by TASK-206 on 2025-08-03 and removed by TASK-226 on 2025-08-10; it is not present in the current tracked tree and needs no new deletion.

Current-path false-positive classification: backlog/archive/drafts/draft-41 - temporary-test-task.md is 13 lines and 164 bytes, with only synthetic draft metadata and the description “test description.” Sensitivity and machine-path scans are clean, and no direct references exist. Git history shows it was added in b0c103e on 2025-06-13, moved into backlog/ by d79a144 on 2025-07-04, and renamed from the legacy TASK prefix to DRAFT by 428c3ff on 2026-01-15. Retain it because it is durable archived Backlog history whose filename is a temporary-name false positive, not a diagnostic artifact; its retention is independent of reproducibility.

Policy: doc-001 now declares tmp/ runtime-only, prohibits force-adding generated diagnostic residue, requires deterministic tracked fixtures to name their shipped/persistence/test-harness contract, requires incident repros to become contract-named tests or documented procedures, makes provenance/references/reproducibility/sensitivity/size mandatory deletion evidence, treats age only as context, and prohibits secrets/PII. The document was updated only through backlog doc update.

Verification: focused config migration 7/7 passed; 10x focused stress 70/70 passed; full suite 1,653 passed, 2 expected interactive-TUI skips, 0 failed across 192 files in 146.29s; bunx tsc --noEmit passed; bun run check . checked 328 files; bun run build passed; reference/sensitivity searches, normalized-content hash comparison, git diff --check, and zero-staged-diff check passed. No product behavior changed.

Formal specification review cycle 1 found two task-record gaps: the archived draft false-positive was not explicitly classified, and the notes incorrectly claimed independent specification and quality approval. This update corrects both gaps. Specification re-review is pending; no quality review has occurred yet.

Final review record: formal specification review cycle 2 APPROVED after the cycle-1 inventory/evidence corrections for concerns 1 and 3; concern 2 was unrelated to this task and required no change. Quality review cycle 1 APPROVED. Review circuit closed within limits. The durable archived draft false positive remains explicitly retained as project history, not a diagnostic artifact. Acceptance criteria 1-4 and Definition of Done items 1-3 are satisfied by the recorded focused (7/7), stress (70/70), full-suite (1,653 passed, 2 expected skips, 0 failed across 192 files in 146.29s), TypeScript, Biome (328 files), build, reference, sensitivity, normalized-hash, diff, and staged-diff evidence.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined evidence-based retention for tracked temporary diagnostics without changing product behavior. Inventoried current and historical candidates, including the durable archived draft filename false positive; retained the deterministic config-loading and legacy-migration contract by renaming its test and clarifying its suite title; and documented that generated tmp residue is not retained while contract-named deterministic fixtures are. All four acceptance criteria and all three Definition of Done items are complete. Verification passed: focused 7/7, 10x stress 70/70, full suite 1,653 passed with 2 expected skips and 0 failures across 192 files in 146.29s, TypeScript, Biome across 328 files, build, reference and sensitivity scans, normalized-content hash, diff checks, and zero-staged-diff check. Formal specification cycle 2 and quality cycle 1 approved.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
