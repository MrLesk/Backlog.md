---
id: BACK-470
title: Add task comments across Backlog.md
status: Done
assignee:
  - '@codex'
created_date: '2026-05-31 17:32'
updated_date: '2026-05-31 17:59'
labels:
  - comments
  - feature
  - cli
  - mcp
  - web-ui
dependencies: []
documentation:
  - src/types/index.ts
  - src/markdown/structured-sections.ts
  - src/markdown/parser.ts
  - src/markdown/serializer.ts
  - src/core/backlog.ts
  - src/server/index.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/ui/task-viewer-with-search.ts
  - src/formatters/task-plain-text.ts
  - src/mcp/tools/tasks/handlers.ts
priority: medium
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add first-class task comments so humans and agents can discuss or annotate a task without overloading Implementation Notes or Final Summary. Comments must be visible and addable through the public Backlog.md surfaces used by other repositories: CLI, MCP, Web UI/server API, and terminal task views. Keep the initial PR focused on ordered task-level comments; threaded replies, reactions, rich permissions, and comment edit history are non-goals unless approved separately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can add a markdown comment to a local editable task through documented CLI, MCP, and Web flows.
- [x] #2 Task views in CLI plain output, terminal UI, MCP, Web UI, and server API expose the same ordered comments with author, timestamp, and body.
- [x] #3 Comments persist with the task, survive unrelated task edits, and existing tasks without comments continue to load unchanged.
- [x] #4 Task search includes comment text so comments can help find related tasks.
- [x] #5 Automated coverage exists for core parsing/persistence plus CLI, MCP, server/API, and Web UI behavior.
- [x] #6 Public docs and agent-facing guidance explain comments and distinguish them from Implementation Notes and Final Summary.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Recommended initial PR shape:

1. Add an append-only task comment model in the shared core layer before touching UI surfaces. Represent comments as ordered task-level entries with body, created timestamp, stable display id/index, and optional author. Comments should live in task markdown, not sidecar files, so archive/complete/cross-branch loading continues to operate on one task artifact.

2. Store comments in a structured `## Comments` section with explicit sentinels, positioned after Implementation Notes and before Final Summary. Use sentinel-delimited individual comment blocks so markdown headings inside comment bodies do not break parsing. Existing tasks with no Comments section must parse exactly as before.

3. Reuse the existing task update pipeline rather than adding a separate persistence service. Suggested public update shape: append comments through existing task edit/update flows (`task edit --comment ...`, MCP `task_edit` comment append field, server `PUT /api/tasks/:id` append payload). Do not add edit/delete/threaded comments in the first PR unless product scope changes.

4. Update all view surfaces from the same `Task.comments` data: plain formatter, TUI detail/popup, MCP task_view, server API responses, and Web task modal. The Web modal should let users add a comment from preview mode and should disable submission for cross-branch read-only tasks.

5. Include comments in both shared search paths (`SearchService` and the in-memory task search index) so CLI/Web/MCP search behavior stays aligned.

6. Update public guidance after the command/tool shape is final. Clarify: comments are task discussion/annotations; Implementation Notes are execution progress logs; Final Summary is the PR-style completion summary.

Coordination notes:
- BACK-368 and BACK-420 touch section navigation/content viewing; Comments should be added to section-title handling so those future tasks see the section consistently.
- BACK-416 may add full-content task output; keep plain output stable and make any richer output include comments via the same formatter/model.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation on contributor branch `tasks/back-469-task-comments`; task IDs were later renumbered to BACK-470 because BACK-469 was already used on main. Scope is the parent feature and subtasks BACK-470.1 through BACK-470.4 because the user explicitly asked to implement the plan.

Completed implementation across core markdown persistence, CLI, MCP schema/update flow, server API, Web UI, terminal/plain rendering, search, generated CSS, docs, and public agent/MCP guidance. Verification completed: full `bun test` passed (1251 pass, 2 skipped, 0 fail); targeted comment/MCP tests passed after validation coverage was added; `bun run check .`, `bun x tsc --noEmit`, `bun run build`, and live browser sanity at `http://localhost:6421` passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented first-class task comments across Backlog.md. Comments are structured task-level entries persisted in a sentinel-delimited `## Comments` section, append through the existing update pipeline, render in CLI/MCP/server/Web/TUI views, participate in search, and are documented as discussion/annotation distinct from Implementation Notes and Final Summary.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
