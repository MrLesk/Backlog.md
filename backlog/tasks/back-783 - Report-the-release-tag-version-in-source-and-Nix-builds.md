---
id: BACK-783
title: Report the release tag version in source and Nix builds
status: Done
assignee:
  - '@codex-1118'
created_date: '2026-10-19T15:53:00Z'
updated_date: '2026-10-19T20:09:00Z'
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
- [x] #4 Tag preparation uses exact expected ref and commit checks; reruns cannot overwrite an unrelated tag update or create repeated version-bump commits.
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
1. Integrate main 3b22973b and keep package.json as the only version authority.
2. In the original new-tag push run, prepare a detached version-only commit from the selected source; update that tag with its exact original object as the lease. Do not change historical tags or main during preparation.
3. Dispatch the same release.yml at the prepared tag with its expected commit. Scope actions:write to preparation only. In the fresh run, verify the event commit, selected tag and package version agree before existing builds and publication run. Never replace GitHub identity variables.
4. Retain the full existing platform build/publish/check matrix and final sync-version-to-main behavior.
5. Exercise extracted workflow scripts in disposable local Git repositories, including selected-source preservation, annotated/lightweight tags, stale refs, reruns and dispatch identity checks. Verify source/archive and build versions, run existing checks, review simplification, and freeze diff/hashes for root architecture review before finalization or production commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approved system: Alex approved moving only a newly created future release tag once to its package.json version-bump commit before building, plus the same-workflow fresh run and preparation-job actions:write needed for accurate npm provenance. Package.json remains the version authority. Historical tags are not repaired or moved.

The initial new-tag push run checks the exact tag object against event.after and its peeled commit against the original event commit, makes a detached version-only child of that selected source, and updates the tag with an exact-object force-with-lease. The replacement ref points directly to the prepared commit. If package.json already matches, no commit or ref change is made. An original-run rerun after tag movement is rejected before another bump or dispatch.

Preparation dispatches release.yml at the prepared tag with required prepared_commit input. The fresh run checks the event commit, remote tag, checked-out commit and package version before building. Source jobs pin the natural github.sha. No built-in GitHub identity variable is replaced. npm 11.6.0 provenance uses GITHUB_SHA, so the fresh event identifies the source commit used by the builds. The existing build/publish/verification matrices and final sync-version-to-main job are unchanged outside the approved source preparation and pinned checkouts.

Baseline evidence: v1.54.0 points to 2225c4167234fd300b477cc3207689c8454abed1 with package.json 1.53.0. Both source and bundled CLI reproduce 1.53.0. Release run 38922555163 and sync-version job 117052226991 succeeded; main bump 3d975296 was correct. The defect was tagged source, not failed npm publication or a failed main sync.

Focused proof: all seven groups in /private/tmp/back-783-release-proof-qdctxueq/results.json pass using the actual extracted workflow scripts and disposable local Git remotes; only gh dispatch is stubbed. They cover lightweight and annotated original tags, a version-only child of the selected tree, later main code excluded and unchanged, exact dispatch ref/input, correct source/archive versions, original-run rerun rejection, same-commit tag-object replacement rejection, a tag race between fetch and push rejected by the lease, fresh-run identity/branch/tag-race checks, and matching-version no-op behavior. Commands and output are in that directory/commands.log.

Full-source proof in /private/tmp/back-783-source-proof-86f11lop/results.json: simulated future v1.55.0 changes only package.json from the selected tree. The updated remote tag archive contains no .git directory and reports 1.55.0 through direct source, compiled executable and the unchanged Nix-style bundle command. Explicit build override reports 9.8.7. Ordinary development and the normal compiled build still report package.json 1.54.0. Commands and output are in that directory/commands.log.

Existing checks pass: bun run check:types, bun run check ., bun run build, and git diff --check. actionlint 1.7.12 reports the same four unsupported baseline background/wait extension diagnostics on both main and this change. A temporary copy with only those existing unsupported features removed passes actionlint; existing matrix and job content comparison also passes. Normal PR CI will run the established application test profile; no full local suite was added for this workflow change.

Limitations: no local Nix executable, real GitHub dispatch, release publication, remote tag movement or OIDC signing was exercised. The Nix derivation itself is unchanged and still derives its version from package.json. Official GitHub docs confirm dispatch selects a new event commit and is allowed from GITHUB_TOKEN; the required Actions write permission is scoped only to preparation. No recovery framework or Git/archive version resolver was added.

Subtraction review: production scope is one existing workflow file; there are no new helpers, dependencies, runtime changes, version fallbacks or permanent metadata tests. The branch includes main 3b22973bbae3cf5ee129d36848896a1fae204250. Architecture review returned KEEP: no supported defect, required change or worthwhile task-scoped simplification. The reviewed workflow SHA-256 is 0564e0197d3e7760edb45a8f1b0045f68180b9fc0d7616f4b258dbc778178785. Root approved finalization and publication of the feature branch after this review. All criteria are verified by the recorded local behavior proofs, unchanged Nix version authority and official provenance/dispatch source evidence, with the live-system limits above retained.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Future releases now prepare a version-only commit from the selected release source, move only the newly created tag with exact-object checks, and start the same workflow at that commit so source/Nix version authority and npm provenance agree. Existing platform gates, explicit build overrides and final main sync are preserved. Seven local Git proof groups, full-source archive/compiled/bundle and override checks, types, Biome and the normal build pass. Architecture review kept the implementation unchanged. Nix derivation execution and real GitHub dispatch/OIDC/publication remain untested locally; historical tags were not changed.
<!-- SECTION:FINAL_SUMMARY:END -->
