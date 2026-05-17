---
id: BACK-495
title: >-
  Forge Integration Phase 0: Define and implement `reactions` field in task
  frontmatter
status: To Do
assignee: []
created_date: '2026-05-17 19:52'
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
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 0 of the Forge Integration initiative (see doc-5: Forge Integration Feasibility Study). Before any Forgejo-side work can begin, the Backlog.md task schema must be extended to represent forge-specific data.

This ticket covers the `reactions` field — currently absent from Backlog.md but present in all major forges (GitHub, Forgejo, GitLab).

**Proposed frontmatter format:**
```yaml
reactions:
  "+1": ["@user1", "@user2"]
  "heart": ["@user3"]
  "rocket": ["@user1"]
  "eyes": []
```

**Design decisions to make:**
1. Frontmatter dict vs. dedicated `## Reactions` markdown section?
2. Include timestamps per reaction, or just user lists?
3. Allowed emoji set: free-form string keys, or enum from a config?
4. How does `bun run cli task edit` handle reactions? (direct frontmatter edit? new `--add-reaction` flag?)

**Scope:**
- Extend `Task` interface in `src/types/index.ts`
- Update parser (`src/markdown/parser.ts`) to read `reactions:` frontmatter
- Update serializer (`src/markdown/serializer.ts`) to write it back without data loss
- Update MCP `task_view` response to include reactions
- Update MCP `task_edit` schema to allow setting reactions
- No UI work in this ticket (CLI/TUI/Web display is separate)
- No forge-side code in this ticket

**This task MUST be on a clean branch from upstream-master and be a standalone PR.**
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `reactions` field is defined in the `Task` TypeScript interface in `src/types/index.ts`
- [ ] #2 Parser reads `reactions:` from YAML frontmatter without error; missing field treated as empty object `{}`
- [ ] #3 Serializer writes `reactions:` back to frontmatter; round-trip is lossless
- [ ] #4 MCP `task_view` response includes `reactions` object
- [ ] #5 MCP `task_edit` accepts a `reactions` parameter
- [ ] #6 Existing tasks without `reactions:` field continue to work (backward compatible)
- [ ] #7 At least 3 tests: parse reactions present, parse reactions absent, round-trip serialization
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
