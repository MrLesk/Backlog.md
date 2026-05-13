---
id: BACK-484
title: >-
  Assignee field should autocomplete-on-type based on the assignees already
  found in the data of the board
status: To Do
assignee:
  - '@lenucksi'
created_date: '2026-05-13 09:51'
updated_date: '2026-05-13 10:12'
labels: []
dependencies: []
ordinal: 171000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

The assignee field in task create/edit should offer typeahead suggestions from assignees that already appear anywhere in the board's task files. No central config — the system scrapes assignees from existing task frontmatter at query time.

This is the assignee equivalent of label autocomplete (see label management ticket) but intentionally simpler: no CRUD, no management UI, just dynamic scraping. The `@`-prefix convention is preserved throughout.

**How scraping works**: At autocomplete query time, scan all task files in `backlog/tasks/` and collect distinct values from the `assignee:` frontmatter field. Return deduplicated, sorted list. No caching required (board is local files; scan is fast enough for interactive use).
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WebUI: assignee input in task create/edit shows a dropdown of existing assignees after 1+ characters typed; matching is case-insensitive; user can still enter a new assignee not yet in the board
- [ ] #2 TUI: same typeahead suggestions appear in the assignee input field during task create/edit
- [ ] #3 CLI: on `backlog task create --assignee` (or interactive prompt equivalent), existing assignees are offered as completions or suggestions; a new value is still accepted without error
- [ ] #4 MCP: document in task_create / task_edit tool descriptions that assignee suggestions are derived from existing board data; no new MCP tool required unless the suggestion endpoint is reusable
- [ ] #5 Scraped assignee list is built from task frontmatter at query time — no persistent cache, no config entry
- [ ] #6 `@`-prefix preserved consistently: existing assignees stored as `@name`; suggestions always display with `@`
- [ ] #7 All 4 modalities (WebUI, TUI, CLI, MCP) covered or explicitly marked N/A with justification
<!-- AC:END -->
