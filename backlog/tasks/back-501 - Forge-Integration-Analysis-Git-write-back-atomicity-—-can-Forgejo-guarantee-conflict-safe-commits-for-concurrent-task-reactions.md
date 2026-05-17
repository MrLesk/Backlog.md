---
id: BACK-501
title: >-
  Forge Integration Analysis: Git write-back atomicity — can Forgejo guarantee
  conflict-safe commits for concurrent task reactions?
status: To Do
assignee: []
created_date: '2026-05-17 19:53'
updated_date: '2026-05-17 19:58'
labels:
  - forge-integration
  - forgejo
  - analysis
  - git
  - concurrency
  - research
milestone: m-7
dependencies: []
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
priority: medium
ordinal: 187000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Concurrency analysis for Forge Integration Phase 3 (reactions + comments write-back). When a Forgejo user clicks a reaction on a backlog task, the system needs to: read the current task file, append the reaction to the `reactions:` frontmatter field, and commit the result. Two simultaneous reaction clicks from different users create a race condition.

**Research questions:**
1. How does Forgejo's existing web file editor handle concurrent edits to the same file? (It must already solve this for general file editing)
2. Does Forgejo use optimistic locking (compare-and-swap on tree SHA), file-level locking, or something else?
3. For reactions specifically: can we use a **separate git notes** mechanism to store reactions out-of-band from the task file, avoiding conflicts entirely?
4. Alternative: store reactions in a separate `backlog/.reactions/BACK-123.yaml` file per task — concurrent writes to different files avoid conflicts
5. What does the LFS lock system (`models/git/lfs_lock.go`) offer for this use case?

**Files to examine:**
- `services/repository/files/update.go` — how file updates are committed
- `routers/web/repo/editor.go` — web file editor conflict detection
- Git notes API in `modules/git`

**Deliverable:** Implementation Notes with: (a) Forgejo's existing conflict handling mechanism, (b) recommended approach for reaction write-back (in-file vs. sidecar vs. git notes), (c) concurrency safety guarantee assessment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Forgejo's existing file write conflict handling is documented with code references
- [ ] #2 At least 2 alternative storage strategies for reactions are evaluated (in-file, sidecar, git notes)
- [ ] #3 Recommended strategy chosen with rationale
- [ ] #4 Concurrent reaction scenario analyzed: what happens when 2 users react simultaneously?
- [ ] #5 Verdict: is atomic reaction write-back achievable without a distributed lock?
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
