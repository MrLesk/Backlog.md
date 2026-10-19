---
id: BACK-783
title: Report the release tag version in source and Nix builds
status: Done
assignee:
  - '@codex-1118'
created_date: '2026-10-19T15:53:00Z'
updated_date: '2026-10-19T21:33:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1118'
  - scripts/build.ts
  - flake.nix
  - src/utils/version.ts
  - .github/workflows/release.yml
modified_files:
  - .github/workflows/release.yml
type: bug
ordinal: 393000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1118 reports that v1.54.0 source and Nix builds show 1.53.0. Alex creates releases in GitHub Releases, which creates the tag. Alex approved changing future releases so the pipeline creates the package.json version-bump commit, moves only that newly created tag once to that commit before builds, and keeps package.json as the version authority. Historical tags must remain untouched, and builds must retain the originally selected release code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 For future releases, the newly created vX.Y.Z tag points to the selected release tree plus only the package.json version change to X.Y.Z before any build.
- [x] #2 The repository Nix package version and source-built CLI output agree with the prepared release tag.
- [x] #3 An explicit BACKLOG_BUILD_VERSION override, ordinary main development builds, and existing platform publish and verification behavior remain intact.
- [x] #4 Tag preparation uses exact expected ref and commit checks. After a tag push succeeds and dispatch fails, the same run can retry dispatch of only its own prepared version-only child without another commit or tag push; unrelated moved tags remain rejected.
- [x] #5 Published provenance identifies the same prepared source commit used by the release builds.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the approved release-tag preparation and fresh-run provenance flow, platform matrices and final main sync unchanged.
2. Mark prepared commits with stable GITHUB_RUN_ID. Build the expected version-only tree from the original selected commit. On rerun, accept only a direct raw commit ref with that original sole parent, exact expected tree and same-run marker.
3. Keep the original expected-object check and lease for first preparation. Retry only dispatches the existing prepared SHA, leaving commits and tag refs unchanged; retain fresh-run expected-commit/tag/version checks.
4. Exercise the actual extracted shell against disposable local Git remotes with stubbed gh: failed dispatch then retry, wrong marker, parent, tree and tag object, plus prior race/no-op/source/override cases. Run relevant syntax, lint and build checks.
5. Review subtraction and freeze the repaired diff and hashes for root architecture review before finalization, commit or push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approved system: Alex approved moving only a newly created future release tag once to its package.json version-bump commit before building, followed by a fresh run of release.yml at that tag. Package.json remains the version authority; GitHub identity variables, existing platform matrices, preparation-only actions:write and final main sync are preserved. Historical tags remain unchanged.

Guarded retry repair: Alex approved resuming dispatch through Re-run jobs after the original tag push succeeded but dispatch failed (PR #1126 discussion_r4318426772). Preparation computes the exact expected source tree from the original selected commit and package version update, and creates the bump with a commit message containing stable GITHUB_RUN_ID. The original tag-object and selected-commit checks plus exact-object lease still control the first update.

A moved tag is accepted only when its raw object is the prepared commit itself, its sole parent is the original selected commit, its full tree exactly matches the expected non-empty version-only update, and its complete message matches the release tag and same run marker. This branch dispatches the existing prepared SHA without committing or pushing. Wrong markers, parent/tree changes, annotation wrappers and unrelated tag updates fail closed. An already matching package version still creates no commit or tag update. The fresh run retains its expected-commit, tag, checkout and version checks, so a later tag race is rejected.

Focused verification: all 19 actual-shell cases in /private/tmp/back-783-release-proof-kmz1nzni/retry-results.json pass. Only gh is stubbed; Git repositories and pushes are disposable local fixtures. The reported failure is reproduced with successful tag push and dispatch exit 75; same-run attempt 2 reaches dispatch at the exact same SHA with only one total commit and push. Both full and shallow checkouts pass. Negative cases cover a different run, wrong/missing marker, wrong/merge parent, extra source/package fields, package file mode, annotation replacement, and a non-produced empty child when the original version already matches. Previous selected-source, late-main exclusion, no-op, lease-race and fresh-run validation coverage is retained. Exact commands/output are in that proof directory/commands.log.

Full repaired-source proof in /private/tmp/back-783-source-proof-goe5ynef/results.json passes: the simulated future tag changes only package.json from 1.54.0 to 1.55.0, and an archive without .git reports 1.55.0 through source, compiled CLI and the unchanged Nix-style bundle command. Explicit override reports 9.8.7 and normal development/build reports 1.54.0. Commands/output are in that directory/commands.log.

Repair checks pass: bun run check ., bun run build, extracted shell bash -n, git diff --check, and actionlint 1.7.12 on a temporary copy without only the four unsupported existing background/wait extension entries. Raw actionlint still reports those same four baseline gaps. YAML comparison confirms that only the preparation shell changed from published head 58ae13ce; fresh-run jobs, permissions, matrices and final main sync are byte-equivalent in the parsed workflow. No full local application suite or permanent metadata tests were added. Initial types validation passed and TypeScript sources are unchanged.

Limitations: no local Nix derivation, real workflow dispatch, OIDC signing, release publication or remote release-tag update has been exercised. All tag mutation and dispatch-failure tests use local Git remotes and a stubbed gh. The existing CI profile and Nix gate remain in place.

Baseline context: v1.54.0 source contains package.json 1.53.0; both source and bundled CLI reproduce the wrong number, while the release and later main version sync succeeded. Initial implementation 58ae13ce received architecture KEEP and green CI. The resumed full-context review of the guarded retry also returned KEEP with no supported blocker, required change or advisory change. Its reviewed workflow SHA-256 is 109f4ff4dba794356cf8418a4a03e6b2dada1a81466336b4b1a050950be3d01b; the repair proof and source snapshot are frozen at /private/tmp/back-783-retry-review-2dd4ihnp. The previous frozen evidence at /private/tmp/back-783-review-eo69k9xb remains intact.

Subtraction review: production remains one existing workflow file, with shared expected-tree and message construction for first preparation and retry. No helper, dependency, artifact/API state store, broad retry loop, resolver or CI topology change was added. Both required architecture reviews are complete. The recorded 19-case, source/version/override, build, lint and syntax evidence supports the final criteria and Definition of Done, with the stated native Nix and live GitHub limitations retained. Root approved finalization and a normal feature-branch commit/push; no CI result for that new commit is claimed here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Future release tags now select a package.json version-only commit before source builds and a fresh release run, keeping source/Nix version authority and npm provenance aligned. A guarded same-run retry resumes dispatch at the existing prepared SHA without another commit or push, and rejects unrelated marker, parent, source-tree or tag-object changes. Existing publication checks, explicit overrides and final main sync remain intact. All 19 local shell cases, source/archive/compiled/bundle and override proofs, build, lint and syntax checks pass; both architecture reviews returned KEEP. Native Nix and live GitHub dispatch/OIDC/publication/tag updates remain untested locally.
<!-- SECTION:FINAL_SUMMARY:END -->
