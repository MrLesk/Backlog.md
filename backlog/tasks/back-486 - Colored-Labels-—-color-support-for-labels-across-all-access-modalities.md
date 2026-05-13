---
id: BACK-486
title: Colored Labels — color support for labels across all access modalities
status: To Do
assignee: []
created_date: '2026-05-13 10:14'
labels:
  - labels
  - web-ui
  - tui
  - cli
  - mcp
  - ux
dependencies: []
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

Labels currently exist as plain strings. Add optional color (hex) per label so teams can visually group related labels (e.g. all infra-related in soft blue, all github-related in soft purple). Colors should be muted / pastel-range by convention, but any hex value is accepted.

**Schema change**: Extend `config.yml` `labels` field from `string[]` to `Array<string | { name: string; color?: string }>`. The parser must handle both old and new formats — plain strings remain valid and render with default styling. This change is backwards-compatible.

**Storage**: Label color metadata lives in `backlog/config.yml`. Task frontmatter references labels by name only (no per-task color duplication).

**Cross-modality note**: This feature touches all 5 access surfaces. Any surface that cannot show colors must degrade gracefully (plain text label name). See also related tickets: Label CRUD + Autocomplete (for the management UI that will include the color field) and Labels for Docs/Decisions (which will inherit color display once this lands).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 config.yml label schema extended to support `{ name: string; color?: string }` objects; parser handles both plain string and object formats without error
- [ ] #2 WebUI: labels render as colored badges using the configured hex color; Settings page has a color picker per label (swatch + hex input; pastel palette suggested as default swatches; any hex accepted)
- [ ] #3 TUI: labels render with ANSI truecolor (or 256-color fallback) approximating the configured hex; degrades to plain text when terminal reports no color support
- [ ] #4 CLI: label output (task list, task view) uses the closest ANSI color to the configured hex; plain text fallback when no color support is detected
- [ ] #5 MCP: tool responses for task_list, task_view, task_search, and config reads include a `color` field (hex string or null) per label object
- [ ] #6 Existing tasks with plain string labels continue to work unchanged — no migration required
- [ ] #7 Color picker/editor is simple — no full design tool; pick a color, see the badge preview, save
- [ ] #8 All 5 modalities (CLI, TUI, WebUI, MCP, REST /api/config) covered or explicitly marked N/A with justification in implementation notes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
