---
id: BACK-643.1
title: 'Core: Add project field to task domain model and persistence'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 16:20'
updated_date: '2026-08-20 16:28'
labels: []
dependencies: []
parent_task_id: BACK-643
ordinal: 274000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Task.project, TaskCreateInput.project, TaskUpdateInput.project, TaskListFilter.project, SearchFilters.project, and BacklogConfig.projects to src/types/index.ts. Serialize/parse project in frontmatter (src/markdown/serializer.ts, parser.ts) next to type. Add Core.normalizeProject() (fail-closed: no configured projects -> clear error; unknown value -> clear error listing valid values) and wire into createTask/updateTask. Add project to buildUpdatedDateComparableTask. Register 'projects' as a ConfigListKey in src/file-system/operations.ts (parseConfig/serializeConfig), mirroring 'types'. New src/utils/project-config.ts mirrors src/utils/task-type-config.ts but getProjectValues() returns [] when unconfigured -- no DEFAULT_PROJECTS fallback constant. No config-migration changes needed (types/priorities are also absent from migrateConfig's defaults and needsMigration's field list).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task.project?: string and matching fields on TaskCreateInput/TaskUpdateInput/TaskListFilter/SearchFilters/BacklogConfig.projects added to src/types/index.ts
- [x] #2 project: field round-trips through serializeTask/parseTask, positioned after type: in frontmatter
- [x] #3 src/utils/project-config.ts exports normalizeProjectValue, getProjectValues, resolveProjectValue, resolveProjectValues, matchesProjectFilter, formatValidProjectValues; getProjectValues returns [] when config.projects is empty/unset
- [x] #4 Core.normalizeProject throws 'No projects are configured...' when projects list is empty and a value is passed, and 'Invalid project: X. Valid projects are: ...' for an unrecognized value
- [x] #5 createTask and updateTask call normalizeProject; updateTask stamps updated_date when project changes
- [x] #6 backlog/config.yml supports a projects: [...] list parsed/serialized like types:, via the ConfigListKey union in src/file-system/operations.ts
- [x] #7 Unit tests in src/test/task-project.test.ts cover round-trip, unconfigured rejection, invalid-value rejection, case-insensitive resolution, and updated_date stamping
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/utils/project-config.ts mirroring task-type-config.ts (normalizeProjectValue, getProjectValues [no default fallback], resolveProjectValue, resolveProjectValues, matchesProjectFilter, formatValidProjectValues).
2. Extend src/types/index.ts: Task.project, TaskCreateInput.project, TaskUpdateInput.project, TaskListFilter.project, SearchFilters.project, BacklogConfig.projects.
3. Serialize project in src/markdown/serializer.ts (after type), parse in src/markdown/parser.ts (after type).
4. Register 'projects' in the ConfigListKey union and parseConfig/serializeConfig in src/file-system/operations.ts.
5. Add Core.normalizeProject() in src/core/backlog.ts (fail-closed messages), wire into createTask/updateTask, add project to buildUpdatedDateComparableTask.
6. Write src/test/task-project.test.ts covering round-trip, unconfigured rejection, invalid rejection, case-insensitive resolution, updated_date stamping.
7. Run bunx tsc --noEmit, bun run check ., bun test src/test/task-project.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added src/utils/project-config.ts (mirrors task-type-config.ts; getProjectValues() returns [] with no fallback constant, unlike types). Extended Task/TaskCreateInput/TaskUpdateInput/TaskListFilter/SearchFilters/BacklogConfig in src/types/index.ts. Wired project through serializer.ts/parser.ts frontmatter (after type:). Registered 'projects' in ConfigListKey and parseConfig/serializeConfig in src/file-system/operations.ts. Added Core.normalizeProject() with two distinct fail-closed messages (unconfigured vs invalid value), wired into createTask/updateTask, added project to buildUpdatedDateComparableTask.

Verification: bunx tsc --noEmit clean. bun run check . clean on all touched/new files (6 files); confirmed 7 pre-existing biome errors in untouched files -- ui/board.ts, ui/components/task-composer.ts, core/content-store.ts, server/index.ts -- are unrelated pre-existing issues (git diff against main shows zero changes to those files). New src/test/task-project.test.ts: 14/14 pass, covering fail-closed unconfigured create/edit, round-trip persist, clear via empty string, case-insensitive resolution against configured casing, invalid-value rejection, config round-trip, and legacy/untagged back-compat. Also ran src/test/task-type.test.ts, task-type-config.test.ts, prefix-config.test.ts (no regressions), and config-commands.test.ts/config-migration.test.ts/config-watcher.test.ts -- one pre-existing unrelated failure in config-commands.test.ts confirmed present on main via git stash (tab-indentation YAML edge case, untouched by this change).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the project task attribute to the core domain model and persistence layer: Task.project/TaskCreateInput/TaskUpdateInput/TaskListFilter/SearchFilters/BacklogConfig.projects in src/types/index.ts, frontmatter serialize/parse in src/markdown/{serializer,parser}.ts, config list registration in src/file-system/operations.ts (ConfigListKey + parseConfig/serializeConfig), and Core.normalizeProject() wired into createTask/updateTask with fail-closed validation (distinct errors for 'no projects configured' vs 'invalid value', no default project list unlike task types). New src/utils/project-config.ts mirrors task-type-config.ts's API surface. Verified with bunx tsc --noEmit, bun run check . (clean on all touched files), and 14 new tests in src/test/task-project.test.ts plus regression runs of task-type, task-type-config, prefix-config, and config-* test suites -- all passing except one pre-existing unrelated failure confirmed present on main.
<!-- SECTION:FINAL_SUMMARY:END -->
