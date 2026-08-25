---
id: BACK-636
title: Fail closed on ambiguous draft identities
status: In Progress
assignee: []
created_date: '2026-08-15 14:00'
updated_date: '2026-08-25 18:58'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/940'
priority: medium
ordinal: 271000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex finding on PR #916 (BACK-634), pre-existing class, confirmed as the root cause blocking BACK-639 (PR #940, seven review cycles): drafts have a dual identity model (filename-derived vs frontmatter-declared) with zero-padding and dotted-segment variants that different consumers interpret differently; first-match loadDraft can rewrite or promote a different same-ID draft than the one the user saw. Agreed design: the canonical draft identity is filename-derived and canonicalized in exactly one shared function (per-segment numeric canonicalization covering padding and dotted segments); frontmatter id must canonically agree with the filename id or every mutation path fails closed with actionable repair copy naming the file; duplicate numeric identities across files are ambiguous everywhere mutations resolve them; unparsable files are never silently deleted or overwritten and their filename ids still count as occupied for allocation. Tasks, documents, and decisions already fail closed (AmbiguousTaskIdError / BACK-580); drafts get the same treatment across CLI, TUI, web, and MCP.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Draft resolution fails closed with an error naming candidate files when multiple drafts share an identity
- [ ] #2 Web and MCP draft edit/promote paths surface the conflict instead of mutating an arbitrary match
- [ ] #3 doctor reports duplicate draft identities
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Continue on the preserved PR #940 stack (branch tasks/back-639-draft-editing) so the validated-reference flow, locking, and test suites already banked there become the foundation rather than being rebuilt.
2. Introduce one shared canonicalization authority for filename-derived draft ids and route grouping keys, loose matching, occupancy checks, and save-time cleanup through it.
3. Enforce fail-closed resolution for duplicates and drifted frontmatter in every mutation surface (CLI direct/wizard, TUI open/edit/close, web PUT, MCP task_edit, promote/demote/archive).
4. Extend doctor to report duplicate or drifted draft identities (existing AC #3).
5. Fix the six outstanding round-7 Codex findings on PR #940 within this model.
6. Finalize BACK-636 record, then rebase/finalize BACK-639 editing work in the same pull request.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started on tasks/back-636-draft-identity stacked on 46d2cd5e (BACK-639 stack preserved per plan step 1). Folding six round-7 findings into the validated-reference foundation plus canonicalization authority, doctor coverage, and web/MCP conflict regression tests.

BACK-636 implementation notes (stacked on BACK-639 @46d2cd5e). FOUNDATION: one canonicalization authority - utils/task-path.ts draftIdentityKey(id) canonicalizes prefix casing and strips leading zeros in EVERY numeric segment incl. dotted subtask segments; draftIdsMatchLoosely now compares through it, findDuplicateDraftFilenameGroups keys through it, and saveDraft convergence + resolveDraftFilePath/resolveDraftReference candidates inherit it via draftIdsMatchLoosely/filenameMatchesId; redundant extractDraftBody deleted. ROUND-7 FINDINGS: (1) dotted padding variants (draft-1.1 vs draft-1.01) now group as one identity - picker guard and direct-ID resolution both fail closed naming both files, no data loss (test asserts both files survive); (2) absolute paths passed as public draft edit argument are rejected unless inside the configured drafts dir ('Invalid draft id' error), foreign/task-shaped files cannot be copied into drafts; (3) TUI close-time task reload attaches known taskFilePath so contentStore.upsertTask publishes and cached reads stop going stale; (4) TUI pre-open duplicate check over ALL filenames returns new 'ambiguous' reason when selected row shares numeric identity, handled in both TUI handlers with rename guidance; (5) draft edit help schema now lists all supported fields matching addEditFieldOptions, verified by --help completeness test; (6) promotion wraps read-unlink span in withDraftLock before createLock (consistent ordering, no deadlock) - contended promotion fails fast TaskLockError with single record preserved, succeeds after release. B fail-closed agreement audit: promote (core+fs) bind by filename resolver, no loadDraft first-match on any mutation path; remaining loadDraft/getDraftPath uses are read-only surfaces (view/list/default, web GET, MCP fetch) or allocator-fresh writes. C doctor: FileSystem.diagnoseDraftIdentity + Core delegate report duplicate numeric identities, drifted frontmatter-vs-filename (naming file, frontmatter id, filename id), and unreadable files; printed in doctor output and included in exit-code/healthy checks. D web/MCP regression tests: PUT /api/tasks/DRAFT-1 with a padded twin returns 409 naming both files without mutating either; /api/drafts/:id/promote maps ambiguity to 409 message; MCP task_edit returns isError result containing the ambiguity text with both records untouched. Verification: targeted suites 181 pass across 10 suites; full bun test 2395 pass / 7 skip / 1 pre-existing main failure; tsc clean; biome clean on all touched files (server/index.ts format debt fixed since touched this round).
<!-- SECTION:NOTES:END -->
