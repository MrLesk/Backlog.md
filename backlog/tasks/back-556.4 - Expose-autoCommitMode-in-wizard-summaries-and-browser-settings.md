---
id: BACK-556.4
title: 'Expose autoCommitMode in wizard, summaries, and browser settings'
status: In Progress
assignee:
  - '@andreas'
created_date: '2026-07-28 14:47'
updated_date: '2026-07-29 13:53'
labels:
  - web-ui
  - cli
dependencies:
  - BACK-556.3
parent_task_id: BACK-556
priority: low
ordinal: 205000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose `autoCommitMode` in the human-facing configuration surfaces once BACK-556.3 has established it in the shared model and canonical CLI.

This covers the advanced CLI wizard, initialization and configuration summaries, and browser initialization and Settings. These surfaces must not weaken the validation established in BACK-556.3. Their human-readable copy must explain the conditional behavior accurately: `amend-own` may replace the exact current locally-owned Backlog tip when all safety checks pass, and otherwise creates a new commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The advanced CLI wizard offers autoCommitMode, defaults to the current configured value, and presents it in a way that makes sense only when auto commit is enabled.
- [x] #2 Initialization and configuration summaries show the effective autoCommitMode.
- [x] #3 Browser initialization and Settings expose autoCommitMode, reject invalid values, and round-trip through the shared typed and serialized configuration paths.
- [x] #4 Human-readable copy on the CLI wizard and browser surfaces states that amend-own may replace the exact current locally-owned Backlog tip only when all safety checks pass and otherwise creates a new commit.
- [x] #5 Tests cover wizard defaults and output, summary rendering, and browser initialization and Settings round-trips.
- [x] #6 Browser archive, complete, reorder, cleanup, and other mutation responses surface bounded replacement feedback consistently for JSON and no-content operations.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the conditional auto-commit mode selector to the advanced CLI wizard and preserve it through init/config saves.
2. Expose the same selector and safety explanation in browser initialization and Settings, including API validation.
3. Show the effective mode in init/config/browser summaries and add round-trip UI/API regression tests.

4. Verify browser mutation feedback end to end after centralizing response notice handling, including archive/complete and bounded multi-operation output.

5. Move document, decision, and milestone mutation methods onto the centralized fetch/notice transport and test every affected JSON/no-content method.

6. Add ApiClient.promoteDraft through fetchWithRetry/fetchJson, remove DraftsList raw fetch, and assert its response header dispatches the centralized notice.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added conditional new/amend-own selectors to the advanced CLI wizard, browser initialization, and Settings with explicit safety/fallback copy. Persisted the mode through init and Settings APIs, added strict browser endpoint validation, displayed effective modes in CLI and browser summaries, and covered wizard defaults, summaries, browser initialization, Settings, and API round trips.

Holistic correction centralizes browser response notice dispatch for JSON and no-content operations and covers reorder, archive, and complete feedback plus bounded multi-operation summaries.

Verification reconfirmed centralized bounded browser feedback across JSON and no-content mutations in the full 1,835-pass suite.

Pass 3 correction moves every document, decision, and milestone mutation client onto fetchWithRetry/fetchJson so JSON and no-content responses all dispatch the bounded automatic-commit header. Eight entity methods plus task reorder/archive/complete are covered.

DraftsList promotion was the final raw browser mutation fetch. It now calls ApiClient.promoteDraft through fetchJson/fetchWithRetry, with automatic-commit notice dispatch covered alongside all entity mutation methods.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @andreas
created: 2026-07-29 09:25
---
Holistic finding H2: server archive/complete responses carry replacement metadata, but client methods bypass the fetchJson notice dispatcher and amend silently.
---

created: 2026-07-29 11:58
---
Holistic pass 3 finding H1: several browser document, decision, and milestone methods still use raw fetch and discard the server amendment header.
---

created: 2026-07-29 13:20
---
Holistic pass 4 finding H1: browser draft promotion is the remaining raw mutating fetch and silently drops the server automatic-commit header.
---
<!-- COMMENTS:END -->
