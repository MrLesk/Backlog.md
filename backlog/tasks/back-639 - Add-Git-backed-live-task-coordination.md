---
id: BACK-639
title: Add Git-backed live task coordination
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-24 07:43'
updated_date: '2026-08-24 07:59'
labels: []
dependencies: []
priority: high
type: feature
ordinal: 274000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prevent humans and agents from silently duplicating work and make transient task ownership, assignment, and status changes visible across clones without adding coordination commits to normal branch history. Markdown remains the durable task record; Git coordination refs are an optional remote overlay used only when remote operations are enabled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Two concurrent attempts to claim the same task produce exactly one winner
- [x] #2 Claims use leases and stale claims can be replaced atomically without deleting a newer owner's claim
- [x] #3 Status and assignee changes can be published and refreshed as transient coordination state without changing normal branch history
- [x] #4 The canonical CLI exposes understandable claim, release, start, and coordination-list workflows
- [x] #5 Remote failures fail closed for exclusive claims and return actionable human-readable errors
- [x] #6 Projects with remote operations disabled continue to work without coordination
- [x] #7 Automated tests cover concurrent claims, stale writes, safe release, offline failure, and unchanged normal history
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a small Git coordination model and CAS operations using custom blob-backed refs under refs/backlog/tasks/*. 2. Expose canonical CLI commands for claim, release, start, publish, refresh/list with safe owner and lease handling. 3. Keep Markdown durable by updating it through existing Core mutations while treating remote records as transient overlays. 4. Add local bare-remote integration tests covering concurrent creation, expired replacement, stale release, offline failure, and unchanged branch history. 5. Run focused tests, type-check, lint, build, and the full suite; simplify before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented blob-backed refs under refs/backlog/tasks/* with explicit force-with-lease CAS for create, update, renewal, replacement, and deletion. Added canonical claim, release, start, publish, and claims CLI workflows plus user documentation.

Verification: 9 focused coordination tests pass (30 assertions), TypeScript passes, modified TypeScript files pass Biome, build passes, and a disposable create/read/delete probe passed against the configured GitHub fork. A repository-wide test run was stopped after unrelated existing Windows failures in Claude-agent fixtures and locked temporary-file tests; bun run check . also reports repository-wide CRLF formatting outside the changed files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Git-backed live task coordination with atomic claims, renewable leases, stale-write protection, safe release, transient status/assignee publication, canonical CLI workflows, documentation, local concurrency integration tests, and a successful disposable GitHub compatibility probe.
<!-- SECTION:FINAL_SUMMARY:END -->
