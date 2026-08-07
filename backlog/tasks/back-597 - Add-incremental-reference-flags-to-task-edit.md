---
id: BACK-597
title: Add incremental reference flags to task edit
status: To Do
assignee:
  - '@claude'
created_date: '2026-08-07 21:36'
labels:
  - cli
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/856'
priority: medium
type: enhancement
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix GitHub issue #856: `backlog task edit --ref` replaces the entire references array and the CLI has no way to add or remove a single reference while preserving the others. Reported against 1.49.3: after `task create "Reference probe" --ref seed:a --ref seed:b`, running `task edit task-1 --ref added:c` leaves references as `[added:c]`, and `task edit --help` documents no add/remove reference flags.

Surface drift: the manifesto makes the CLI canonical and names surface consistency as a design principle, but the optional MCP adapter already exposes safer incremental mutations that CLI users cannot perform. The public MCP `task_edit` schema exposes `addReferences` and `removeReferences`, and the shared task-update model implements them (additions preserve existing references and do not duplicate, removals match reference values and leave unrelated entries unchanged). Expose those same shipped model operations through `task edit` as `--add-ref` and `--remove-ref` rather than reimplementing merge semantics; `--ref` stays the explicit replace-all operation.

Why it matters beyond convenience: adding one reference today requires an external read, merge, and full-array replacement. A concurrent writer between the read and the edit is silently discarded. This is a different boundary of the lost-update hazard than the task-edit locking work in issue #843, which cannot make a client-side read part of the same critical section.

Conventions to follow: repeated and comma-separated values via the existing multi-value flag convention, and the clearable-list rules established by BACK-586 (issue #861) - the new flags must join the interactive-wizard predicate, reject blank occurrences with an error naming the clear flag, and be mutually exclusive with `--clear-refs`. BACK-586 implementation notes explicitly anticipated this follow-up.

Scope: references only. Documentation has the identical drift (MCP exposes addDocumentation/removeDocumentation with no CLI equivalent); record it as a follow-up observation, do not implement it here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task edit --add-ref adds references while preserving existing references and does not create duplicates
- [ ] #2 task edit --remove-ref removes references by value and leaves unrelated references unchanged
- [ ] #3 Both flags accept repeated occurrences and comma-separated values like other multi-value task edit flags
- [ ] #4 Blank --add-ref or --remove-ref values are rejected with a non-zero exit and the task is left unchanged
- [ ] #5 --clear-refs cannot be combined with --add-ref or --remove-ref, and invalid input does not mutate the task
- [ ] #6 The interactive-TTY edit wizard predicate includes the new flags so they apply directly instead of opening the wizard
- [ ] #7 --ref still replaces the full reference list and CLI help documents --add-ref and --remove-ref
- [ ] #8 Regression tests cover add and remove semantics, repeated and comma forms, blank rejection, the clear conflict, the interactive-TTY path, and unchanged MCP task_edit reference behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
