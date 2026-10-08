---
id: BACK-699
title: Apply the configured default reporter when creating tasks
status: Done
assignee:
  - '@codex-default-reporter'
created_date: '2026-09-27 22:43'
updated_date: '2026-09-27 22:55'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/941'
  - 'https://github.com/MrLesk/Backlog.md/pull/962'
modified_files:
  - src/core/backlog.ts
  - src/test/core.test.ts
type: bug
ordinal: 329000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a project already configures default_reporter, task and draft creation must preserve that value in the existing reporter field through the shared creation path. Repair and retain contributor PR #962 within its stated option-1 scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tasks and drafts created through the shared creation path inherit the configured default_reporter and preserve it when loaded.
- [x] #2 Creation without a configured default reporter retains current behavior.
- [x] #3 The contribution retains its original authorship and adds no reporter override, new setting, or unrelated feature.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Retain PR #962 and contributor commit dc993eaadcef95a0d37e9ec5afe762c01c004fdc (bjohas <bjohas+git@gmail.com>), including its existing four-line Core implementation and focused tests. Integrate only after the shared source writer releases the files; preserve original commit authorship and history.
2. Apply the configured value in Core.createTaskFromInput, shared by canonical task/draft CLI creation and adapters. Keep the existing config parser/serializer, reporter field, and unset-config behavior. Do not add a reporter override, config get/set exposure, setting, or UI field.
3. Extend the contributor tests only where coverage is missing: explicitly reload the configured draft, and create/reload an unset-config draft. Keep the configured task round-trip and unset task assertions.
4. Run focused defaultReporter tests, then the complete core test file and relevant existing config/JSON output tests. Use the source CLI in an isolated temporary project to set the existing default_reporter config entry, create tasks and drafts, verify persisted Markdown/plain/JSON reporter output, and verify unset-config creation remains unchanged.
5. Run bunx tsc --noEmit and bun run check .; inspect the final diff for unnecessary changes. Record objective evidence, then repair the existing PR title to BACK-699 - Apply the configured default reporter when creating tasks and its body with issue #941 option-1 scope and contributor attribution when public mutation is authorized.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Retained PR #962 and the contributor implementation from dc993eaadcef95a0d37e9ec5afe762c01c004fdc, authored by bjohas <bjohas+git@gmail.com>. The four production lines are unchanged. Added explicit saved-draft coverage with a configured default and an unset default. No reporter override, setting, config get/set exposure, or UI field was added.

The existing default_reporter config parser and serializer feed the shared creation path. Existing reporter Markdown, plain output, and JSON behavior are reused. Task and draft creation preserve the configured reporter when reloaded; missing defaults leave reporter absent.

Verification used Bun 1.3.14: focused defaultReporter tests passed (2 tests, 8 assertions); core, filesystem, enhanced-init, and CLI JSON suites passed (171 tests, 532 assertions); bun x tsc --noEmit passed; bun run check . passed (435 files); git diff --check passed.

Actual CLI controls used two isolated filesystem-only projects. With default_reporter: "@dana", task create and draft create persisted reporter in both Markdown files and displayed it in plain output; task view --json returned "@dana". Without the setting, neither record nor plain output had reporter, and task JSON returned null. Draft view has plain output only; no new output mode was added.

Architecture and simplicity review approved the existing implementation unchanged, with no blocker or useful simplification. Contributor publication preserves the original commit in the integration ancestry. The final diff is restricted to the shared creation path, its tests, and this task record.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
New tasks and drafts now inherit the existing configured default_reporter and preserve it when loaded. Creation without a default keeps its previous behavior. Retained the contributor implementation and authorship, adding only draft round-trip coverage. All 171 related tests, focused reporter tests, actual configured/unset CLI controls, TypeScript, and Biome passed. Architecture review found no further changes.
<!-- SECTION:FINAL_SUMMARY:END -->
