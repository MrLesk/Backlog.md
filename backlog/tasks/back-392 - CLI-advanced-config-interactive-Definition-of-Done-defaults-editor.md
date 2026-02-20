---
id: BACK-392
title: 'CLI advanced config: interactive Definition of Done defaults editor'
status: To Do
assignee: []
created_date: '2026-02-20 23:29'
labels: []
dependencies: []
references:
  - src/commands/advanced-config-wizard.ts
  - src/commands/configure-advanced-settings.ts
  - src/cli.ts
  - src/file-system/operations.ts
  - src/test/enhanced-init.test.ts
  - src/test/definition-of-done.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: after moving init/config prompts to Clack, Definition of Done defaults still require manual config edits or Web UI settings.
What: extend advanced config wizard flows to support interactive editing of definition_of_done using a guided list editor (add/remove/reorder/clear with preview), and persist ordered values to config.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Advanced config flow includes an explicit Definition of Done defaults step in both init advanced setup and standalone advanced configuration command path.
- [ ] #2 Definition of Done step uses guided list editing with add, remove by index, reorder, clear all, and done actions.
- [ ] #3 Existing Definition of Done defaults are prefilled when present; empty config starts from an empty list.
- [ ] #4 Saved Definition of Done values are trimmed, non-empty, and order-preserving in config serialization.
- [ ] #5 Wizard cancel and back behavior remains consistent with existing Clack navigation semantics.
- [ ] #6 Automated tests cover init flow, standalone advanced config flow, and config round-trip persistence for Definition of Done defaults.
- [ ] #7 Help and docs text for advanced config is updated to mention the Definition of Done configuration path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
