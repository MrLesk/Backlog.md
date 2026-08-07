---
id: BACK-580
title: Fail closed on ambiguous document and decision identity
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 23:59'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/846'
  - 'https://github.com/MrLesk/Backlog.md/issues/847'
priority: medium
type: bug
ordinal: 221000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issues #846 and #847. Document and decision identity resolves silently instead of failing closed, which violates the manifesto principle of failing closed on ambiguous identity.

- Duplicate document and decision IDs are silently resolved by title sort order (docs are sorted by title at src/file-system/operations.ts:1014-1015 and getDocument returns the first match at src/core/backlog.ts:690-693), so retitling a document can silently re-point an ID to a different file.
- `backlog doctor` scans only tasks (src/cli.ts:4696-4723), so duplicate doc and decision IDs are never reported.
- A document with no `id:` in its frontmatter is listed and searchable but unaddressable except through the empty string (listDocuments pushes unconditionally at src/file-system/operations.ts:993-1015, and documentIdsEqual("", "") returns true via src/utils/document-id.ts:18-25).

Maintainer context: docs and decisions operations lag well behind tasks, and equivalent solutions already exist on the tasks path (for example src/core/duplicate-task-repair.ts). Reuse those existing patterns instead of inventing new machinery.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog doctor` detects duplicate document IDs
- [x] #2 `backlog doctor` detects duplicate decision IDs
- [x] #3 Looking up an ambiguous document or decision ID fails with a clear error instead of silently picking a winner
- [x] #4 The empty-string ID no longer resolves to any document
- [x] #5 Documents missing an `id:` in frontmatter are surfaced as malformed rather than silently half-usable
- [x] #6 Tests cover duplicate detection, ambiguous lookup failure, the empty-string ID, and documents missing an id
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/utils/entity-id.ts: one shared prefixed-ID identity helper (canonical key, equality that treats a blank ID body as unaddressable, AmbiguousIdError, findUniqueById). Make AmbiguousTaskIdError extend AmbiguousIdError so there is one ambiguity error shape.
2. Reduce src/utils/document-id.ts to thin wrappers over it and add src/utils/decision-id.ts mirroring it (findDocumentById / findDecisionById throw on more than one match).
3. src/file-system/operations.ts: listDecisions records each decision's backlog-relative path (new optional Decision.path); loadDocument and loadDecision resolve through the shared resolver and fail closed on ambiguity; decisions resolve by frontmatter ID like documents.
4. src/core/backlog.ts: getDocument uses the shared resolver; add diagnoseContentIdentity() returning duplicate and missing-ID findings for documents and decisions.
5. src/utils/duplicate-detection.ts: add detectContentIdentityIssues() next to detectDuplicateTaskIds (group by canonical key, collect entries with no ID).
6. src/cli.ts: doctor reports duplicate and malformed document/decision IDs alongside task findings and exits 1; update the doctor help schema/description; doc view surfaces the ambiguity error instead of reporting not found.
7. src/server/index.ts document and decision GET endpoints return 409 on ambiguity; src/mcp/errors maps AmbiguousIdError to a clear code.
8. Tests: extend src/test/cli-doctor.test.ts, src/test/filesystem.test.ts, src/test/documentation.test.ts (or a focused new file) covering duplicate detection, ambiguous lookup failure, the empty-string ID, and documents missing an id.
9. Verify: bunx tsc --noEmit, bun run check ., scoped tests, then full bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Identity is now enforced by one shared helper, src/utils/entity-id.ts: a canonical key per prefixed ID, equality that returns false whenever either side has no addressable body, AmbiguousIdError, and findUniqueEntityById. AmbiguousTaskIdError now extends AmbiguousIdError so tasks, documents, and decisions raise the same error shape (existing task message text unchanged). src/utils/document-id.ts became thin wrappers over it and src/utils/decision-id.ts mirrors it.

Fail-closed lookups: FileSystem.loadDocument, FileSystem.loadDecision, and Core.getDocument now resolve through findDocumentById/findDecisionById and throw instead of taking the first title-sorted match. loadDecision previously matched on filename prefix and now matches frontmatter IDs like documents do, so a single authoritative identity applies across surfaces. The empty-string ID resolves to nothing anywhere because documentIdsEqual("", "") is false.

Doctor: Core.diagnoseContentIdentity() reuses the tasks-side pattern (detectContentIdentityIssues sits next to detectDuplicateTaskIds in src/utils/duplicate-detection.ts) and reports duplicate document/decision IDs plus files with no id in frontmatter. Findings are diagnostic-only, like cross-branch findings; no automatic doc/decision repair was added. Doctor exits 1 when findings exist and its help schema and description now name documents and decisions.

Other surfaces kept consistent: doc view prints the ambiguity error instead of "not found"; the server document and decision GET endpoints answer 409; MCP maps AmbiguousIdError to AMBIGUOUS_ID.

Two supporting changes: Decision gained an optional path (set by listDecisions and by the decision watcher) so diagnostics can name files, and the existing MCP test that asserted an update silently collapsing duplicate doc-1/doc-01 files now asserts the fail-closed behavior instead, because that silent collapse is what this task removes.

Documents and decisions missing an id are still listed by doc list and search rather than hidden; hiding them would trade one silent failure for another. They are surfaced by doctor as malformed and are unaddressable by ID.

Review outcome: approved with no blocking findings.

Accepted ride-along (A2): the server document and decision PUT endpoints previously fell through to generic 500s on ambiguity while the GETs already answered 409 with the full message. Both catches now branch on isAmbiguousIdError first, so mutation callers get the same legible 409. Covered by a new case in src/test/server-documents-endpoint.test.ts asserting 409 on PUT for both endpoints and that every candidate file is byte-identical afterward.

Recorded as observations, not fixed here:

A1 (split out as BACK-600): reads now key on frontmatter identity but save-side duplicate cleanup still keys on the filename prefix. Pre-existing on main and unchanged by this task, a file such as nested/doc-2 - Shadow.md carrying frontmatter id: doc-99 is silently deleted by doc update doc-2 because the removal loop matches by filename prefix. Newly reachable but fail-safe, updating a decision whose filename prefix disagrees with its frontmatter ID writes a new file, leaves the old one, and manufactures a duplicate that doctor then reports. Fix direction recorded in BACK-600: locate source files by frontmatter identity using Document.path/Decision.path, and have doctor flag filename-prefix-vs-frontmatter-ID mismatches.

A3-A5 advisories: doc list and search still show documents and decisions with no id (deliberate, they stay visible and are reported by doctor rather than hidden); the web surfaces turn the 409 into a generic fetch failure message rather than showing the ambiguity detail; and doctor reports doc/decision findings as diagnostic-only with no automatic repair, matching how cross-branch task findings are handled.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Document and decision identity now fails closed instead of resolving by title sort order. A single shared helper (src/utils/entity-id.ts) defines the canonical key, blank-ID rejection, and AmbiguousIdError that tasks, documents, and decisions all use; FileSystem.loadDocument, FileSystem.loadDecision, and Core.getDocument raise that error rather than picking a winner, and the empty-string ID no longer matches anything. backlog doctor now reports duplicate document and decision IDs plus files with no id in frontmatter as diagnostic-only findings and exits 1, reusing the existing tasks-side detection module. doc view, the server document and decision GET and PUT endpoints (409), and MCP surface the ambiguity error clearly. Verified with bunx tsc --noEmit, bun run check ., new src/test/content-identity.test.ts (9 tests), new backlog doctor cases in src/test/cli-doctor.test.ts, GET and PUT 409 cases in src/test/server-documents-endpoint.test.ts, the server test suite (46 pass), and full bun run test (2005 pass, 0 fail). Reviewed and approved with no blocking findings; the save-side identity gap found during review is tracked as BACK-600.
<!-- SECTION:FINAL_SUMMARY:END -->
