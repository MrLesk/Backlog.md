---
id: BACK-820
title: Keep automatic Groma PR previews working
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-21T15:52:00Z'
updated_date: '2026-11-21T15:54:00Z'
labels: []
dependencies: []
references:
  - .github/workflows/architecture.yml
  - .github/workflows/groma-pr-request.yml
  - >-
    https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target#default-policy-for-pull_request_target
modified_files:
  - .github/workflows/groma-pr-request.yml
  - .github/workflows/architecture.yml
type: bug
ordinal: 418000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub will enforce its default event policy for affected public repositories on December 2, 2026. Backlog.md production Pages currently relies on the event that policy blocks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Same-repository pull requests targeting main can request an automatic Groma comparison under the default GitHub event policy.
- [x] #2 The default-branch workflow checks the exact current PR head before building from Git data. Forks remain eligible through manual review and dispatch.
- [x] #3 The main map, comparison URLs, and independent Pages publishing jobs stay in place.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a regular PR workflow that signals the trusted publisher without checking out code or producing artifacts.
2. Resolve an open same-repository PR by its run branch and exact head SHA. Keep manual dispatch on main.
3. Validate the workflow structure and compare the lookup against GitHub metadata.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Parsed YAML and checked Bash syntax. Exercised the selection step against live GitHub data for active same-repository PR #1161, a stale SHA, and a missing branch. Verified manual resolution for merged PR #1240 and fork PR #1160. Code and publication URLs are unchanged below the event and commit selection steps. Automatic Pages verification follows after the workflow reaches main.
<!-- SECTION:NOTES:END -->
