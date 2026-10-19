---
id: BACK-603
title: Align create and draft flag handling with the edit path
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 17:05'
labels: []
dependencies: []
ordinal: 242000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The create path diverges from the hardened edit path: repeated -l/--labels flags keep only the last value on task create and draft create (edit collects all of them), and empty --dep/--ref values are silently accepted or dropped on create where edit rejects them with a clear validation error. There is also a dependsOn/dep alias quirk on the create path. Each of these was confirmed 2-3 times independently across the Aug 2026 review rounds. Align create and draft with the edit path by reusing the same shared validation and collection helpers instead of duplicating logic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Repeated label flags on task create and draft create collect all values, matching edit
- [x] #2 Empty --dep and --ref values on create and draft fail with the same clear validation error as edit
- [x] #3 Create, draft and edit share the same helpers for these validations (no duplicated logic)
- [x] #4 Tests cover the create and draft parity cases
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the three defects live against a scratch project (done): `task create -l a -l b` and `draft create -l a -l b` keep only the last label; `task create --dep ""` / `--ref ""` / `--doc ""` exit 0 and silently drop the value; `task create --depends-on TASK-1 --dep TASK-2` stores only TASK-1 because the create path uses `options.dependsOn || options.dep` while edit concatenates both.
2. Make `-l, --labels` collecting on `task create` and `draft create` with the shared `createMultiValueAccumulator()`; `parseDelimitedStringList` already splits commas, so comma-separated values keep working.
3. Replace the create path's `options.dependsOn || options.dep` alias merge with the edit path's `[...toStringArray(options.dependsOn), ...toStringArray(options.dep)]` so both spellings merge instead of one silently winning.
4. Reuse `validateClearableListInput` on the create path for dependencies, --ref and --doc (the three lists edit validates; --modified-file is left alone because edit does not validate it either). Make `clearFlag` optional in that helper so create keeps edit's identical problem sentence without advertising --clear-* flags create does not have.
5. Leave `draft create` flag surface unchanged (it has no --dep/--ref/--doc), so the draft parity case for empty list values is `task create --draft`.
6. Align the create help schema label wording with the edit convention (repeat -l or use label1,label2).
7. Tests: repeated + comma labels on create (cli-init-create.test.ts) and draft create (draft-create-consistency.test.ts); empty --dep/--ref/--doc rejection on create and on create --draft asserting the same problem sentence as edit (cli-dependency.test.ts, cli-refs-docs.test.ts); dependsOn/dep merge on create.
8. Verify with bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root causes found in src/cli.ts:
- `task create` and `draft create` declared `-l, --labels <labels>` without a Commander collector, so Commander overwrote the value on each repetition and only the last label survived. `parseDelimitedStringList` already split commas, which is why comma-separated values worked and repeated flags did not.
- The create path never validated list flag values. `--dep ""`, `--ref ""` and `--doc ""` normalized to an empty list and were dropped silently with exit code 0, while the edit path rejected them through `validateClearableListInput`.
- The dependsOn/dep alias quirk: create merged the two spellings with `options.dependsOn || options.dep`. Because the collectors always produce a non-empty array when the flag is present, `--depends-on` always won and every `--dep` value was silently discarded (`--depends-on TASK-1 --dep TASK-2` stored only TASK-1). Worse, `--depends-on "" --dep TASK-2` selected `[""]`, so the valid `--dep` value vanished and the task was created with no dependencies. The edit path already concatenated both spellings.

Changes:
- `-l, --labels` now uses the shared `createMultiValueAccumulator()` on `task create` and `draft create`; `parseDelimitedStringList` keeps splitting commas, so comma-separated, repeated and mixed forms all collect.
- The create path now merges dependency spellings exactly like edit: `[...toStringArray(options.dependsOn), ...toStringArray(options.dep)]`.
- Extracted `validateTaskListFlags(options, { supportsClearFlags })` so create and edit run one implementation of the dependency/reference/documentation list validations. Edit passes true, create false. `validateClearableListInput` now takes an optional `clearFlag`: create keeps the identical problem sentence ("Cannot use an empty value with --depends-on or --dep") but ends with "Omit the flag to leave task dependencies unset." instead of pointing at --clear-deps, which create does not have.
- `--doc` is validated on create too because edit validates it; `--modified-file` is deliberately left alone because edit does not validate it either.
- `draft create` exposes no --dep/--ref/--doc flags (Commander rejects them as unknown options), so no flags were added; the draft parity case for empty list values is `task create --draft`, which shares the create action and is covered by tests.

Verification: all 8 new assertions confirmed failing with src/cli.ts stashed and passing with the fix. Live checks in a scratch project covered repeated/comma/mixed labels on create and draft create, empty --dep/--depends-on/--ref/--doc on create and on create --draft, --depends-on + --dep merging, and an edit-path regression sweep (empty --dep/--ref/--doc/--add-ref/--remove-ref, all three --clear-* conflicts, --ref with --add-ref, repeated labels, clear flags) confirming edit messages and behavior are byte-identical to before.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned task create and draft create with the hardened edit path in src/cli.ts. -l/--labels now collects repeated flags on both create commands (comma-separated values unchanged), create merges --depends-on and --dep instead of letting --depends-on silently discard --dep, and create rejects empty --dep/--ref/--doc values through the same validation used by edit, extracted into a shared validateTaskListFlags helper. The create error keeps edit's exact problem sentence and swaps only the remedy, because create has no --clear-* flags. Verified with new tests in cli-init-create, draft-create-consistency, cli-dependency and cli-refs-docs (all 8 new assertions confirmed failing before the fix), live CLI scenarios on a scratch project, an edit-path regression sweep showing unchanged messages, bunx tsc --noEmit and bun run check . clean, and bun run test green (2069 pass, 6 skip, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
