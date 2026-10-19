---
id: BACK-783
title: Report the release tag version in source and Nix builds
status: In Progress
assignee:
  - '@codex-1118'
created_date: '2026-10-19T15:53:00Z'
updated_date: '2026-10-19T15:59:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1118'
  - scripts/build.ts
  - flake.nix
  - src/utils/version.ts
  - .github/workflows/release.yml
type: bug
ordinal: 393000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1118 reports that v1.54.0 source and Nix builds show 1.53.0. Alex creates releases in GitHub Releases, which creates the tag; the release pipeline then syncs package.json to main. Keep that release flow and make tagged-source version reporting correct without moving existing tags.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A build from a release tag vX.Y.Z reports X.Y.Z even when package.json at that commit holds the previous release version.
- [ ] #2 The repository Nix package version and its CLI output agree with the selected release tag.
- [ ] #3 An explicit BACKLOG_BUILD_VERSION override and ordinary main development builds keep their current behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the tagged-source failure and current release behavior.
2. Present the smallest supported version-authority choices and their limits to Alex before production edits.
3. Implement only the approved narrow choice while preserving explicit build overrides and untagged development behavior.
4. Verify source and Nix behavior for the approved scope, run existing checks, review simplification, then freeze the diff and hashes for architecture review before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research 2026-10-19: v1.54.0 points to 2225c4167234fd300b477cc3207689c8454abed1 with package.json 1.53.0. A clean source archive in /private/tmp/back-783-tag-baseline-mbwlqir5 reproduces 1.53.0 through both bun src/cli.ts --version and a bundled CLI. Release run 38922555163 succeeded, including sync-version job 117052226991, and commit 3d975296a52c81d9fda580d916c5350e3fe7e105 correctly bumped main to 1.54.0 afterward.

A local archive-marker fixture at /private/tmp/back-783-archive-proof-jzsvzo2_/proof-results.json proves an exact release tag can be expanded in git archives, while later development archives contain a distance suffix and can keep the package.json fallback. Real GitHub tag and matching commit archives for pypa/setuptools-scm commit fa5c2319fef46bea5e387e1329245e7eaffa6f1e both expand the tag marker. Nix GitHub fetcher source resolves the requested ref, removes it from source metadata, and downloads the commit archive. Modern Git/local Nix fetchers do not expand export-subst, so an archive-marker design alone does not fix nix build . in a normal local tagged checkout. The same commit archive changes when a release tag is later attached, which can invalidate pre-tag source hashes. Nix is not installed locally.

No production files changed. Waiting for the release/version-authority decision; historical tags remain untouched.

Decision pending with Alex: Option A keeps package.json as the only version authority for future releases by creating the bump commit after GitHub creates the release/tag, then retargeting only that new tag before builds. This requires explicit approval of tag movement, build dependencies, and how to keep the original selected release tree if main advances. Option B keeps tags fixed and infers exact tag versions from Git/archive metadata, with the local-Nix coverage and archive-hash limits above. No option is approved yet. Historical tags must remain untouched. This branch is a task-only research checkpoint; task acceptance criteria and completion checks remain open, and implementation must wait for the decision.
<!-- SECTION:NOTES:END -->
