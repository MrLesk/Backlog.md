---
id: BACK-747
title: Preserve unknown frontmatter in tasks and drafts
status: To Do
assignee: []
created_date: '2026-10-11 19:34'
updated_date: '2026-10-18 19:44'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/918'
  - src/markdown/frontmatter.ts
type: enhancement
ordinal: 365000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #918 reports unknown task frontmatter being lost during an edit. The future task/draft behavior is automatic preservation of all unknown top-level keys, with their original YAML representations and no project configuration. Backlog-owned keys keep their current meaning; unknown metadata remains opaque user data.

Alex decided on 2026-10-18: “Let’s get rid of custom fields and preserve all. I think it’s a better decision than my previous one.” This supersedes the earlier configured-only design and its task_custom_fields prerequisite. That design previously required BACK-746 and proposed dropping keys absent from a list; neither rule remains accepted.

This task remains To Do and is not part of the document/decision implementation for issue #1091 (BACK-748). It should reuse the existing shared Markdown preservation owner after researching task/draft write paths. No custom-field editing, public output additions, filtering, searching or UI is included. BACK-733 is an independent body-prefix bug, not a required feature gate for unknown-key preservation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Without configuration, task and draft writes retain every unknown top-level frontmatter entry, including the issue #918 approval block.
- [ ] #2 Unknown values keep their written YAML representations, including bare dates, 007, 1.10, flow lists and nested blocks with comments, across repeated writes.
- [ ] #3 Existing CLI, HTTP, MCP and TUI write paths, including promote/demote and lifecycle operations, share the same preservation behavior.
- [ ] #4 Backlog-owned fields keep existing behavior, including omitted/cleared optional fields and edits that write nothing when nothing changed.
- [ ] #5 No configuration lists, custom-field editing/output/filter/search/UI behavior or milestone preservation is added.
- [ ] #6 Focused regressions verify task and draft update paths and original #918 reproduction; implementation is separately planned before work begins.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18: Future specification revised under Alex's automatic-preservation decision. The configured-only plan and BACK-746 prerequisite are superseded. BACK-748 addresses only documents and decisions; #918 remains unimplemented here. The old BACK-733 dependency was a proposed shared-writer prerequisite, not an existing requirement; it remains separately open.
<!-- SECTION:NOTES:END -->
