---
id: BACK-747
title: Preserve unknown frontmatter in tasks and drafts
status: Done
assignee:
  - '@codex-747'
created_date: '2026-10-11 19:34'
updated_date: '2026-10-19T16:32:00Z'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/918'
  - src/markdown/frontmatter.ts
  - src/markdown/serializer.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/core/prefix-migration.ts
  - src/test/task-frontmatter-preservation.test.ts
  - src/core/content-store.ts
modified_files:
  - src/markdown/serializer.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/core/prefix-migration.ts
  - src/core/content-store.ts
  - src/test/task-frontmatter-preservation.test.ts
type: enhancement
ordinal: 365000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #918 reports unknown task frontmatter being lost during an edit. The future task/draft behavior is automatic preservation of all unknown top-level keys, with their original YAML representations and no project configuration. Backlog-owned keys keep their current meaning; unknown metadata remains opaque user data.

Alex decided on 2026-10-18: “Let’s get rid of custom fields and preserve all. I think it’s a better decision than my previous one.” This supersedes the earlier configured-only design and its task_custom_fields prerequisite. That design previously required BACK-746 and proposed dropping keys absent from a list; neither rule remains accepted.

This task remains To Do and is not part of the document/decision implementation for issue #1091 (BACK-748). It should reuse the existing shared Markdown preservation owner after researching task/draft write paths. No custom-field editing, public output additions, filtering, searching or UI is included. BACK-733 is an independent body-prefix bug, not a required feature gate for unknown-key preservation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Without configuration, task and draft writes retain every unknown top-level frontmatter entry, including the issue #918 approval block.
- [x] #2 Unknown values keep their written YAML representations, including bare dates, 007, 1.10, flow lists and nested blocks with comments, across repeated writes.
- [x] #3 Existing CLI, HTTP, MCP and TUI write paths, including promote/demote and lifecycle operations, share the same preservation behavior.
- [x] #4 Backlog-owned fields keep existing behavior, including omitted/cleared optional fields and edits that write nothing when nothing changed.
- [x] #5 No configuration lists, custom-field editing/output/filter/search/UI behavior or milestone preservation is added.
- [x] #6 Focused regressions verify task and draft update paths and original #918 reproduction; implementation is separately planned before work begins.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce issue #918 with the current CLI in a temporary filesystem-only project and trace task/draft writes from CLI, HTTP, MCP and TUI.
2. Reuse src/markdown/frontmatter.ts as the sole raw-YAML preservation owner. Pass original source through task serialization and storage saves; list owned optional keys even when omitted so clears keep their current behavior.
3. Carry source content explicitly across promote/demote and legacy draft-prefix migration while preserving exclusive create, locking, unlink order and identity rules. Keep opaque metadata out of Task models and public responses.
4. Add focused public-flow regressions for #918, repeated task/draft writes, raw YAML spellings and aliases, owned clears/no-op, transitions, lifecycle, and CLI/HTTP/MCP/TUI paths. Run existing safety regressions.
5. Run canonical types, Biome, build and compiled public-flow proofs; simplify the diff; freeze source/test hashes and main-relative diff for root review before finalization or commit.

Required watcher propagation: ContentStore.patchFilesystem must forward originalContent through its saveTask wrapper so watched promotions use the same source.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18: Future specification revised under Alex's automatic-preservation decision. The configured-only plan and BACK-746 prerequisite are superseded. BACK-748 addresses only documents and decisions; #918 remains unimplemented here. The old BACK-733 dependency was a proposed shared-writer prerequisite, not an existing requirement; it remains separately open.

Pre-fix reproduction (2026-10-19): exact issue #918 no-Git CLI flow succeeds but removes approval: after task edit TASK-1 -s "In Progress". Evidence: /private/tmp/back747-before-1kd0a0wv/proof.json, before.md and after.md. Research: all semantic task/draft writes converge on FileSystem.saveTask/saveDraft and serializeTask. Promotion/demotion clear filePath deliberately; preserve original content separately without changing exclusive-create behavior. Existing shared frontmatter owner already handles raw spans and reference safety.

Implementation and focused verification complete pending frozen-diff review: task/draft serialization reuses stringifyFrontmatter; storage captures original files, transitions pass source separately, ContentStore forwards it, and legacy prefix migration reuses its read. Owned optional keys remain declared when omitted. No opaque data was added to Task or public output. Subtraction pass kept the existing preservation owner and avoided new models/helpers. Final focused source suite: 194 passed, 1 existing skipped, 0 failed across 13 files. bun run check:types, bunx tsc --noEmit, bun run check . and canonical build passed. Standalone compiled CLI proof: 15 commands passed, including #918, repeated raw YAML retention, owned clear/no-op, opaque-output omission, archive/restore, archived refusal, promote/demote/rename, and alias refusal before deletion. Evidence: /private/tmp/back747-focused-tests-final.log and /private/tmp/back747-compiled-v8r87l4w/proof.json. Task remains In Progress with AC/DoD unchecked until root reviews frozen proof.

Full-context architecture review returned KEEP with no blocker or change recommendation; reviewed source/test hashes and frozen diff matched. Established full CI profile passed on those unchanged hashes: TERM=xterm-256color BACKLOG_TEST_CLI_BUNDLE=/private/tmp/back747-bundle/cli.js bun scripts/run-ci-tests.ts --profile=full --parallel=4 --isolate --timeout=10000 --max-concurrency=4. Non-DOM: 3181 passed, 13 skipped, 0 failed across 282 files (115.53s). DOM: 399 passed, 0 failed across 39 files (11.49s). Combined: 3580 passed, 13 skipped, 0 failed, 3593 tests across 321 files. Log: /private/tmp/back747-ci-full-profile.log. Built-bundle new public-flow suite: 10 passed, 0 failed. All seven frozen hashes matched after the full profile. The preliminary package-wide test run was stopped with exit 130 before using the established profile; it is not claimed as a full-profile result.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task and draft writes now retain unknown top-level frontmatter automatically, preserving written YAML values, nested blocks, comments and safe aliases through repeated edits and lifecycle changes. The existing shared frontmatter owner handles preservation; Backlog-owned field clearing and no-op behavior remain intact, and opaque metadata is not added to public models or output. Ten public-flow regressions cover CLI, HTTP, MCP, TUI, promotion/demotion, archive/restore, prefix migration and linked-record cleanup. Focused tests, the full CI profile (3580 passed, 13 skipped, 0 failed), both type checks, Biome, canonical build and standalone compiled CLI proofs passed. Architecture review found no required changes.
<!-- SECTION:FINAL_SUMMARY:END -->
