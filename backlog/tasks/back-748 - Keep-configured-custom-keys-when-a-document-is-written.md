---
id: BACK-748
title: Preserve unknown frontmatter in documents and decisions
status: Done
assignee:
  - '@codex-1091'
created_date: '2026-10-11 19:35'
updated_date: '2026-10-19 08:31'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1091'
  - src/markdown/frontmatter.ts
  - src/markdown/serializer.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/markdown/parser.ts
  - src/test/content-frontmatter-preservation.test.ts
  - CLI-INSTRUCTIONS.md
  - 'https://github.com/MrLesk/Backlog.md/pull/1119#discussion_r4311596800'
modified_files:
  - >-
    backlog/tasks/back-748 -
    Keep-configured-custom-keys-when-a-document-is-written.md
  - >-
    backlog/tasks/back-747 -
    Keep-configured-custom-keys-when-a-task-or-draft-is-written.md
  - backlog/tasks/back-746 - Add-custom-field-lists-to-the-project-config.md
  - >-
    backlog/archive/tasks/back-746 -
    Add-custom-field-lists-to-the-project-config.md
  - >-
    backlog/tasks/back-749 -
    Keep-configured-custom-keys-when-a-decision-is-written.md
  - >-
    backlog/archive/tasks/back-749 -
    Keep-configured-custom-keys-when-a-decision-is-written.md
  - >-
    backlog/tasks/back-750 -
    Return-configured-custom-fields-in-plain-JSON-and-MCP-output.md
  - >-
    backlog/archive/tasks/back-750 -
    Return-configured-custom-fields-in-plain-JSON-and-MCP-output.md
  - >-
    backlog/tasks/back-751 -
    Show-configured-custom-fields-in-the-TUI-and-web-UI.md
  - >-
    backlog/archive/tasks/back-751 -
    Show-configured-custom-fields-in-the-TUI-and-web-UI.md
  - >-
    backlog/tasks/back-752 -
    Report-frontmatter-keys-that-are-neither-known-nor-configured-in-doctor.md
  - >-
    backlog/archive/tasks/back-752 -
    Report-frontmatter-keys-that-are-neither-known-nor-configured-in-doctor.md
  - src/markdown/frontmatter.ts
  - src/markdown/parser.ts
  - src/markdown/serializer.ts
  - src/file-system/operations.ts
  - src/test/content-frontmatter-preservation.test.ts
  - src/core/backlog.ts
  - CLI-INSTRUCTIONS.md
type: enhancement
ordinal: 366000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Updates of documents and decisions rebuild frontmatter from Backlog-owned fields and drop metadata used by other tools (issue #1091). Preserve every unknown top-level frontmatter key automatically, with no project configuration. Keep each unknown entry's original YAML representation, including nested blocks and comments, bare dates, 007, 1.10 and flow lists. Backlog-owned keys retain their current meaning; preserved metadata is opaque user data.

Alex's decision on 2026-10-18 supersedes the configured-only policy recorded when BACK-746 through BACK-752 were created: “Let’s get rid of custom fields and preserve all. I think it’s a better decision than my previous one.” BACK-749's decision-preservation scope is consolidated here. The earlier configured-only design is historical evidence, not the current contract.

Scope: existing document CLI, HTTP and document MCP update paths; existing decision HTTP full saves and CLI status edits. No custom-field editing, output additions, config, task/draft implementation (#918), milestone behavior or future decision API work. BACK-733 remains an independent body-prefix bug; avoiding body re-parsing in this serializer is part of correct preservation, not completion of its wider scope.

Source research confirms all document updates already reach FileSystem.saveDocument, decision full saves reach FileSystem.saveDecision, and decision status changes already preserve other text. BACK-733, BACK-746, BACK-747, BACK-737 and BACK-738 are not prerequisites for the current behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With no custom-field configuration, the issue #1091 document reproduction keeps depends_on: [example] and task: TASK-1 while updating its body.
- [x] #2 All unknown top-level document and decision entries retain their original YAML values and comments, including nested blocks, bare dates, 007, 1.10 and flow lists, across repeated saves.
- [x] #3 Existing document CLI, HTTP and document_update MCP updates preserve unknown entries across content, title, type, tag and path changes.
- [x] #4 Existing decision HTTP full saves and CLI status updates preserve unknown entries while correctly changing owned fields.
- [x] #5 Optional owned fields remain owned when omitted or cleared; records without unknown metadata keep existing serialization behavior. Preservation adds no config, public JSON fields, field editing or task/draft behavior.
- [x] #6 Focused regressions and the canonical type, Biome and build checks pass. Superseded configured-field plans are reconciled with the 2026-10-18 decision through the CLI.
- [x] #7 Explicit null frontmatter entries before later owned fields survive without duplicate owned keys; the resulting document and decision YAML parses and remains stable across repeated saves.
- [x] #8 Saves that would break a YAML reference in preserved metadata are refused with a clear error before any file is written or moved; original file bytes and path remain intact. Valid references between unknown entries still work. No new reference semantics are introduced.
- [x] #9 Preserved YAML merges or references cannot silently restore an omitted owned field or undo its requested update. Compare readback with canonical intended owned fields, including absence; refuse conflicting saves with unchanged bytes/path instead of adding null or empty override semantics.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes
- [x] #2 bun run check . passes
- [x] #3 Focused and appropriate broader tests pass; bun run build passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce issue #1091 on the unchanged baseline and preserve objective failure evidence.
2. Reconcile obsolete configured-field plans through the CLI: archive BACK-746/749/750/751/752 as canceled or consolidated; revise BACK-747 for future automatic task/draft preservation without implementing it.
3. Extend the existing Markdown frontmatter owner with one small raw-entry helper. Use the existing YAML parser's source positions to retain unknown top-level entries; serialize only owned fields. Keep optional owned keys reserved when omitted.
4. Pass original loaded document/decision source through existing storage and serializers, including moves/renames. Keep the decision status-only path unchanged. Avoid re-reading a supplied document body as frontmatter in this path; do not change task/draft persistence.
5. Add focused regressions for raw values/comments/nested blocks, repeated saves, known-field updates/clears, CLI/HTTP/MCP document updates and decision full-save/status behavior.
6. Run focused tests, appropriate broader existing tests, bun run check:types, Biome and build. Diagnose any failures before retrying.
7. Review the diff for scope and simpler code; leave verified uncommitted changes for coordinator architecture review. Do not check AC, write a final summary, mark Done, commit or publish before that review.

Raw extraction detail: reuse the existing parser normalization for @assignee/@reporter/due_date input. Move those unchanged normalization helpers to the existing frontmatter owner and map YAML node offsets back to original source lines, so accepted input and original unknown representations both survive.

Approved bounded follow-up (Alex: “Sure. Do it”, 2026-10-19): correct omitted-value root entry boundaries; validate the combined frontmatter through the existing YAML engine and refuse only broken YAML references before storage writes/moves. Route the refusal through the existing core error contract so CLI, HTTP and MCP report the same clear message. Leave decision status-only behavior unchanged; correct its stale serializer comment. Document automatic preservation and the refusal limit in the shipped CLI reference. Add only the focused null-entry/reference regressions, then re-run affected tests, canonical checks and built CLI proof. Hold uncommitted for focused architecture review.

Verified ownership boundary: compare the preserved header's owned fields with the parsed canonical intended header, including missing optional fields. Refuse only a preserved-reference conflict such as a merge restoring cleared tags; do not introduce null/empty overrides or new reference semantics.

Review and finalization: both architecture reviews returned KEEP; fresh build and compiled CLI proofs passed on unchanged reviewed source. Coordinator authorized checking verified AC/DoD, marking Done, and creating the local feature-branch commit. No push, PR, CI changes or branch switch are included.

PR #1119 review correction: reproduce the exact leading-comment loss on head 203b9582 through storage and CLI. Move the existing block entry source boundary backward over contiguous leading comment lines at the mapping indentation, leaving deeper nested-value comments in their existing span. Extend the shared metadata fixture so existing repeated document/decision and CLI/HTTP/MCP tests cover this shape. Re-run affected tests, canonical types/Biome/build and compiled CLI proof; perform a subtraction pass and hold uncommitted for focused correction review. No other YAML or product policy change.

Verified adaptive regression in the comment correction: bound the backward leading-comment scan by the previous parsed value's source end. A root-level # line inside an unknown multiline quoted scalar cannot become part of a following owned entry. Add only the exact reported kept-to-discarded fixture and stable repeated-save assertion, re-run affected checks, then freeze for review.

Coordinator-approved refinement for the two verified regressions: keep each parser node's full source end for raw slicing, and derive a separate content end from its final parsed child (or its own leaf end). Use the content end only as the backward comment-scan lower bound. This generic distinction must pass the exact quoted-value regression and existing list-based metadata/repeated-save fixture together; no syntax-specific exceptions or new fixtures.

Final bounded correction review returned KEEP on frozen source/test hashes; all current checks and compiled proofs passed. Coordinator authorized finalizing BACK-748 and committing only the task record, frontmatter helper and focused test correction. Push and PR/CI handling remain with the coordinator.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18 scope decision: Alex replaced the earlier configured-only policy with automatic unknown-key preservation. Original BACK-748/749 criteria and dependency chains described that superseded plan. Existing shared write paths need none of those future feature gates. BACK-733 remains open; the necessary body-prefix connection is limited to the document/decision serializer used here.

Baseline proof (main 75e9e972416bff53f54ea93f4b32d7252389c026, before source edits): /private/tmp/back-748-baseline.ts ran the existing CLI doc update doc-1 --content x against a filesystem-only fixture containing depends_on: [example] and task: TASK-1. Exit code 0, body updated to x, both unknown entries lost (metadataRetained: false). Fixture: /var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/back-748-baseline-2Nhw6v. Reconciled BACK-746/749/750/751/752 as archived, canceled/consolidated and unimplemented; BACK-747 remains To Do with automatic-preservation scope.

Source inspection found the parser normalizes selected field values before YAML parsing even for documents/decisions. Raw extraction must reuse this behavior; parsing the raw header without it would reject currently accepted @assignee values. No new YAML syntax is introduced.

Validation found an existing save behavior: records may carry a previous path whose file no longer exists (including reused document fixtures). Initial source reads threw ENOENT in 15 broader tests. Read original metadata only when that source file exists, preserving the prior writeRecordFile behavior for absent sources. These were diagnosed implementation failures, not flaky tests. Initial Biome findings are formatting and test-literal issues being corrected.

Verification before contextual review: 357 tests passed across content-frontmatter-preservation, markdown, filesystem, core, cli-doc-decision-board, cli-decision-status, server-documents-endpoint, mcp-documents, content-identity, document-archive, decision-archive and content-store (bun test --timeout=10000; log /private/tmp/back-748-focused.log). bun run check:types passed (567 files); bun run check . passed (462 files); bun run build passed. Built CLI reproduction /private/tmp/back-748-built-repro.ts exited 0 and retained depends_on/task with body x; fixture /var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/back-748-baseline-6AMoTL. Local HTTP test commands require sandbox escalation because a bare Bun.serve({port:0}) cannot listen inside the sandbox.

Subtraction review: no new dependencies, config, public model/JSON fields or task/draft serialization behavior. Existing normalization moved unchanged to the Markdown frontmatter owner for reuse; original source spans preserve raw values. Found one unresolved existing-YAML case and reported it to the coordinator: title: &t Original plus unknown owner: *t parses before save, but regenerating title without its anchor leaves an invalid unknown alias. No anchor policy was silently added. Waiting for that contextual decision before declaring ready; AC and DoD remain unchecked and status In Progress.

2026-10-19: Alex approved the bounded follow-up after the contextual architecture review kept the shared Markdown/storage approach. Frozen production/test hashes match /private/tmp/back-748-review-evidence.json. Confirmed null-entry defect evidence is /private/tmp/back-748-explicit-null-evidence.json. The previous open anchor-policy note is superseded: reference-breaking saves will be refused with unchanged bytes/path, rather than adding reference support.

2026-10-19 follow-up review confirmed `defaults: &d {tags: [old]}` plus `<<: *d` can recover tags after a clear. The coordinator authorized a small canonical ownership comparison under the existing accepted invariant and safe-refusal boundary. This replaces no serialization semantics: conflicting saves fail before writes or moves. Direct null-entry and unresolved-reference regressions currently pass (10 tests).

2026-10-19 final verification and review: broad contextual architecture review KEEP; focused follow-up architecture review KEEP with no further edits or worthwhile simplification. Coordinator authorized task finalization and the local feature-branch commit after confirming the fresh build and compiled proofs. The seven reviewed source/document/test hashes remained unchanged after review.

Objective AC evidence:
- AC 1: unchanged main reproduction lost depends_on/task with exit 0; fresh compiled CLI retains them and writes body x (/private/tmp/back-748-built-repro-revision.json).
- AC 2-5: 11 focused regressions cover original YAML scalar spelling, nested comments/blocks, flow lists, repeated saves, owned optional-field clears, document CLI/HTTP/MCP moves and metadata edits, decision HTTP full saves and exact status-only edits. Existing Markdown, storage, identity, archive, core and content-store tests also pass.
- AC 6: BACK-746/749/750/751/752 are archived unimplemented with explicit cancellation/consolidation notes. BACK-747 stays To Do under automatic-preservation scope; #918 remains unimplemented.
- AC 7: explicit null before an owned title and trailing null survive with one changed title and stable repeated document saves. Direct decision storage proof likewise reparses and is stable (/private/tmp/back-748-decision-null-evidence.json).
- AC 8: CLI/HTTP/MCP document refusal and decision HTTP refusal preserve exact original bytes/path; valid unknown-to-unknown references still work. Decision status-only edits retain existing text behavior.
- AC 9: preserved merge restoring cleared tags is refused instead of silently undoing the update. Parsed canonical owned fields, including absence, are the comparison target.
- DoD: bun test --timeout=10000 across the 12 affected files: 361 pass, 0 fail, 1281 assertions (/private/tmp/back-748-focused-revision.log). bun run check:types: no errors in 567 files (/private/tmp/back-748-types-revision.log). bun run check .: 462 files checked, no fixes (/private/tmp/back-748-biome-revision.log). bun run build: exit 0 (/private/tmp/back-748-build-revision.log). Fresh compiled CLI null/reference/merge results: /private/tmp/back-748-built-bounded-evidence.json.
Subtraction pass kept one Markdown source-span implementation and one core refusal conversion, with no dependencies, config, new public data fields, reference semantics or task/draft behavior. BACK-733 remains open. A temporary incomplete-body decision check exposed the same pre-existing empty-section repetition in the baseline serializer; it is outside this frontmatter fix and was not changed (/private/tmp/back-748-decision-empty-baseline.json).

2026-10-19: Reopened after the confirmed PR #1119 review finding (thread PRRT_kwDOO2LIE86t1VGe). On clean head 203b9582aabcc40adc5ad589da41f58d56d9d116, both FileSystem.saveDocument and CLI doc update with title/body edits return success and drop the exact standalone `# external owner` line before unknown `owner: team`. Evidence: /private/tmp/back-748-leading-comment-before.json; reproduction: /private/tmp/back-748-leading-comment-repro.ts. This is a defect in the existing comment-preservation promise. Prior green checks apply to the earlier head; affected AC/DoD are reopened for the source correction. The coordinator approved the narrow source-boundary plan. No public thread action, push or commit is included before correction review.

2026-10-19 comment-boundary correction verification: the exact review fixture loses its leading comment on 203b9582 via both storage and CLI (/private/tmp/back-748-leading-comment-before.json), then retains it after the six-line boundary adjustment (/private/tmp/back-748-leading-comment-after.json). Fresh compiled CLI and storage proof both preserve the comment exactly once after title/body edits and repeated saves (/private/tmp/back-748-leading-comment-compiled.json; both operations exit 0, repeatedStableApartFromEditTime true). The shared fixture also retains its nested-value comment, raw scalars, anchors and aliases across the existing CLI/HTTP/MCP/decision tests. Direct tests: 11 pass, 0 fail (/private/tmp/back-748-leading-comment-focused.log). Affected broader tests: 361 pass, 0 fail, 1282 assertions across 12 files (/private/tmp/back-748-leading-comment-broader.log). Canonical types: 567 files clean; Biome: 462 files clean; build: exit 0 (matching leading-comment types/biome/build logs under /private/tmp). git diff --check passed. Subtraction pass kept the single private helper and added only two fixture lines plus one repeat-count assertion; no new abstraction, dependencies, reference semantics, public policy or further supported defect found. Correction changes only the task record, src/markdown/frontmatter.ts and src/test/content-frontmatter-preservation.test.ts. Holding uncommitted for the focused correction review; affected AC/DoD remain open and previous green CI applies only to the earlier head.

2026-10-19: Adaptive review check confirmed the exact unknown multiline quoted note followed by an owned title succeeds and is stable at published 203b9582, but the uncommitted comment scan consumes the quoted closing line into the discarded owned span and throws. Evidence: /private/tmp/back-748-value-boundary-owned-before.json; actual baseline modules extracted to /private/tmp without changing the checkout. This is a verified regression introduced by this correction and falls within the approved review-cycle exception. The scan will stop at the preceding parser-reported value boundary; no broader YAML audit or new behavior is included.

2026-10-19: The first parser-end clamp fixes the confirmed quoted-scalar fixture and passes its new regression, but the focused suite reports 11 pass / 1 fail: the existing repeated CLI metadata test loses its leading owner comment after owned tags become a block sequence (/private/tmp/back-748-value-boundary-focused.log). Diagnosed reason: js-yaml collection node end includes following separator comments up to the next key; it is not the final value-content boundary. Stopped before another source patch and reported the distinction to the coordinator under the review-cycle guardrail. No broader verification or finalization is claimed for this intermediate version.

2026-10-19: Coordinator authorized the small generic range/content distinction inside the existing private Node bookkeeping. The full parser source range remains authoritative for copying, while child/leaf content supplies the protected boundary. Continuing only the quoted-value and list/comment regressions already confirmed; no broader YAML audit or added policy.

2026-10-19 final bounded correction review: KEEP on unchanged frontmatter SHA-256 e40e404c0f60b2fa49c6ffb46e335c7f02e3e8aafbf5c10660736f657b176ac6 and test SHA-256 6d7a22629e2c90d7e0d86abb647497d43156831ae3437b4df6e27d4bae4c1592. No new blocker, edit request or worthwhile simplification. Coordinator authorized task finalization and a three-file local correction commit after the following successful checks.

The private helper now keeps full node source ranges for copying and derives a separate child/leaf content boundary for the comment scan. This retains same-level leading comments without moving multiline quoted content into regenerated owned entries. The exact published-baseline/current quoted-value storage comparison is /private/tmp/back-748-content-boundary-owned-after.json; both save/read back successfully and repeat stably. The original review comment fixture and quoted kept-to-discarded fixture both pass through the fresh compiled CLI with two exit-0 updates and stable results apart from edit time (/private/tmp/back-748-content-boundary-compiled.json). The original leading comment appears once; quoted note text and raw closing line remain intact.

Current verification: 12 focused tests pass, 79 assertions (/private/tmp/back-748-content-boundary-focused.log). All 362 affected broader tests pass, 1285 assertions across 12 files (/private/tmp/back-748-content-boundary-broader.log). bun run check:types: 567 files clean (/private/tmp/back-748-content-boundary-types.log). bun run check .: 462 files clean (/private/tmp/back-748-content-boundary-biome.log). bun run build: exit 0 (/private/tmp/back-748-content-boundary-build.log). git diff --check passes. Existing null/reference refusal and owned-field merge contracts remain covered and green.

Subtraction pass retained one parser/source-span owner with two distinct internal boundaries and only the confirmed quoted-value regression plus the shared leading-comment fixture. No new syntax, dependency, policy, public behavior, task/draft work or broad audit. The intermediate failed clamp and its diagnosis remain in the history above. Source changes require new CI for the correction commit; prior product CI was for 203b9582.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Document and decision updates automatically preserve unknown frontmatter, including raw YAML values, nested comments and leading field comments. Parser-derived content boundaries keep multiline quoted values intact while the full source ranges remain available for copying. Saves that would break references or undo owned-field changes still fail before writing or moving files.

Verified the original review fixture and quoted-value regression against published baseline behavior and fresh compiled CLI saves, including repeated saves. All 362 affected tests, canonical type/Biome/build checks and final bounded KEEP review pass. Superseded configured-field plans remain reconciled; task/draft preservation remains future work in BACK-747.
<!-- SECTION:FINAL_SUMMARY:END -->
