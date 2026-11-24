---
id: BACK-838
title: Keep browser live updates working after reconnect
status: Done
assignee:
  - '@codex'
created_date: '2026-11-24T19:01:00Z'
updated_date: '2026-11-24T19:08:00Z'
labels:
  - web
dependencies: []
references:
  - src/web/App.tsx
  - src/test/web-in-place-refresh.test.tsx
  - src/web/hooks/useBrowserConnection.ts
modified_files:
  - src/test/web-in-place-refresh.test.tsx
  - src/web/hooks/useBrowserConnection.ts
  - src/web/App.tsx
  - src/web/components/Layout.tsx
  - src/web/components/HealthIndicator.tsx
  - src/web/main.tsx
  - src/web/contexts/HealthCheckContext.tsx
  - src/web/hooks/useHealthCheck.tsx
  - src/test/web-task-detail-deeplink.test.tsx
  - src/test/web-app-open-detail-refresh.test.tsx
  - src/test/web-dependency-cleanup-notice.test.tsx
priority: medium
type: bug
ordinal: 437000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A person can leave the board open while the browser server restarts. The tab reports that the connection is restored and catches up once, but later CLI changes appear only after a page reload. This makes a working board look current while it is stale.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After a disconnect and reconnect, the open board catches up with changes made while offline and shows subsequent CLI task changes without a page reload.
- [x] #2 The offline indicator, Retry action and automatic reconnect use the live data connection. Read-only browser exports still work without a server connection.
- [x] #3 A browser regression test covers catch-up and a later live change in the same session.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the existing in-place board test with a disconnect, a change while offline, a reconnect, and a second external change. Run it against main to demonstrate the missed update.
2. Let the browser app own one reconnecting WebSocket for health, Retry, loading messages and data notifications. Keep the full catch-up read on reconnect and existing in-place reads for later messages. Keep static exports offline.
3. Run types, Biome and the affected web tests. Restart the compiled server with a Chrome tab open and create tasks through the CLI before and after it reconnects. Check a static export and review the final diff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
On main, the regression reached the offline catch-up and then timed out waiting for the later task. With the fix, the test passes for both automatic retry and the Retry button. All 55 tests in the four affected browser test files pass, as do the type check, Biome check and CLI build.

With the compiled CLI, Chrome kept the same board tab open through a server restart. It displayed tasks created before, during and after the restart with one WebSocket at a time. The static export displayed the tasks with the server stopped and made zero API requests or WebSocket connections.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The browser uses one WebSocket for connection status, loading messages and live changes. When it reconnects, the open page reads missed changes and resumes receiving new ones. Automatic and manual retry are covered by a regression test. The compiled browser and static export were also verified in Chrome.
<!-- SECTION:FINAL_SUMMARY:END -->
