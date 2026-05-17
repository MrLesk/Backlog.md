---
id: BACK-496
title: >-
  Forge Integration Phase 0: Define and implement `## Comments` section with
  structured author+timestamp format
status: To Do
assignee: []
created_date: '2026-05-17 19:53'
updated_date: '2026-05-17 19:58'
labels:
  - forge-schema
  - forge-integration
  - schema
  - typescript
milestone: m-7
dependencies: []
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
priority: medium
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 0 of the Forge Integration initiative. Backlog.md currently has `## Implementation Notes` but no structured comment thread. Forges have chronological comment lists with author + timestamp. This ticket adds a `## Comments` section with a parseable format.

**Proposed format:**
```markdown
## Comments

<!-- comment:2026-05-17T14:30:00Z:@username -->
Comment text here. Full markdown supported.
<!-- /comment -->

<!-- comment:2026-05-18T09:15:00Z:@other-user:edited:2026-05-18T10:00:00Z -->
Edited comment content.
<!-- /comment -->
```

**Design decisions to make:**
1. HTML comment delimiters vs. YAML fenced blocks vs. custom heading-per-comment?
2. Should sidecar file (`BACK-123.comments.md`) be preferred over inline section?
3. How does this interact with `## Implementation Notes` — are they separate or merged?
4. Edit history: store only latest content, or append edits as sub-entries?
5. `@username` format: Backlog.md `@name` vs. forge `@forge-username` — same namespace?

**Scope:**
- Extend `Task` interface: `comments?: TaskComment[]` where `TaskComment = { author, timestamp, content, editedAt? }`
- Update parser to extract `## Comments` section into structured objects
- Update serializer to write comments back in the HTML-comment-delimited format
- MCP `task_view` includes comments array
- MCP: add `task_comment_add` tool OR extend `task_edit` to append comments
- No forge-side code in this ticket

**This task MUST be on a clean branch from upstream-master and be a standalone PR.**
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Format spec is documented inline (in the task's Implementation Notes) and in the forge-schema-spec doc
- [ ] #2 `Task` interface has `comments?: TaskComment[]` field
- [ ] #3 Parser extracts `## Comments` section into `TaskComment[]` objects with author, timestamp, content
- [ ] #4 Serializer writes `TaskComment[]` back in the HTML-comment-delimited format; round-trip is lossless
- [ ] #5 MCP `task_view` response includes `comments` array
- [ ] #6 Backward compatible: tasks without `## Comments` section load without error
- [ ] #7 At least 3 tests: parse with comments, parse without, round-trip serialization of multi-comment thread
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
