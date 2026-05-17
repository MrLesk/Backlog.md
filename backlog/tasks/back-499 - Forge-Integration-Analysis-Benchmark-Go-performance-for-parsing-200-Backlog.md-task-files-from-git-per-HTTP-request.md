---
id: BACK-499
title: >-
  Forge Integration Analysis: Benchmark Go performance for parsing 200+
  Backlog.md task files from git per HTTP request
status: To Do
assignee: []
created_date: '2026-05-17 19:53'
updated_date: '2026-05-17 19:58'
labels:
  - forge-integration
  - forgejo
  - analysis
  - go
  - performance
  - research
milestone: m-7
dependencies: []
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
priority: medium
ordinal: 185000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Performance analysis task for Forge Integration Phase 2. The BacklogSource unit option requires reading all `backlog/tasks/*.md` files from the git repository on each page load and parsing their YAML frontmatter + markdown sections into task structs.

**Research questions:**
1. How fast is a git tree read for 200 files in Forgejo's existing `modules/git` layer?
2. How fast is YAML frontmatter parsing (using Forgejo's existing gopkg.in/yaml.v3 or similar) for 200 files?
3. What is total latency for: git tree list → blob reads → YAML parse → struct fill, for N=50, N=200, N=1000?
4. What caching strategies exist in Forgejo today? (commit-SHA keyed caches for rendered content?)
5. Is there an existing `ContentStore` or cache abstraction we can reuse?
6. Is a pre-built `backlog/.cache.json` index (written by Backlog.md CLI on every task write) a better approach than in-memory cache?

**Implementation approach:**
Write a small Go benchmark (can be in `/tmp` or a test file in the Forgejo repo):
```go
func BenchmarkParseBacklogTasks(b *testing.B) {
    // Open git repo, list backlog/tasks/, read blobs, parse frontmatter
}
```

**Deliverable:** Implementation notes with: (a) measured latency at 50/200/1000 tasks, (b) recommendation for caching strategy, (c) code sketch for the recommended approach.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Benchmark exists and has been run against the Forgejo git library
- [ ] #2 Latency measured at task counts: 50, 200, 1000
- [ ] #3 Caching strategy recommendation with concrete implementation approach
- [ ] #4 Verdict: is per-request parsing viable at 200 tasks? At 1000?
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
