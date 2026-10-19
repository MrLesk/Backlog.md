---
id: BACK-749
title: Keep configured custom keys when a decision is written
status: To Do
assignee: []
created_date: '2026-10-11 19:35'
updated_date: '2026-10-18 19:45'
labels:
  - enhancement
dependencies:
  - BACK-733
  - BACK-746
  - BACK-747
  - BACK-737
  - BACK-738
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1091'
type: enhancement
ordinal: 367000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Writing a decision rebuilds its frontmatter from the keys Backlog knows (id, title, date and status), so any other top-level key is dropped (issue #1091). Today only the web save writes a decision. BACK-737 gives decisions one update path that every interface uses, and with `backlog decision edit` decisions will be written far more often, each write dropping such keys.

The maintainer's ruling on issues #918 and #1091 is that Backlog does not keep unknown keys implicitly; it keeps the keys a project lists in its config. Decisions have their own list (working name `decision_custom_fields`, added by BACK-746; the exact key name is settled during plan review). A key named there survives every write of a decision. A key that is not in the list keeps being dropped as today.

A kept key is written back exactly as the user wrote it: Backlog keeps the key's own frontmatter lines and does not write a parsed value back, by the same rule BACK-747 introduces for tasks and drafts. Decisions reuse that rule; they do not get a second implementation.

`superseded_by` and `updated_date` are known decision keys added by BACK-738. They keep their own meaning and their own command options, are reserved in the decision list, and never go through this rule.

This first version only keeps the keys. Setting or clearing them through the CLI or web UI is not part of it, and showing them on read surfaces is covered by separate tasks. Removing a name from the list needs no migration: files keep the key until their next write and lose it then.

Depends on BACK-733 (the frontmatter writer no longer reads the body again), BACK-746 (the config list and its reserved names), BACK-747 (the shared rule for keeping the lines of a key), BACK-737 (the single decision update path, so the rule is added in one place) and BACK-738 (the known decision keys).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With `decision_custom_fields: [depends_on]` set (working name), a decision file that contains `depends_on: [example]` still contains that line byte for byte after every decision update, through `backlog decision edit` and through `PUT /api/decisions/:id`.
- [ ] #2 Values are never rewritten: a configured key written as a bare date, a number such as `1.10` or `007`, a flow list or a nested block has exactly the same lines after any write.
- [ ] #3 The kept lines follow the keys Backlog writes, in the order of the config list; the sections and the text outside them are written as BACK-737 defines.
- [ ] #4 `superseded_by` and `updated_date` behave as BACK-738 defines, and naming either in the decision list is rejected with the existing config error, as is any other name reserved for decisions such as `status`; no decision file is changed.
- [ ] #5 A key that is in the file but not in the list is still dropped on the next write.
- [ ] #6 Removing a name from the list makes it an unconfigured key again: no file is rewritten because of the config change, and each file that carries the key loses it on its next write.
- [ ] #7 The task and document lists have no effect on decision files.
- [ ] #8 The configuration reference states that the list keeps these keys for decisions.
- [ ] #9 Tests cover a kept key across a CLI edit and an HTTP update, the value shapes named above, an unlisted key being dropped, and removing a name from the list.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18: Consolidated into BACK-748: Alex's 2026-10-18 decision requires automatic unknown-key preservation for documents and decisions. The old decision_custom_fields plan and future decision-feature dependencies are superseded. Existing HTTP full saves and CLI status edits are the current scope. This task is archived unimplemented, not Done; its original configured-only specification remains historical evidence.
<!-- SECTION:NOTES:END -->
