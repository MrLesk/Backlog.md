---
id: BACK-614
title: Let the web create form express an explicitly unassigned task
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 13:49'
updated_date: '2026-08-09 14:05'
labels: []
dependencies: []
ordinal: 253000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved by Alex 2026-08-09. Since BACK-604, the web create modal omits the assignee field when the chip input is blank so defaultAssignee still applies, which means the create form cannot express "explicitly unassigned" while a default is configured (edit can, via empty list). Suggested minimal mechanism, verify feasibility during planning: when defaultAssignee is configured, pre-fill the create form assignee field with the default as a removable chip; if the user removes it, the form sends an explicit empty list (unassigned); if they leave it, the default applies. No new UI copy or controls beyond the prefilled chip; keep the no-default behavior unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With defaultAssignee configured, a user can create an explicitly unassigned task from the web create form
- [x] #2 Leaving the form untouched still applies defaultAssignee; projects without a default are unchanged
- [x] #3 Edit-mode clearing behavior is unchanged
- [x] #4 Tests cover the three states: default applied, explicitly unassigned, explicit assignee
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify the mechanism is feasible: /api/config already returns the whole BacklogConfig (server handleGetConfig), App.tsx already holds it in state and passes config-derived props to TaskDetailsModal (availablePriorities, definitionOfDoneDefaults, dateFormat), so defaultAssignee reaches the modal as one more prop - no new endpoint.
2. Add a defaultAssignee?: string[] prop to TaskDetailsModal and pass defaultAssignee={config?.defaultAssignee} from App.tsx (same shape as availablePriorities, so the prop identity stays stable across renders instead of a fresh [] each time).
3. Prefill create mode: buildTaskDetailsFormState returns the configured default for assignee when isCreateMode and there is no task; feed the memoized default into the existing reset effect so a config that loads after the modal opens still prefills, while the existing preserveDirtyRefreshValue keeps a user edit (including a removal) untouched. No new UI: the existing ChipInput renders the prefilled values as its normal removable chips.
4. Payload shape: in create mode send assignee explicitly whenever a default was prefilled or the field has values; omit it only when no default is configured and the field is blank. Rationale: with the prefill the field is a faithful statement of intent, so [] means unassigned, [x] means explicit, and absent only happens for projects with no default - the three states stay unambiguous, and sending the prefilled values explicitly makes the created task match what the form showed. Edit mode keeps sending the field always.
5. Keep the create-mode unsaved-work check honest: hasCreateModeEntries must compare assignee against the prefilled default instead of length > 0, otherwise opening create with a default configured immediately looks dirty and prompts on close.
6. Tests: new src/test/web-task-details-modal-default-assignee.test.tsx rendering the modal in create mode and capturing the onSubmit payload - default applied untouched, explicit [] after removing the chips, explicit value when typed, and the no-default control that still omits the field; drive inputs with setNativeInputValue from src/test/react-dom-input.ts.
7. Verify: bunx tsc --noEmit, bun run check ., full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Mechanism confirmed feasible as suggested: GET /api/config already returns the whole BacklogConfig (server handleGetConfig), App.tsx holds it in state and already derives modal props from it, so defaultAssignee reaches the create form as one more prop - no new endpoint, no new UI, no new copy. The existing assignee ChipInput renders the prefilled values as its ordinary removable chips.

Payload shape decision: create sends the assignee list explicitly whenever a default was prefilled or the user typed something, and omits the field only when no default is configured and the field is blank. Sending the prefilled values rather than omitting them keeps the three create states unambiguous at the payload level ([] = unassigned, [names] = explicit, absent = project has no default) and makes the created task match exactly what the form showed, even if the config changed between page load and submit. Absent-vs-[] is already honored by core createTaskFromInput, so no server or core change was needed.

Two details the prefill forced: (1) the reset effect now takes the memoized default so a config that lands after the modal mounted still prefills, while the existing preserveDirtyRefreshValue keeps a user's edit - including a removal - across the config refresh that App triggers on every reload; (2) hasCreateModeEntries compares the assignee against the prefilled default instead of length > 0, so a pristine prefilled create form is not treated as unsaved work while a removal still is.

defaultAssignee is passed as config?.defaultAssignee (like availablePriorities) rather than config?.defaultAssignee ?? [], so the prop identity stays stable and the reset effect does not re-run on every App render.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web create form now pre-fills the assignee field with the configured defaultAssignee as ordinary removable chips, so removing them sends an explicit empty list and creates an unassigned task, while leaving them sends the default values and typing a name sends that name. Projects without a defaultAssignee still open with a blank field and still omit the field entirely. Edit mode is untouched: an opened task always shows its own assignees and an explicit empty list still clears them. Implemented by passing config.defaultAssignee from App.tsx into TaskDetailsModal (the existing /api/config response already carries it), seeding the create-mode assignee state from it, and narrowing the create payload's omit rule to 'blank field and no default configured'. Verified with a new src/test/web-task-details-modal-default-assignee.test.tsx (8 tests) that renders the modal and captures the submitted payload for every state: default applied untouched, explicit [] after the chips are removed, explicit name when typed, field omitted for a no-default project, plus the late-config prefill and the refresh-keeps-a-removal cases and an edit-mode guard. bunx tsc --noEmit clean, bun run check . clean, full bun run test green (2150 pass, 6 skip, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
