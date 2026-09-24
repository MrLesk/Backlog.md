---
id: BACK-602
title: Close doctor and web gaps from the identity review
status: Done
assignee:
  - '@claude'
created_date: '2026-08-08 07:46'
updated_date: '2026-08-08 08:03'
labels:
  - core
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/872'
priority: medium
type: bug
ordinal: 241000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two P2 findings from the final Codex review round on PR #872 (BACK-580) were missed before that PR merged. Both are fix-forward.

1. Doctor reports healthy when a whole content directory is unreadable. `listDocuments` and `listDecisions` catch per-file parse errors and record them in the `unreadable` collector, but a failure at the directory-scan level (for example `chmod 000` on `backlog/docs`, or a missing or unreadable directory) is caught by the outer try/catch, which returns an empty array without touching the collector. `Core.diagnoseContentIdentity` (src/core/backlog.ts, around line 293) then sees zero entries and zero unreadable paths, so `backlog doctor` prints that no duplicate IDs were found and exits 0. A directory Backlog could not read must surface as a doctor finding with a non-zero exit, exactly like a per-file parse failure.

2. A stale ambiguity notice blocks the document create route. After a 409 ambiguity error, navigating to `/documentation/new` reuses the mounted component, and the `id === 'new'` branch of the load effect never clears `error` (src/web/components/DocumentationDetail.tsx, around line 298). The ambiguity notice renders instead of the create editor, so the user cannot create a document without a full page reload. `DecisionDetail` has the same load-effect shape and should be checked for the same defect.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog doctor reports an unreadable document or decision directory as a finding and exits non-zero
- [x] #2 Entering the document create route after an ambiguity error renders the create editor instead of the stale notice
- [x] #3 The decision detail view is verified against the same stale-error pattern and fixed if affected
- [x] #4 Tests cover the unreadable-directory finding and the create-route recovery
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/file-system/operations.ts: add a shared recordUnreadableDirectory helper and call it from the outer catch of listDocuments and listDecisions, so a scan-level failure records the directory in the unreadable collector. Keep a missing directory silent (ENOENT) since a project that never created docs or decisions is healthy.
2. src/core/backlog.ts: have diagnoseContentIdentity's path builder render the empty collected path as the content directory itself.
3. src/cli.ts: widen the doctor section heading to 'Unreadable <label> files or directories'.
4. src/web/components/DocumentationDetail.tsx and DecisionDetail.tsx: clear the error and detail state in the id === 'new' branch of the load effect so the create editor renders instead of a stale ambiguity notice.
5. Tests: unreadable-directory findings at the Core and CLI level (guarded for Windows and for root, where chmod does not restrict), a regression test that a missing directory stays healthy, and DOM-harness tests that navigate from a 409 state to the create route for both components.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Finding 1: listDocuments and listDecisions caught scan-level failures in their outer try/catch and returned [] without touching the unreadable collector, so diagnoseContentIdentity saw zero entries and zero findings and doctor exited 0. Both catches now call a shared recordUnreadableDirectory helper.

The important distinction is that a directory which does not exist is not the same as one that cannot be read. Verified empirically: Bun.Glob().scan() throws ENOENT for a missing directory and EACCES for a chmod-000 one. The helper stays silent on ENOENT, so a project that never created docs or decisions is still reported healthy, and anything else becomes a finding. A regression test covers that healthy case, because reporting it would make doctor cry wolf on most fresh projects.

The collector holds directory-relative paths, so the directory itself is recorded as the empty string and Core renders it as backlog/docs or backlog/decisions. The doctor heading is now 'Unreadable <label> files or directories' to cover both.

Finding 2: confirmed present in DocumentationDetail and, as suspected, identical in DecisionDetail. The id === 'new' branch of the load effect never cleared error, so after a 409 the notice kept rendering in place of the create editor. Both now clear error and the detail object when entering the create route.

Both fixes were verified as non-vacuous by sabotaging each fix in turn and confirming the new tests fail: the doctor test drops its finding, and both create-route tests fail to find the title input.

The DOM harness renders one route pattern with a sibling navigation button so a param change keeps the same component instance mounted, which is how the create route is actually reached in the app; remounting would not reproduce the defect. The harness also needed a ThemeProvider because the create editor renders MarkdownEditor, which calls useTheme.

Verified: bunx tsc --noEmit, bun run check ., the doctor, server, filesystem, content-store, markdown, and web suites, and full bun run test at 2035 pass / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the two P2 gaps left by the BACK-580 identity review. backlog doctor no longer reports healthy when it could not read a content directory: listDocuments and listDecisions record scan-level failures in the unreadable collector through a shared helper, Core renders that entry as the directory path, and doctor exits non-zero. A directory that simply does not exist stays silent, because Bun's glob throws ENOENT there and EACCES for an unreadable one, so fresh projects are still healthy. On the web, entering the document or decision create route after a 409 now clears the load error, so the create editor renders instead of a stale ambiguity notice; DecisionDetail had the same defect and was fixed alongside DocumentationDetail. Verified with bunx tsc --noEmit, bun run check ., new tests in src/test/content-identity.test.ts, src/test/cli-doctor.test.ts, and src/test/web-ambiguous-id.test.tsx (each confirmed to fail when its fix is reverted), and full bun run test at 2035 pass / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
