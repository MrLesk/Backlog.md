---
id: BACK-466
title: Add --repo flag to view a remote repository's backlog in board and browser
status: In Progress
assignee: []
created_date: '2026-05-29 09:00'
updated_date: '2026-05-29 09:01'
labels:
  - enhancement
  - cli
  - web
dependencies: []
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let `backlog board` and `backlog browser` render another repository's backlog/ folder without cloning it by hand. The remote is cloned into a local cache (~/.backlog/remotes/<host>/<owner>/<name>) with a shallow, blobless, sparse checkout of only the backlog/ folder, then handed to the existing Core(projectRoot) so all parsing and rendering is reused. Read-only snapshot: web UI edits write to the local cache only and are not pushed upstream.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 board --repo <owner/name> renders a remote repo's backlog Kanban
- [x] #2 browser --repo <owner/name> serves the web UI for a remote repo
- [x] #3 --ref selects a branch/tag and --no-refresh uses the cached snapshot without fetching
- [x] #4 Private repos work via the user's existing git credentials
- [x] #5 When --repo is absent, board and browser behave exactly as before (no regression)
- [x] #6 Web UI and terminal both indicate the remote view is a read-only snapshot
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) New src/remote/remote-repo.ts: parseRemoteSpec, getRemoteCacheDir (BACKLOG_REMOTE_CACHE override), ensureRemoteRepo (shallow+sparse clone, fetch+reset refresh). 2) cli.ts: shared resolveViewRoot() plus --repo/--ref/--no-refresh on board and browser. 3) server: optional remoteSnapshot exposed at GET /api/remote-snapshot, kept out of /api/config. 4) web: RemoteSnapshotBanner. 5) Tests in src/test/remote-repo.test.ts (parsing + local file:// integration). 6) README + ADVANCED-CONFIG.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
