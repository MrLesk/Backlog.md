---
id: BACK-487
title: Labels for Documents and Decisions — apply task label system to docs and ADRs
status: To Do
assignee: []
created_date: '2026-05-13 10:14'
updated_date: '2026-05-17 20:27'
labels:
  - labels
  - documents
  - decisions
  - web-ui
  - tui
  - cli
  - mcp
milestone: m-9
dependencies:
  - BACK-486
priority: low
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

Labels (and their colors, if the Colored Labels ticket has merged) are currently only available on tasks. Extend label support to Documents and Decisions so they can be categorized using the same vocabulary already defined in `config.yml`.

**Frontmatter extension**: Add `labels: string[]` to the document and decision file schemas, parsed identically to task labels.

**Color display**: If the Colored Labels ticket is merged first, colors display automatically (labels resolve their color from `config.yml` by name). If not yet merged, plain string labels are sufficient — color display is additive and requires no re-work.

**Sidebar UX** (optional, UX to be determined during implementation): Consider a subtle visual indicator in the docs/decisions list sidebar — e.g. a small colored dot or left-border accent. This should not clutter the list; a single dot per item on one side is sufficient. Exact treatment left to implementer judgment, but must be reviewed against accessibility contrast ratios.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Documents and Decisions support `labels: string[]` in their frontmatter; parser handles missing/empty field gracefully
- [ ] #2 WebUI: labels are visible in the full detail view of a doc/decision as badges (colored if Colored Labels is merged)
- [ ] #3 WebUI: doc/decision list view shows a subtle visual indicator for labeled items (e.g. colored dot or left border); exact treatment is implementer's choice but must be visually unobtrusive
- [ ] #4 TUI: labels are visible in the doc/decision detail view
- [ ] #5 CLI: `doc view` and `decision view` output includes labels; `doc list` and `decision list` support filtering by `--label` flag consistent with `task list --label`
- [ ] #6 MCP: document_view, document_list, and document_search expose and accept labels in their schemas
- [ ] #7 Filtering by label in the doc/decision list returns consistent results with equivalent task label filtering
- [ ] #8 All 5 modalities (CLI, TUI, WebUI, MCP, REST /api/docs) covered or explicitly marked N/A with justification in implementation notes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
