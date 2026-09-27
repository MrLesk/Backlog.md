---
id: BACK-695
title: Skip fetch when the requested Git remote is absent
status: In Progress
assignee:
  - '@codex-pr-remote'
created_date: '2026-09-27 22:14'
updated_date: '2026-09-27 22:15'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/1023'
  - 'https://github.com/MrLesk/Backlog.md/issues/1020'
priority: medium
type: bug
ordinal: 325000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repositories with only a differently named remote can produce repeated Git errors during task reads because the preflight checks for any remote, then attempts to fetch origin. Contributor PR #1023 fixes the requested-remote preflight through the existing Git primitive and adds a real upstream-only repository regression for issue #1020.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fetch request for an absent remote returns without attempting that fetch, including a repository whose only remote is upstream.
- [ ] #2 Existing fetch behavior for a configured requested remote and disabled remote operations stays intact.
- [ ] #3 The contributor fix and its Git regressions pass review and remain attributed in the existing PR, with this task identity and matching title.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review contributor PR #1023 at cc187d43b37b475fe1ff905c39d2b25b7f988af3, including the existing hasRemote helper, fetch configuration gate, and Git regressions.
2. Preserve the contributor implementation and commit. Add this CLI-managed task record as a metadata-only child commit on the existing PR branch, with no production or test changes.
3. Verify that the added commit changes only this task record, retains the original head as its direct parent, and can be pushed as a normal fast-forward after rechecking the remote head.
4. Keep this task In Progress with acceptance criteria unchecked until runtime checks and CI for the PR head provide verification evidence; complete the review in the existing PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Original implementation and regression tests are by Lingikaushikreddy (Kaushikreddy Lingi) in PR #1023, commit cc187d43b37b475fe1ff905c39d2b25b7f988af3. The contributor commit and all production/test blobs are preserved.

Read-only review: fetchRemote now asks the existing hasRemote(remote) helper whether the requested name exists. The helper reads configured remote names and compares the exact requested name. The remoteOperations=false gate remains before this check. The fetch command, timeout, network-error handling, and concurrent-fetch behavior are unchanged. The added regression creates a repository whose only remote is upstream and expects the default-origin fetch to return successfully. Existing fetch and offline-mode mocks are adjusted to the helper that is now called. No concrete source defect or source repair was identified in this review.

This record is the only addition prepared here. No runtime or CI result is claimed by this review; the PR head still requires exact-head CI evidence. Acceptance criteria and Definition of Done remain unchecked.
<!-- SECTION:NOTES:END -->
