---
id: BACK-738
title: Add superseded_by and updated_date to decisions
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 19:09'
updated_date: '2026-10-28T22:29:00Z'
labels:
  - enhancement
dependencies:
  - BACK-737
  - BACK-727
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
  - 'https://github.com/MrLesk/Backlog.md/issues/1068'
  - src/types/index.ts
  - src/markdown/parser.ts
  - src/markdown/serializer.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/formatters/json-output.ts
  - src/server/index.ts
  - src/guidelines/agent-guidelines.md
modified_files:
  - src/test/decision-supersession.test.ts
  - src/types/index.ts
  - src/markdown/parser.ts
  - src/markdown/serializer.ts
  - src/core/backlog.ts
  - src/formatters/json-output.ts
  - src/server/index.ts
  - src/cli.ts
  - src/markdown/frontmatter.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/overview.md
  - src/test/cli-json-output.test.ts
  - src/test/cli-decision-status.test.ts
  - src/test/server-decision-sections.test.ts
  - src/test/content-frontmatter-preservation.test.ts
type: enhancement
ordinal: 356000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a decision is replaced by a newer one, nothing in the old record points to its replacement. `backlog decision list` cannot show which decision took over, and a reader of the old decision cannot find its successor (issue #1068). BACK-737 provides the shared update path and preserves unknown frontmatter. This task gives the replacement link explicit product meaning.

Alex's later approved preservation policy keeps unknown frontmatter keys and their source text. Decisions gain two known keys. `superseded_by` holds the ID of the one decision that replaces this one; it is set with `--superseded-by <id>` on `backlog decision edit` and shown by `backlog decision list`. `updated_date` records when the decision last changed, as tasks and documents already record on every edit; decisions become editable with this work and had no such key. No other keys are added, and nothing is added for documents.

Setting the link does not change the status. The status is set with `-s`, in the same command if wanted; the values it accepts are covered by BACK-745. Whether and how a link can be removed again is settled during plan review.

Depends on BACK-737 (the core decision update that every interface uses) and BACK-727 (which adds `backlog decision edit`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog decision edit <id> --superseded-by <otherId>` writes `superseded_by: <otherId>` to the frontmatter of the decision and changes nothing else in the file apart from `updated_date`.
- [x] #2 `--superseded-by` with an ID that does not identify exactly one existing decision, or that names the decision being edited, exits non-zero with a clear message and changes no file.
- [x] #3 `--superseded-by` can be combined with `-s` in one command, and used alone it leaves the status unchanged.
- [x] #4 `backlog decision list --plain` shows the ID of the replacing decision for each decision that has `superseded_by`, and the `--json` output includes the value.
- [x] #5 Every decision update that changes the record sets `updated_date` in its frontmatter, through the CLI and the web API alike.
- [x] #6 `superseded_by` and `updated_date` survive every later update from any interface, including a web save that does not mention them.
- [x] #7 Unknown frontmatter keys and their source text survive writes, following the later approved preservation policy.
- [x] #8 `backlog decision edit --help` and the shipped instruction guides (`backlog instructions`) describe `--superseded-by`.
- [x] #9 Tests cover setting the link, the rejected IDs, the list output and both keys surviving a later update.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved by Alex in the decision-content-loss plan on 2026-10-28. Add optional supersededBy and updatedDate to the shared decision model/parser/serializer. Resolve a nonempty replacement ID through the existing active/archive identity lookup while the edited record is locked; refuse missing, ambiguous and self links, store its canonical identity, and let an empty value clear it without changing status. Every shared update that changes the record, including marker migration, sets updated_date; a no-op keeps it. Expose --superseded-by on decision edit and show the link in plain/versioned JSON lists and HTTP data. Preserve the link on omitted fields and all unknown metadata. Update CLI help and shipped instructions. Add focused CLI/core/HTTP tests for link validation, clearing, timestamp/no-op semantics and preservation; run types, Biome and relevant tests; obtain required reviews and address Codex comments before merging after BACK-737.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC #7 and the description were stale: their unknown-key-dropping policy was superseded by Alex's later preservation ruling and the approved plan in this chat. Reconciled them to preserve unknown metadata. Alex explicitly approved clearing superseded_by with an empty --superseded-by value.

Implemented replacement links through the shared locked update: canonical identity, missing/ambiguous/self refusal, empty-value clearing, independent status, list/HTTP exposure, and change-only timestamps including marker migration. Unknown metadata and all unmanaged content remain intact. Regression tests first failed (7 missing-feature failures); focused suite then passed 84 tests. Additional locking, archive, preflight and shared metadata suite passed 76 tests. Cold and full-context reviews found a standalone header comment loss, including on a later timestamp update; both regressions failed before their fixes. Final affected suite passed 77 tests, with distinct timestamp updates and byte-exact preservation comparisons. Both reviews confirmed no remaining blockers. Own acceptance and quality review complete. Current repository check:types uses bun --check (the task's bunx tsc wording is stale): types and Biome pass, compiled build passes. GitHub CI and Codex review are required before the authorized merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision edits can set or clear a validated replacement link without changing status. Changes update updated_date; unchanged saves remain byte-identical. The link and unknown metadata survive later CLI and HTTP edits, including repeated timestamp changes. CLI help, shipped instructions and plain/versioned JSON lists expose the supported behavior. Validation: 84 focused tests, 76 additional tests, and 77 affected tests after review fixes; types, Biome and build pass. Required simplicity and complexity reviews completed without remaining blockers.
<!-- SECTION:FINAL_SUMMARY:END -->
