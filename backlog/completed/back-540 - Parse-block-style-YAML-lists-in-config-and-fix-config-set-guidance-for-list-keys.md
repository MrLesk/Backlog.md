---
id: BACK-540
title: >-
  Parse block-style YAML lists in config and fix config set guidance for list
  keys
status: Done
assignee:
  - '@claude'
created_date: '2026-07-12 14:59'
updated_date: '2026-07-12 15:14'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
parseConfig is a hand-rolled line parser that only accepts inline flow arrays ([a, b]) for statuses, labels, types, priorities and milestones; block-style YAML sequences (- item lines) are silently dropped, so users hand-editing config.yml (the intended path for user-defined priorities BACK-530 and task types BACK-355) get defaults back with no error and task create --priority fails. Related guidance copy is wrong: config set priorities/statuses/labels points at a nonexistent backlog config list-<key> command, config set types answers Unknown config key even though types is a valid readable key, and the available-keys lists shown by config get and config set disagree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 config set for every non-settable list key (including types) explains it cannot be set directly and references only commands that exist
- [x] #2 config get and config set report the same available-keys list
- [x] #3 Block-style YAML sequences for statuses, labels, types and priorities parse identically to inline arrays (covered by tests)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Parse statuses/labels/types/priorities from the whole config document with the same gray-matter YAML approach parseDefinitionOfDone already uses; prefer the YAML result and keep the inline-bracket line parse only as fallback for legacy not-quite-YAML files. Block sequences, quoted values, and commas inside quoted items then parse correctly.
2. Fix config set guidance: array keys (including types) get the same 'cannot be set directly, edit config.yml; view with backlog config get <key>' message referencing only real commands; reconcile the available-keys lists between config get and config set.
3. Tests: parseConfig block-style vs inline equivalence for all four keys, quoted-comma items, legacy fallback; CLI-level test for config set guidance copy. Verify live with a throwaway project (block-style priorities then task create --priority).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parseConfig now resolves statuses/labels/types/priorities via the same gray-matter YAML pass parseDefinitionOfDone already uses (block sequences, quoted values, and commas inside quoted items all work); the inline-bracket line parse remains as fallback for legacy not-quite-YAML configs. config set: types added to the array-key case, guidance now points to 'backlog config get <key>' and the config file (the old copy referenced a nonexistent list-<key> command), and both unknown-key errors share one CONFIG_AVAILABLE_KEYS constant. Verified via 4 new tests incl. end-to-end block-style priorities through config get and task create --priority; 52 tests across 6 config-adjacent suites pass, tsc and biome clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hand-edited config.yml with block-style YAML lists was silently ignored for statuses/labels/types/priorities, breaking the intended human path for user-defined priorities and task types, and config set gave wrong guidance (nonexistent command, types reported as unknown, mismatched key lists). List keys now parse through the real YAML parser with the legacy line parse as fallback, and the guidance copy references only real commands with one shared available-keys list. Verified with parser-equivalence and end-to-end CLI tests.
<!-- SECTION:FINAL_SUMMARY:END -->
