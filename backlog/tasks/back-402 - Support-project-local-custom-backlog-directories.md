---
id: BACK-402
title: Support project-local custom backlog directories
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-14 19:55'
updated_date: '2026-03-14 21:08'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/334'
  - 'https://github.com/MrLesk/Backlog.md/issues/215'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow Backlog.md to initialize and detect a project-local backlog folder from `backlog`, `.backlog`, or a project-relative directory configured in the user profile, while keeping runtime detection centralized and consistent across CLI, MCP, web, and Git branch scans.

Relevant implementation areas:
- `/Users/alex/projects/Backlog.md/src/file-system/operations.ts`
- `/Users/alex/projects/Backlog.md/src/utils/find-backlog-root.ts`
- `/Users/alex/projects/Backlog.md/src/core/task-loader.ts`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Runtime detection prefers `backlog/`, then `.backlog/`, then the profile-configured project-relative path, and treats missing directories as uninitialized.
- [x] #2 CLI `init` and web init both let the user choose `backlog`, `.backlog`, or profile-configured custom path; option 3 prompts for the relative path.
- [x] #3 If the profile config has a path but that folder does not exist in the current project, init preselects option 3 and shows a hint, while still allowing `backlog` or `.backlog`.
- [x] #4 Cross-branch checks, remote-branch checks, Git staging, ID generation, watchers, and asset/docs/decision paths all use the resolved backlog location.
- [x] #5 `.backlog` is no longer migrated to `backlog`, and no project config field is added for backlog directory.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a shared resolver for project-local backlog directories and profile-configured project-relative paths, including precedence `backlog/` -> `.backlog/` -> profile config.
2. Refactor filesystem, root discovery, and core helpers to use the resolved backlog directory instead of hardcoded `backlog` paths.
3. Update branch scanning, ID generation, Git staging, server/browser behavior, and init flows to use the shared resolver consistently.
4. Extend CLI init and web init to let users choose `backlog`, `.backlog`, or a profile-configured custom relative path, including the missing-folder preselection hint.
5. Add and update focused tests for detection precedence, init behavior, cross-branch path handling, and regression coverage for `.backlog` support.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation starting from central path resolution and filesystem loading to minimize churn across downstream call sites.

Implemented a shared backlog-directory resolver that detects `backlog/`, `.backlog/`, or a profile-configured project-relative folder and refactored filesystem/root discovery, branch scans, ID generation, and init flows to use it.

Validated with `bunx tsc --noEmit`, `bun run check .`, and `bun test src/test/find-backlog-root.test.ts src/test/config-hang-repro.test.ts src/test/enhanced-init.test.ts src/test/filesystem.test.ts`.

Follow-up implementation: make the profile config path platform-specific instead of always using ~/.config/backlog.md/config.yaml, and surface that resolved path in UI/server messaging.

Made the profile config path platform-specific: Unix-like systems use `~/.config/backlog.md/config.yaml`, while Windows uses `%APPDATA%\\backlog.md\\config.yaml` with a home-directory fallback to `AppData/Roaming`.

Surfaced the resolved profile config path in server status and web init UI so prompts no longer hardcode a Unix-only location.

Follow-up cleanup requested: remove the unused `.user` settings plumbing (`DEFAULT_FILES.USER`, FileSystem get/set user settings helpers, and their tests) since it is no longer a documented or reachable feature.

Removed the dead `.user` settings plumbing (`DEFAULT_FILES.USER` and the FileSystem get/set/load/save user settings helpers) along with its test coverage, since it was no longer reachable or documented.

Follow-up change requested: enable `noUnusedLocals` and `noUnusedParameters` in `tsconfig.json` and clean up any compiler issues so unused-code checks become part of the default TypeScript pass.

Enabled `noUnusedLocals` and `noUnusedParameters` in `tsconfig.json` and removed the dead locals/imports/helpers surfaced by the stricter compiler pass across CLI, tests, UI, and web components.

Updated `src/guidelines/mcp/task-creation.md` and `src/guidelines/mcp/task-execution.md` to clarify that local file/module context belongs in the task description, while the `references` field is for external links/issues and `documentation` is for design/spec materials.

Refined the MCP task-creation guidance so local file/module context in task descriptions is explicitly exceptional and minimal, while `references` remains external-only and `documentation` remains for design/spec material.

Follow-up implementation: add a non-interactive CLI init flag for backlog directory selection so scripted init can choose `backlog`, `.backlog`, or a custom relative path that is stored in the profile config.

Added `backlog init --backlog-dir <path>` for non-interactive CLI use. Built-in values `backlog` and `.backlog` map directly, custom relative paths are treated as the profile-backed option, and re-init rejects the flag because backlog location is immutable after initialization.

Validated direct non-interactive `.backlog` init with `backlog init --defaults --integration-mode none --backlog-dir .backlog`, which created `.backlog/config.yml` and the full `.backlog/` tree without any profile config involvement.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added shared project-local backlog directory resolution with precedence `backlog/` -> `.backlog/` -> profile-configured custom path from a platform-specific user profile config file, and removed the old `.backlog` migration behavior.

Updated CLI, shared init logic, and web init so new projects can be initialized into `backlog`, `.backlog`, or a profile-backed custom relative path without persisting that choice in project config. Runtime filesystem access, root discovery, branch scanning, ID generation, and server status/init APIs now all use the resolved directory. The user profile config path is now platform-specific: Unix-like systems use `~/.config/backlog.md/config.yaml`, and Windows uses `%APPDATA%\\backlog.md\\config.yaml` with `AppData/Roaming` fallback.

Centralized the new hidden-backlog/profile-config path constants in `src/constants/index.ts`, removed the stale `.user` settings plumbing plus its tests, and enabled `noUnusedLocals` / `noUnusedParameters` in `tsconfig.json` with the resulting dead code/import cleanup.

Validation:
- `bunx tsc --noEmit`
- `bun run check .`
- `bun test src/test/filesystem.test.ts src/test/backlog-directory.test.ts src/test/find-backlog-root.test.ts src/test/enhanced-init.test.ts`
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
