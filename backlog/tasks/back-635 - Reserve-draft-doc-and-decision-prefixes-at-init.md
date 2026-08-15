---
id: BACK-635
title: 'Reserve draft, doc, and decision prefixes at init'
status: To Do
assignee: []
created_date: '2026-08-15 14:00'
labels: []
dependencies: []
priority: medium
ordinal: 270000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the PR #916 (BACK-634) review and a matching Codex finding. backlog init --task-prefix accepts letters-only values including 'draft', 'doc', and 'decision', which collide with the hard-coded system prefixes (DRAFT- for drafts in backlog/drafts/, doc-/decision- for documents and decisions). A project initialized with --task-prefix draft stores regular tasks as DRAFT-n: the web server's prefix-routed draft handling (and MCP task_edit, which has preferred the draft store for DRAFT- ids since #430) then misroutes those tasks, and creating one real draft guarantees ID collisions across tasks/ and drafts/. Task prefix is init-only, so validation at init is sufficient: reject the reserved prefixes (case-insensitive) with a clear error. Verified empirically during the #916 review: such a project loses web GET on its tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog init rejects draft, doc, and decision (case-insensitive) as --task-prefix and wizard values with a clear error
- [ ] #2 Existing projects with a reserved prefix are unaffected at runtime (no new failures beyond current behavior); doctor mentions the misconfiguration
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
