---
id: BACK-488
title: >-
  Label Management — central CRUD and autocomplete for labels across all input
  surfaces
status: To Do
assignee: []
created_date: '2026-05-13 10:14'
labels:
  - labels
  - ux
  - web-ui
  - tui
  - cli
  - mcp
  - autocomplete
dependencies: []
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

Labels can be arbitrary strings today, causing label sprawl (typos, near-duplicates). Fix this with two complementary changes:

**1. Central label CRUD**: Make `config.yml` `labels` the single source of truth for the known label vocabulary. Provide full CRUD management through all access surfaces.

**2. Autocomplete/typeahead**: All label input fields (task create/edit, doc create/edit, decision create/edit) show suggestions from the `config.yml` label list as the user types.

**Schema coordination**: This ticket may land before or after the Colored Labels ticket. If colors land first, the CRUD UI must include a color field. If this lands first, the color field is added by the colors ticket — no breaking change (both use the same `{name, color?}` shape from `config.yml`).

**Migration (one-time, on first use)**: Harvest all distinct label strings from existing task, doc, and decision frontmatter and add them to `config.yml` labels list. Run automatically on `backlog init` or the first CRUD operation if labels are not yet in config.

**Assignee autocomplete is NOT in scope** — that is handled separately in BACK-484 using a scraping approach (no config entry).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WebUI Settings: dedicated Labels management section — list all labels, add new, rename, delete; shows color swatch if Colored Labels ticket is merged (gracefully omits color column if not)
- [ ] #2 TUI: label management accessible from settings panel (list, add, rename, delete)
- [ ] #3 CLI: commands to manage labels — e.g. `backlog label list`, `backlog label add <name>`, `backlog label rename <old> <new>`, `backlog label remove <name>` (or equivalent as `config` subcommands)
- [ ] #4 MCP: tools or config tool extensions to list, add, rename, and delete labels from config.yml
- [ ] #5 REST: CRUD endpoints for labels exposed (e.g. GET/POST/PUT/DELETE /api/config/labels or similar)
- [ ] #6 Autocomplete: all label input fields in WebUI/TUI show typeahead suggestions from config.yml after 1+ characters; matching is case-insensitive
- [ ] #7 Autocomplete: user can still enter a label not in the managed list; UI shows a prompt ('Label not in managed list — add it?') rather than blocking
- [ ] #8 CLI: at minimum, label input validation warns on submit if the value is not in the managed list; interactive prompt offers suggestions where feasible
- [ ] #9 One-time migration: on first use (or `backlog init`), all distinct labels found in existing task/doc/decision frontmatter are added to config.yml labels list
- [ ] #10 All 5 modalities (CLI, TUI, WebUI, MCP, REST) covered or explicitly marked N/A with justification in implementation notes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
