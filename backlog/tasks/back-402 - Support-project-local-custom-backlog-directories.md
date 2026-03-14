---
id: BACK-402
title: Support project-local custom backlog directories
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-14 19:55'
updated_date: '2026-03-14 22:09'
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
- [ ] #1 Project root discovery recognizes root `backlog.config.yml` as a valid backlog marker alongside `backlog/` and `.backlog/.`
- [ ] #2 If root `backlog.config.yml` exists, it is the canonical config file. When it contains `backlog_directory`, Backlog.md resolves the backlog folder from that project-relative path.
- [ ] #3 If root `backlog.config.yml` exists but omits `backlog_directory`, Backlog.md falls back to `backlog/` then `.backlog/` inside the same project root.
- [ ] #4 If root `backlog.config.yml` does not exist, Backlog.md falls back to the folder-local model using `backlog/config.yml` or `.backlog/config.yml`.
- [ ] #5 CLI init and web init support `backlog/`, `.backlog/`, and custom project-relative folders via root `backlog.config.yml`, and non-interactive CLI supports the same explicitly.
- [ ] #6 The previous user-profile backlog-directory model is removed from code, tests, and task documentation.
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
