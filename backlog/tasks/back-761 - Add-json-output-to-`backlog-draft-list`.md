---
id: BACK-761
title: Add --json output to `backlog draft list`
status: Done
assignee:
  - '@claude'
created_date: '2026-10-12 00:37'
updated_date: '2026-10-12 00:52'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1100'
ordinal: 382000
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
1. Add draftListJson (kind draft-list, key drafts) beside taskListJson, reusing toTaskSummaryJson and cutListJson.
2. Add --json to draft list; in the action, branch on outputMode json after sorting: loadTaskListItems for isReady (same projection as task list), selectListWindow, printJson. Add a help schema.
3. Tests in cli-list-window.test.ts style: envelope, sort, windows, empty, --count with --json, --plain with --json.
4. Document in CLI-INSTRUCTIONS.md and shipped guides.
5. Run tsc, biome check, full tests; verify manually.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Drafts reuse loadTaskListItems, so each draft carries isReady computed like task list (draft dependencies are a known follow-up in BACK-601). Validation: bunx tsc --noEmit and bun run check . pass; cli-json-output and cli-list-window pass (29); full suite 2877 pass, 1 fail in config-commands "reads the config key at column 0", which fails identically without these changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added backlog draft list --json: a draft-list envelope (drafts array, same compact fields as task list, total/nextSkip only when cut) honoring --sort, --max-count and --skip, rejecting --count and --plain, with a help schema and CLI-INSTRUCTIONS.md updates. Verified by new CLI tests (envelope and order, empty list, sort, windows, invalid combinations, help) and a manual run.
<!-- SECTION:FINAL_SUMMARY:END -->
