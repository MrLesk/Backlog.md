---
id: BACK-497
title: >-
  Forge Integration Phase 0: Add `forge_refs` field for cross-system ID mapping
  (GitHub #123 ↔ BACK-123)
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
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 0 of the Forge Integration initiative. When a Backlog.md task is mirrored as a Forgejo/GitHub/GitLab issue (or vice versa), we need to persist the external ID to avoid creating duplicates and to enable bidirectional sync.

**Proposed frontmatter format:**
```yaml
forge_refs:
  - forge: forgejo
    repo: "my-org/my-repo"
    id: "42"
    url: "https://forgejo.my-org.com/my-org/my-repo/issues/42"
  - forge: github
    repo: "my-org/my-repo"  
    id: "123"
    url: "https://github.com/my-org/my-repo/issues/123"
```

This allows a single task to be linked to multiple forges simultaneously (multi-forge scenario).

**Scope:**
- Extend `Task` interface: `forgeRefs?: ForgeRef[]` where `ForgeRef = { forge, repo, id, url? }`
- Update parser + serializer for `forge_refs:` frontmatter key
- MCP `task_view` includes `forgeRefs`
- MCP `task_edit` allows setting/appending `forge_refs`
- No sync logic in this ticket — only the data field

**This task MUST be on a clean branch from upstream-master and be a standalone PR.**
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `Task` interface has `forgeRefs?: ForgeRef[]` field with `{ forge: string, repo: string, id: string, url?: string }` shape
- [ ] #2 Parser reads `forge_refs:` from frontmatter as `ForgeRef[]`
- [ ] #3 Serializer writes `forge_refs:` back without data loss
- [ ] #4 MCP `task_view` includes `forgeRefs`
- [ ] #5 MCP `task_edit` accepts `forgeRefs` parameter
- [ ] #6 Backward compatible: tasks without `forge_refs:` load without error
- [ ] #7 At least 2 tests: parse with forge_refs, round-trip
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
