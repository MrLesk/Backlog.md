---
id: BACK-767
title: Run independent GitHub Actions steps in parallel
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 20:16'
updated_date: '2026-10-15 20:41'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1111'
  - >-
    https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel/
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .github/workflows/architecture.yml
modified_files:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .github/workflows/architecture.yml
priority: low
type: chore
ordinal: 387000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI, release, and architecture jobs spend time waiting for independent steps to finish. Use GitHub Actions parallel steps to shorten those waits while preserving the existing checks and publishing gates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CI runs independent checks concurrently after installation and finishes them before integration tests.
- [x] #2 Release package checks and preparation overlap independent work while all verification and dry-run gates still block publication on failure.
- [x] #3 Architecture export and comparison artifact download can overlap without exposing generated files to source scanning or changing publication and comment gates.
- [x] #4 All three workflows pass relevant local validation and the PR records any hosted validation limitations.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Group the Nix lock check, type check, lint check, and CLI bundle in CI after installation; keep tests after the group.
2. Run release installability and metadata checks together. Start platform artifact download in the background while Node and npm are configured, then wait before packaging.
3. Run architecture export and comparison artifact download together, using one runner temporary site root with separate architecture/ and comparison/ subdirectories outside the source scan.
4. Parse all workflows, verify platform conditions and dependency/failure gates, run relevant project checks, simplify the diff, then commit and create the linked PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Simplified release verification to background the Unix installability check and wait for all checks at the end, preserving the long scripts and platform conditions with a small diff.

Validation: Bun parsed all three YAML workflows. A before/after structural audit confirmed all original step commands, actions, inputs and platform conditions are preserved, along with triggers, permissions, matrices and job dependencies. Explicit checks confirmed waits before integration tests, package preparation and publication, and one temporary architecture site root. All 39 Bash run scripts passed bash -n.
bun run check . passed (438 files), bun run check:types passed (541 files), and scoped packaging/resolver tests passed (21 tests).
Released actionlint 1.7.12 does not support parallel/background/wait syntax (upstream parser PR #694 is open), so it was not used as a schema validator. The PR CI run will validate the updated CI workflow on GitHub. Release and the revised architecture deployment are not manually dispatched as part of this change.

Rebuilt the PR on main at b819e8bf, which contains the merged BACK-732 change (#1099). The branch now contains only BACK-767: the three workflow files and this task. Original PR CI and CodeQL checks all passed before this base correction; workflow YAML parsing and git diff --check pass again on the clean base.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Independent CI checks now share a parallel group. Release downloads overlap Node/npm setup, and Unix installability checks overlap Linux metadata checks with explicit waits before downstream work. Architecture export and comparison download share a parallel group under runner.temp, keeping generated HTML outside the source scan. Existing commands, platform selection, permissions and publishing gates are preserved. YAML and dependency audits, 39 Bash syntax checks, Biome, type checking and 21 scoped tests pass. Hosted CI results will be recorded on the PR; release and revised architecture deployment remain for their normal triggers.
<!-- SECTION:FINAL_SUMMARY:END -->
