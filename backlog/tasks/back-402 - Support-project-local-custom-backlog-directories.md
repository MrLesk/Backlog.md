---
id: BACK-402
title: Support project-local custom backlog directories
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-14 19:55'
updated_date: '2026-03-14 22:55'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/334'
  - 'https://github.com/MrLesk/Backlog.md/issues/215'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow Backlog.md to initialize and discover its project-local backlog folder and configuration using deterministic project-root signals. The canonical discovery mechanism should support `backlog/`, `.backlog/`, and a root-level `backlog.config.yml` file that can declare `backlog_directory` for custom project-relative backlog folders.

Relevant implementation areas:
- `/Users/alex/projects/Backlog.md/src/file-system/operations.ts`
- `/Users/alex/projects/Backlog.md/src/utils/find-backlog-root.ts`
- `/Users/alex/projects/Backlog.md/src/cli.ts`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Project root discovery recognizes root `backlog.config.yml` as a valid backlog marker alongside `backlog/` and `.backlog/.`
- [x] #2 If root `backlog.config.yml` exists, it is the canonical config file. When it contains `backlog_directory`, Backlog.md resolves the backlog folder from that project-relative path.
- [x] #3 If root `backlog.config.yml` exists but omits `backlog_directory`, Backlog.md falls back to `backlog/` then `.backlog/` inside the same project root.
- [x] #4 If root `backlog.config.yml` does not exist, Backlog.md falls back to the folder-local model using `backlog/config.yml` or `.backlog/config.yml`.
- [x] #5 CLI init and web init support `backlog/`, `.backlog/`, and custom project-relative folders via root `backlog.config.yml`, and non-interactive CLI supports the same explicitly.
- [x] #6 The previous user-profile backlog-directory model is removed from code, tests, and task documentation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Introduce a project-root resolver that recognizes `backlog.config.yml`, `backlog/`, and `.backlog/` in canonical order.
2. Refactor filesystem config load/save accessors and config watchers so root `backlog.config.yml` is canonical when present, while legacy folder-local configs remain supported when root config is absent.
3. Update CLI init, web init, and shared init logic so built-in folders and custom project-relative folders are configured through root `backlog.config.yml`, with matching non-interactive flags.
4. Remove user-profile backlog discovery code and tests, add regression coverage for root-config discovery/preference, and validate the branch with targeted and full-suite checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation will treat root `backlog.config.yml` as the canonical per-project discovery mechanism and preserve legacy folder-local configs only when the root config is absent.

Fixing init so custom backlog directories always require root config discovery in shared initialization, even when API callers omit `configLocation`.

Fixing the public Core.initializeProject API so custom backlog directories remain discoverable by forcing root backlog.config.yml for custom paths there as well.

Refactoring the public Core.initializeProject path to delegate to the shared init implementation so backlog folder/config rules are defined in one place rather than duplicated in core/backlog.ts.

Fixing shared init so built-in backlogDirectorySource values (`backlog` / `.backlog`) are honored even when callers omit the redundant backlogDirectory string.

Fixing shared init to infer `custom` source from a non-built-in backlogDirectory value when callers omit backlogDirectorySource, so API callers still get root config discovery.

Fixing root-config discovery so valid `backlog.config.yml` projects stay discoverable even when the configured backlog directory has not been created yet.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reworked `BACK-402` to use deterministic project-root discovery instead of the earlier user-profile backlog-directory model. Backlog root detection now recognizes `backlog.config.yml`, `backlog/`, and `.backlog/`, with root `backlog.config.yml` acting as the canonical config file when present. That root config can declare `backlog_directory` for custom project-relative backlog folders; otherwise Backlog.md falls back to `backlog/` then `.backlog/` within the same project.

Updated shared init, CLI init, web init, and filesystem config resolution so built-in folders and custom project-relative folders all flow through the root config model. Non-interactive CLI now supports explicit backlog-folder and config-location selection without relying on any user-profile setting.

Removed the previous user-profile backlog-directory discovery path from code, tests, and task documentation, and aligned the task record/guidance with the canonical root-config design.

Validation:
- `bunx tsc --noEmit`
- `bun run check .`
- `bun test`
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
