---
id: BACK-738
title: Add superseded_by and updated_date to decisions
status: To Do
assignee: []
created_date: '2026-10-11 19:09'
updated_date: '2026-10-11 19:24'
labels:
  - enhancement
dependencies:
  - BACK-737
  - BACK-727
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
  - 'https://github.com/MrLesk/Backlog.md/issues/1068'
type: enhancement
ordinal: 356000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a decision is replaced by a newer one, nothing in the old record points to its replacement. `backlog decision list` cannot show which decision took over, and a reader of the old decision cannot find its successor (issue #1068). A link added to the file by hand does not survive: writing a decision rebuilds its frontmatter from a fixed list of keys (id, title, date and status), and any other key is dropped without notice.

The maintainer's ruling on issue #1065 is that unknown frontmatter keys keep being dropped for every record type, and that decisions gain two known keys. `superseded_by` holds the ID of the one decision that replaces this one; it is set with `--superseded-by <id>` on `backlog decision edit` and shown by `backlog decision list`. `updated_date` records when the decision last changed, as tasks and documents already record on every edit; decisions become editable with this work and had no such key. No other keys are added, and nothing is added for documents.

Setting the link does not change the status. The status is set with `-s`, in the same command if wanted; the values it accepts are covered by BACK-745. Whether and how a link can be removed again is settled during plan review.

Depends on BACK-737 (the core decision update that every interface uses) and BACK-727 (which adds `backlog decision edit`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog decision edit <id> --superseded-by <otherId>` writes `superseded_by: <otherId>` to the frontmatter of the decision and changes nothing else in the file apart from `updated_date`.
- [ ] #2 `--superseded-by` with an ID that does not identify exactly one existing decision, or that names the decision being edited, exits non-zero with a clear message and changes no file.
- [ ] #3 `--superseded-by` can be combined with `-s` in one command, and used alone it leaves the status unchanged.
- [ ] #4 `backlog decision list --plain` shows the ID of the replacing decision for each decision that has `superseded_by`, and the `--json` output includes the value.
- [ ] #5 Every decision update that changes the record sets `updated_date` in its frontmatter, through the CLI and the web API alike.
- [ ] #6 `superseded_by` and `updated_date` survive every later update from any interface, including a web save that does not mention them.
- [ ] #7 Frontmatter keys outside the known list are still dropped on write, as before.
- [ ] #8 `backlog decision edit --help` and the shipped instruction guides (`backlog instructions`) describe `--superseded-by`.
- [ ] #9 Tests cover setting the link, the rejected IDs, the list output and both keys surviving a later update.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
