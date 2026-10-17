---
id: BACK-766
title: Add --json output to `backlog draft list`
status: Done
assignee:
  - '@claude'
created_date: '2026-10-14 18:17'
updated_date: '2026-10-14 18:24'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1100'
ordinal: 386000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scripts and agents that triage drafts must parse `draft list --plain` text, because `draft list --json` fails with "unknown option" while `task list --json`, `search` and `decision list` return versioned JSON. Issue #1100 tracks the request; every other list command already has the paging options, so JSON is the remaining gap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog draft list --json` prints a versioned JSON envelope of drafts, ordered like the plain output
- [x] #2 `--sort`, `--max-count` and `--skip` apply to the JSON output, which adds total and nextSkip only when the list is cut
- [x] #3 `--count` is rejected together with `--json`, and an empty draft list prints an empty JSON list
- [x] #4 Help schema, CLI-INSTRUCTIONS.md and shipped instruction guides document the option
- [x] #5 CLI tests cover JSON output, sorting, windows, the empty case and invalid combinations
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add draftListJson (kind draft-list, key drafts) beside taskListJson, reusing the shared compact task projection (toCompactTaskJson) and cutListJson.
2. Add --json to draft list; in the action, branch on outputMode json after sorting: selectListWindow over the sorted drafts, then printJson. Draft entries carry the compact task fields without isReady, because readiness is derived against tasks only. Add a help schema.
3. Tests in cli-list-window.test.ts style: envelope, sort, windows, empty, --count with --json, --plain with --json.
4. Document in CLI-INSTRUCTIONS.md and shipped guides.
5. Run tsc, biome check, full tests; verify manually.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Draft entries carry the compact task fields without isReady. Readiness is derived against tasks only, so a draft verdict would read false for draft-to-draft dependencies; isReady may be added later within schemaVersion 1 once BACK-601 defines draft dependencies. The envelope is draft-list and adds total/nextSkip only when the list is cut. An unreadable drafts folder behaves like task list (empty list, same in --json and --plain).

Adversarial review found that draft readiness was derived against tasks only; the maintainer answer on issue #1100 resolved it by omitting isReady from draft entries. Added a test for --skip past the end.

Maintainer follow-up: the shared projection is named CompactTaskJson/toCompactTaskJson (task entries are the compact fields plus isReady, draft entries the compact fields alone); the shipped overview and task-execution guides list `draft list` and `decision list` among the `--json` commands; the draft JSON test compares its order with `draft list --plain`.

Validation: bunx tsc --noEmit and bun run check . pass; cli-json-output and cli-list-window pass (29); full suite 2877 pass, 1 fail in ContentStore "refreshes completed identity state when the completed corpus changes", which passes when run alone (an unhandled jsdom error from a web test lands in it under full-suite load). config-commands "reads the config key at column 0" fails on main and when run alone here. Probed `draft list --json`, `--plain` and `--max-count 1` in a temporary project.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `backlog draft list --json`: a draft-list envelope (a drafts array with the compact task fields and no isReady, plus total/nextSkip only when the list is cut) honoring --sort, --max-count and --skip and rejecting --count and --plain. The command has a help schema; CLI-INSTRUCTIONS.md documents the envelope and fields, and the shipped CLI guides list `draft list` (and the previously missing `decision list`) among the --json commands. Verified by new CLI tests (envelope, order matching --plain, empty list, sort, windows, invalid combinations, help) and a manual run.
<!-- SECTION:FINAL_SUMMARY:END -->
