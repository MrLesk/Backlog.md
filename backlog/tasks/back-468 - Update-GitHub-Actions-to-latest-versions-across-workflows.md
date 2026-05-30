---
id: BACK-468
title: Update GitHub Actions to latest versions across workflows
status: Done
assignee:
  - '@claude'
created_date: '2026-05-30 18:32'
updated_date: '2026-05-30 18:35'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/26691062555'
modified_files:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .github/workflows/shai-hulud-check.yml
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The failed v1.45.2 release run annotated a deprecation warning: several actions run on Node.js 20, which GitHub is deprecating (forced to Node 24 by 2026-06-16; Node 20 removed 2026-09-16). Update all actions used across the three workflow files (.github/workflows/ci.yml, release.yml, shai-hulud-check.yml) to their latest stable major versions, handling any breaking changes for the inputs we use.

Actions in use (current → research latest):
- actions/checkout@v4
- actions/cache@v4
- actions/setup-node@v5
- actions/upload-artifact@v4
- actions/download-artifact@v4
- oven-sh/setup-bun@v1
- softprops/action-gh-release@v1
- stefanzweifel/git-auto-commit-action@v4
- gensecaihq/Shai-Hulud-2.0-Detector@v1

(CodeQL "Analyze" checks come from GitHub default setup, not a workflow file — nothing to edit there.) Follow-up alongside BACK-467 (release fix).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every action in ci.yml, release.yml, and shai-hulud-check.yml is pinned to its latest stable major version (verified against the live releases page/API, not from memory)
- [x] #2 Any breaking change between the current and new major is handled so the inputs we use keep working
- [x] #3 All three workflow files remain valid YAML
- [x] #4 Node 20 deprecation warnings are resolved where a newer (Node 24) major exists
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Researched each action against its live GitHub Releases API/page (one agent per action). Bumps applied (all non-breaking for the inputs we use):
- actions/checkout v4→v6 (node20→node24)
- actions/cache v4→v5 (node20→node24)
- actions/setup-node v5→v6 (node-version/registry-url unchanged; we don't use the `cache` input that v6 changed)
- actions/upload-artifact v4→v7 (node20→node24; we don't set `archive`, so `name` still applies)
- actions/download-artifact v4→v8 (we download by name, unaffected by the by-ID change)
- oven-sh/setup-bun v1→v2 (node20→node24; bun-version input unchanged)
- softprops/action-gh-release v1→v3 (was node16 EOL; `files` input unchanged)
- stefanzweifel/git-auto-commit-action v4→v7 (was node16 EOL; commit_message/branch/file_pattern unchanged)
- gensecaihq/Shai-Hulud-2.0-Detector v1→v2

Caveats on the Shai-Hulud detector: (1) v2 still runs on node20 — no node24 release exists, so this one does NOT clear the Node 20 deprecation warning; (2) v2 is a stronger detection engine and could surface NEW critical findings, failing the security-check on a PR that previously passed (intended security behavior, not an interface break). Revert that single ref to @v1 if it proves noisy.

All three workflow files validated as YAML (ruby). YAML-only change — no TS/lint/test impact. release.yml ref bumps are only exercised on a tag (alongside BACK-467); ci.yml and shai-hulud-check.yml run on this PR's CI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated all 9 GitHub Actions across .github/workflows/{ci,release,shai-hulud-check}.yml to their latest stable major versions, verified one-agent-per-action against the live GitHub Releases API (not from memory). checkout v4→v6, cache v4→v5, setup-node v5→v6, upload-artifact v4→v7, download-artifact v4→v8, setup-bun v1→v2, action-gh-release v1→v3, git-auto-commit-action v4→v7, Shai-Hulud-2.0-Detector v1→v2. Every bump is non-breaking for the inputs we use; most also move off the deprecated Node 20 runtime onto Node 24 (action-gh-release and git-auto-commit-action were on EOL Node 16). Exception: the Shai-Hulud detector v2 is still node20 and its stronger engine may newly fail the security-check — flagged for the maintainer to revert if noisy. 25/25 line ref-only diff; all YAML validated.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
