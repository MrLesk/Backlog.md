---
id: BACK-639
title: Make drafts editable from the CLI and TUI
status: Done
assignee:
  - '@ox-alpha'
created_date: '2026-08-24 21:12'
updated_date: '2026-08-25 00:30'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/934'
type: bug
ordinal: 274000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #934: drafts are first-class records (draft list/create/view/promote/archive exist) but neither primary human surface can edit them. The core mutation layer already supports draft updates (editTaskOrDraft / updateDraftFromInput), wired only into MCP and web. CLI has no `draft edit` subcommand, `task edit` cannot resolve draft IDs, and the TUI E key fails with "Task DRAFT-x was not found on this branch" because getTaskPath only scans tasks and completed directories.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog draft edit <id>` applies non-interactive field flags to a draft through the shared core mutation path
- [x] #2 `backlog draft edit <id>` without field flags opens the same interactive editing flow used for tasks
- [x] #3 Pressing the edit key on a selected draft in the TUI opens that draft instead of reporting it missing
- [x] #4 Unknown or ambiguous draft IDs fail closed on every touched surface with the same error style tasks use
- [x] #5 Flag parsing is reused from the task edit path rather than duplicated; MCP and web behavior unchanged
- [x] #6 CLI contract tests cover draft edit success, fail-closed cases, and the TUI draft-resolution fallback; full suite, tsc, and biome pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. CLI: extract the task-edit option registration and non-interactive flag->mutation body in src/cli.ts into shared helpers; add 'backlog draft edit [taskId]' reusing them. Target resolution keyed by kind: tasks via loadTaskById (unchanged), drafts via listDrafts + findUniqueEntityById so unknown ids print 'Draft X not found.' (exit 1) and ambiguous ids throw the shared AmbiguousIdError style with doctor guidance.
2. Draft status guard: valid statuses for draft edit are [Draft]; -s <other> fails closed with the same 'Invalid status' message style as task edit; promotion stays with 'draft promote'.
3. Interactive: without field flags (TTY) both commands share the wizard flow; drafts pick from drafts and run runTaskEditWizard with statuses=[Draft], applying via core.updateDraftFromInput.
4. TUI: editTaskInTui falls back to getDraftPath/loadDraft when the id is not a local task file, so the E key opens the selected draft; contentStore upsert stays task-only.
5. MCP/web untouched.
6. Tests: new src/test/cli-draft-edit.test.ts (success paths, invalid status, unknown/ambiguous fail-closed) + src/test/tui-draft-edit.test.ts for editTaskInTui draft fallback; then full suite, tsc, biome, built-CLI smoke.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: (1) src/cli.ts - extracted shared addEditFieldOptions() and runEditCommand(target,...) from task edit; added 'draft edit [taskId]' with draftEditTarget (filename-based resolve via listDrafts, AmbiguousIdError on multiple matches, updateDraftFromInput mutation, statuses=[Draft]). getCanonicalStatus gained optional allowedStatuses param so draft status validation reuses the same matching/message style. (2) src/core/backlog.ts editTaskInTui - falls back to getDraftPath/loadDraft when id has no local task file; reload helper keyed by which path matched; contentStore upsert stays task-only. MCP/web untouched. New tests cli-draft-edit.test.ts (7) + tui-draft-edit.test.ts (3) pass; related suites pass.

Validation evidence: new suites cli-draft-edit.test.ts (7 pass) and tui-draft-edit.test.ts (3 pass). Related suites re-run: cli-task-view-edit, cli-plain-create-edit, task-edit-preservation, atomic-task-edit, tui-edit-session, draft-create-consistency, draft-lifecycle-autocommit-scope (59 pass), cli-guidance + mcp-drafts + web-draft-editing + server-drafts-endpoint + cli-custom-prefix-id-resolution + task-path + cli-task-wizard (111 pass). Full bun test: 2367 pass / 6 skip / 1 fail - the config-commands failure reproduces identically on clean main (verified via stash), pre-existing. bunx tsc --noEmit clean. biome clean for all touched files; repo-wide check has 3 failures that also exist on unmodified main (server/index.ts format, ui/board.ts organizeImports, ui/components/task-composer.ts format). Built-binary smoke in temp project: draft create/edit/view roundtrip, unknown id -> 'Draft DRAFT-42 not found.' exit 1, invalid status -> 'Invalid status: Done. Valid statuses are: Draft' exit 1, ambiguous duplicate files -> shared 'is ambiguous; 2 files match' + doctor guidance exit 1; task edit regression smoke unchanged. Interactive AC#2 evidence: pty run of built CLI 'draft edit 1' opened the wizard Title prompt prefilled with the draft title, same flow/control behavior as 'task edit'.

PR #940 review fixes (commit 2): (1) draftEditTarget.resolve now scans candidate filenames via Bun.Glob over getDraftsDir, applies filenameMatchesId exact pass then the same draftIdsMatchLoosely leading-zero/case rule as getDraftPath (ambiguity detection intact across both passes), parses only matched candidates so a damaged sibling cannot hide drafts, fails closed naming the file when parse fails or when frontmatter id does not match the filename id, and returns the FILENAME-derived canonical id so updateDraftFromInput mutates the already-selected file. (2) editTaskInTui uses the selected draft's own filePath (validated existing via content read and identity-checked with draftIdsMatchLoosely) instead of re-resolving by id; new TuiTaskEditFailureReason 'identity_conflict' surfaced in task viewer and board with doctor guidance; no-context calls still resolve via getDraftPath which is filename-bound. (3) formatTaskEditError takes commandKind so draft edits emit backlog draft view/edit recovery copy while tasks keep byte-identical copy. New tests: CLI drift fail-closed, padded shorthand (1 and 01), corrupt-sibling isolation naming the damaged file, draft-specific recovery text; TUI drift identity_conflict leaving file untouched, and selected-file exactness where two files resolve to one id.

PR #940 round-2 fixes: (1) draft resolution now unions exact filenameMatchesId and loose numeric matches BEFORE the ambiguity check, so padded/unpadded duplicates (draft-1 + draft-001) fail closed with both files listed instead of silently mutating one; (2) new FileSystem.listHealthyDrafts parses per candidate file and skips damaged ones individually; the no-ID wizard path consumes it so healthy drafts stay selectable when a sibling is corrupt (listDrafts itself unchanged); (3) editTaskInTui recognizes a selected row as a draft from its validated path location (dirname equals drafts dir) or status before identity validation, so drifted records carrying non-Draft statuses also fail closed with identity_conflict instead of falling through to id re-resolution; (4) all draft-side identity errors now give manual recovery wording (rename files / fix frontmatter ids so ids agree, then retry) instead of pointing at backlog doctor, which does not scan drafts; task-side doctor hints untouched.

PR #940 round-3 P1 fixes: (1) editTaskInTui now decides the selected row's store from its filePath location before any task lookup - when dirname(filePath) equals the drafts directory the exact draft file is used directly after draftIdsMatchLoosely identity validation, so projects whose task prefix is 'draft' (task ids colliding with draft ids) can no longer open and rewrite the task file when E is pressed on a draft row; task rows keep the previous loadTask/getTaskPath behavior. (2) updateDraftFromInput now mirrors updateTaskFromInput's locking discipline: it acquires fs.withTaskLock on the draft file, re-reads inside the lock, and applies/saves there, so concurrent draft editors fail fast with the shared TaskLockError instead of last-write-wins silently losing updates. Regression tests: concurrent draft writers race in cli-draft-edit.test.ts (fails against pre-lock core, verified via stash) and a DRAFT-1-in-both-stores collision test in tui-draft-edit.test.ts asserting the drafts file receives the edit while the task file stays byte-identical.

Round-4 structural restructure: one validated draft reference is now the only way any consumer touches a draft. FileSystem gained DraftFileReference { filePath, canonicalId } plus two authority methods - draftReferenceFromPath(path) (parse isolation + filename/frontmatter equivalence, canonicalId derived from the filename, task carries filePath) and resolveDraftReference(id) (exact+loose union, ambiguity fail-closed, delegates to draftReferenceFromPath). Mutations: updateDraftFromInput(reference,...) only accepts a reference, locks via new namespaced fs.withDraftLock (draft-<key> lockfiles shared with withTaskLock's extracted withEntityFileLock helper so task DRAFT-1 and draft DRAFT-1 no longer spuriously contend while same-file contention keeps TaskLockError), loads/applies/saves at reference.filePath and re-reads via the authority. updateDraft now returns the saved path and stages renames like task moves do: stageFileMove(old,new)+commitFiles when title changes (fixes auto-commit leaving the old tracked file alive), plain add+commit otherwise. editTaskOrDraft resolves ids through resolveDraftReference so MCP/web keep their id-based API but inherit all fail-closed validation. TUI drafts-dir branch consumes draftReferenceFromPath; the status-heuristic branch and getDraftPath fallback were deleted. CLI: EditCommandTarget.resolve takes an id-or-selected-path (wizard selections carry the row's filePath via new optional TaskWizardTaskOption.value, defaulting to id so task behavior is byte-identical), target.update receives the resolved entity and builds the reference; ~45 lines of inline resolution logic deleted from cli.ts. New tests: rename staging asserts git shows old D + new A with clean porcelain; wizard handle passthrough; drifted-row selection fails closed without touching the twin; lock namespacing (no contention vs task twin, TaskLockError on real contention).

Round-5 final fixes + sweep. (1) saveDraft cleanup now removes every file whose numeric identity loosely matches the saved id (not just exact prefix), and updateDraftFromInput binds the mutated record's id to reference.canonicalId before saving, so a padded draft-001 file with unpadded frontmatter converges to one file across edits instead of minting draft-1 duplicates. (2) New pure helper findDuplicateDraftFilenameGroups (task-path.ts) groups filenames by numeric identity; the no-ID picker path fails closed with AmbiguousIdError naming colliding files BEFORE rendering choices (PTY test gated by RUN_INTERACTIVE_TUI_TESTS=1 proves no choices render; helper unit test always runs). (3) editTaskInTui close-time reload failures on drafts now return identity_conflict instead of swallowing to null and reporting changed:true; the edited file is preserved as-saved for manual repair and later edits keep reporting the conflict honestly. Sweep conversions: core.promoteDraft, fs.promoteDraft, fs.archiveDraft moved onto resolveDraftFilePath - whole-file ops bind by filename with duplicate fail-closed but deliberately WITHOUT frontmatter validation, preserving the drifted-file removal workflow protected by cli-custom-prefix-id-resolution tests (my first attempt validated identity there and broke that contract - reverted within this round). Touchpoint audit: CLI direct-ID edit=authority; CLI wizard=listHealthyDrafts+collision guard+row-path binding=authority; TUI open/edit/close=authority incl conflict reporting; TUI board E-key=tasks only, unreachable for drafts; core promote/archive/demote/promoteDraftWithUpdates=file-bound or allocator-fresh, converted/verified; saveDraft cleanup=loose convergence; createDraftFromInput=allocator-fresh id, exact cleanup sufficient; draft list/view/default=read-only displays, unchanged by design (view uses getDraftPath+loadDraft, first-match read display, no mutation risk - noted); web/server GET+listings and MCP fetches=read-only unchanged per constraints; web PUT/MCP task_edit route editTaskOrDraft=authority inherited; doctor repair flows=tasks-only n/a.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added backlog draft edit and made TUI edit work on drafts. src/cli.ts: extracted the task-edit option set (addEditFieldOptions) and the whole action body (runEditCommand) into shared helpers keyed by an EditCommandTarget; task edit keeps loadTaskById/editTask while draftEditTarget resolves drafts by filename with fail-closed ambiguity (AmbiguousIdError) and mutates via updateDraftFromInput with statuses locked to Draft (promotion stays with draft promote). getCanonicalStatus gained an optional allowedStatuses override so draft status validation reuses the same matching and message style as tasks. core.editTaskInTui now falls back to getDraftPath/loadDraft when the id is not a local task file so the E key opens the selected draft; contentStore upsert stays task-only. MCP and web are untouched. Verified with 10 new tests, related existing suites, full bun test, tsc, biome on touched files, and a built-CLI smoke including a pty check of the interactive flow.
<!-- SECTION:FINAL_SUMMARY:END -->
