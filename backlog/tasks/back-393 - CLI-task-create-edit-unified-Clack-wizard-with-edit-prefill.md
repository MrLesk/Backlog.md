---
id: BACK-393
title: 'CLI task create/edit: unified Clack wizard with edit prefill'
status: To Do
assignee: []
created_date: '2026-02-20 23:29'
labels: []
dependencies: []
references:
  - src/cli.ts
  - src/utils/task-edit-builder.ts
  - src/core/backlog.ts
  - src/test/test-helpers.ts
  - src/test/acceptance-criteria.test.ts
  - src/test/definition-of-done-cli.test.ts
  - src/test/cli-plain-create-edit.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: current task create/task edit require correctly composed args and fail fast when required positional args are missing, which hurts interactive UX.
What: add one shared wizard engine for both create and edit; task edit preloads current task values, and both commands use the same field and validation logic under the hood.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shared CLI task wizard implementation powers both create and edit flows.
- [ ] #2 In TTY, `backlog task create` opens the wizard by default.
- [ ] #3 In TTY, `backlog task edit` opens the wizard by default; with task ID it opens prefilled, and without task ID it shows a task picker then opens prefilled.
- [ ] #4 Wizard supports core field parity with existing CLI args: title, description, status, priority, assignee, labels, acceptance criteria, Definition of Done, plan, notes, references/docs, and dependencies.
- [ ] #5 Existing script and automation flows remain available via non-interactive mode and preserve current validation and error behavior.
- [ ] #6 Data mutations continue to use existing core create and edit pathways without changing task model semantics.
- [ ] #7 Automated tests cover create wizard happy path, edit wizard prefill path, edit-without-id picker path, non-interactive backward compatibility, and cancel/validation flows.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
