---
id: BACK-804
title: Preserve custom config keys and comments when saving settings
status: Done
assignee:
  - '@codex'
created_date: '2026-11-16T21:14:00Z'
updated_date: '2026-11-16T21:26:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1172
  - src/file-system/operations.ts
  - src/test/config-commands.test.ts
  - src/file-system/config-serialization.ts
modified_files:
  - src/test/config-commands.test.ts
  - package.json
  - bun.lock
  - src/file-system/config-serialization.ts
  - src/file-system/operations.ts
priority: high
type: bug
ordinal: 408000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Any normal config save currently rebuilds config.yml from recognized fields and removes custom metadata and comments. Reproduced on main at 373a16dd with a custom release_channel key and a comment: changing maxColumnWidth removes both. The shared writer must retain user-owned config content across CLI, init and browser settings saves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Saving a supported setting preserves unknown top-level keys, nested values and YAML comments in an existing config file.
- [x] #2 Known settings can still be added, changed and cleared, including existing config key aliases, without reviving an old value.
- [x] #3 New configs retain the supported values and defaults, and existing strict value parsing remains in place.
- [x] #4 If an existing config cannot be safely rewritten, saving reports the error and leaves the file unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce custom-key/comment loss in saveConfig and the real config set command.
2. Update the existing YAML document through the explicitly pinned yaml dependency. Preserve custom entries, comments, setting aliases and legacy milestone migration; decode YAML scalar escapes/comments in the existing reader so saved values reload correctly. Refuse unsafe rewrites before writing.
3. Verify config/init/migration/hostname and DoD coverage, types, Biome, a compiled build and smoke test. Complete cold and separate context complexity reviews and publish the PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold and separate context complexity reviews are complete. All four cold findings were reproduced in tests and corrected: uncached scalar reads, escaping/comments, inherited custom key names and custom YAML references. The full suite found a pre-existing one-line JSON escape contract for multiline DoD items; retain it with the yaml doubleQuotedAsJSON option rather than changing the test.

Final validation: 155 tests pass across config-commands, config-migration, config-watcher, enhanced-init, prefix-migration, filesystem and server-hostname. After retaining one-line JSON escaping, 69 tests pass across MCP DoD defaults, config commands, core DoD and server DoD. Types, Biome, native build and compiled smoke pass. The broader suite is still running; its observed escape-format failure is fixed and covered by the 69-test pass. Cold findings were rechecked with no blockers; context complexity review has no blockers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shared config saves now update a YAML document instead of rebuilding known lines. Custom keys, nested values and comments survive; settings still add/change/clear, and malformed documents or reference changes are refused before writing. Scalar reading handles preserved comments and YAML escaping. Focused regressions, init/migration coverage, types, Biome, compiled smoke and required reviews pass.
<!-- SECTION:FINAL_SUMMARY:END -->
