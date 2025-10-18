---
id: task-303
title: Optimize Windows CI performance with test sharding
status: To Do
assignee: []
created_date: '2025-10-18 20:58'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows CI tests are running 2.55x slower per test (309ms vs 121ms on Ubuntu) due to I/O bottlenecks from NTFS + antivirus + GitHub Actions runner overhead. With 285 tests and heavy filesystem operations (git, file creation, TUI rendering), the Windows job takes ~188s vs ~46s on Ubuntu.

Implement test sharding strategy to parallelize Windows tests across 3 runners, reducing execution time from 188s to ~70-80s while keeping Linux/macOS as single-shard jobs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Windows tests split across 3 parallel shards using bun test --shard flag
- [ ] #2 Linux and macOS continue running as single-shard jobs
- [ ] #3 Lint only runs once per OS (not per shard)
- [ ] #4 Test results properly aggregated from all shards
- [ ] #5 CI workflow validates all shards must pass
- [ ] #6 Windows CI time reduced to ~70-80s (from ~188s)
<!-- AC:END -->
