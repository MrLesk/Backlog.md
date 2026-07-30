---
id: BACK-556.4
title: 'Expose autoCommitMode in wizard, summaries, and browser settings'
status: In Progress
assignee:
  - '@andreas'
created_date: '2026-07-28 14:47'
updated_date: '2026-07-30 07:04'
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
- [x] #7 Browser automatic-commit notices are queued, combined, or visibly stacked so task/draft creation confirmation cannot cover consequential replacement feedback, with an amended-creation UI regression.
- [x] #8 Initialization surfaces save configuration before integration writes, and those writes honor the resulting current bytes rather than the stale wizard/request boolean under either enablement transition.
- [x] #9 CLI and browser initialization responses/summaries display the fail-closed reloaded persisted autoCommit and autoCommitMode values after setup, including post-save races.
- [ ] #10 The browser /api/init response includes effective persisted BacklogConfig, the typed client exposes it, InitializationScreen passes it to App, and App seeds config state before follow-up loads; HTTP and component regressions cover post-save mode races.
- [ ] #11 Published browser/initialization configuration is both stable and complete before it replaces display cache or preserved request fields; truncated current bytes cannot surface empty required identity or enable amend-own.
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

7. Include browser initialization in the centralized automatic-commit response wrapper and cover owned-tip re-initialization feedback end to end.

8. Preserve centralized automatic-commit header dispatch while disabling automatic retries for non-idempotent browser mutation methods; cover response loss after a successful write.

9. Make automatic-commit feedback and entity confirmations visibly coexist or queue without overwriting, and add amended task/draft creation coverage.

8. Cover embedded-quote project/config values through browser initialization and Settings update/readback using the real serialized configuration path, not only mocked typed payloads.

8. Extend initialization coverage around post-save integration setup so stale request/wizard autoCommit values cannot override current persisted enablement in either direction.

9. Assert initialization result/summary configuration against current post-save bytes for enablement and mode changes rather than only commit behavior.

10. Publish the validated current-byte config snapshot at initializeProject completion, include it in server/client init response types, consume it through onInitialized(config), and assert both direct HTTP response/cache and InitializationScreen callback receive post-save new instead of requested amend-own.

Pass 23: cover direct initialization publication when the post-save file is incomplete/changes across reads, proving the request/preserved display snapshot is not published and no integration mutation occurs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added conditional new/amend-own selectors to the advanced CLI wizard, browser initialization, and Settings with explicit safety/fallback copy. Persisted the mode through init and Settings APIs, added strict browser endpoint validation, displayed effective modes in CLI and browser summaries, and covered wizard defaults, summaries, browser initialization, Settings, and API round trips.

Holistic correction centralizes browser response notice dispatch for JSON and no-content operations and covers reorder, archive, and complete feedback plus bounded multi-operation summaries.

Verification reconfirmed centralized bounded browser feedback across JSON and no-content mutations in the full 1,835-pass suite.

Pass 3 correction moves every document, decision, and milestone mutation client onto fetchWithRetry/fetchJson so JSON and no-content responses all dispatch the bounded automatic-commit header. Eight entity methods plus task reorder/archive/complete are covered.

DraftsList promotion was the final raw browser mutation fetch. It now calls ApiClient.promoteDraft through fetchJson/fetchWithRetry, with automatic-commit notice dispatch covered alongside all entity mutation methods.

Browser initialization now shares the same bounded automatic-commit response wrapper as entity/lifecycle mutations. End-to-end owned-tip re-initialization feedback is covered through the live HTTP route.

Feedback-aware browser methods continue to dispatch bounded headers and parse shared errors, but non-idempotent POST/PUT/DELETE/PATCH requests now execute once after ambiguous failure. Response-loss coverage proves no duplicate entity creation.

Pass 8 browser feedback corrections complete: high-volume response headers report truthful totals, automatic-commit events queue up to five notices, and AppSuccessToasts visibly stacks replacement notices with task/draft creation confirmation. The amended-creation UI regression renders both notices in one fixed stack. Full gate: 1,852 passed, 4 skipped, 0 failed.

Pass 12 browser round-trip coverage now includes quoted project names through real initialization serialization, actual Settings PUT/readback plus a subsequent mutation, and the Settings component typed payload. All preserve the exact value and configured amend-own mode.

Pass 20 H1 affects initialization semantics after Settings/wizard request configuration is saved; post-save integration must use current bytes.

Pass 20 initialization-surface current-byte semantics complete. After initialization saves request/wizard settings, integration writes independently resolve persisted enablement; deterministic opposite-direction transitions prevent stale UI/request booleans from deciding commits. Focused and integrated gates pass.

Pass 21 M3 reopens initialization summaries: requested amend-own can be persisted as new at the tested save seam yet still be returned/displayed as amend-own.

Pass 21 initialization response/summary source is now the reloaded persisted current configuration. Regression covers both autoCommit directions and amend-own→new after save, so CLI/browser consumers receive effective values. Focused 67/521 and integrated 1,878/8,381 gates pass.

Pass 22 M1: Core returns current config, but the server drops it, API types omit it, and InitializationScreen ignores the result; App then reloads /api/config from saveConfig stale cache.

Pass 22 browser effective result complete. /api/init includes validated published BacklogConfig, ApiClient types it, InitializationScreen passes it, and App seeds effective state. HTTP regression mutates saved true/amend-own to false/new and proves both response and immediate /api/config cache; component regression proves callback consumes returned new despite submitting amend-own. Focused and integrated gates pass.
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

created: 2026-07-29 14:19
---
Holistic pass 5 H1: initialization was the remaining browser mutation route that could replace an owned commit without dispatchable response feedback.
---

created: 2026-07-29 15:21
---
Holistic pass 6 H2: browser feedback centralization accidentally inherited retry semantics that can duplicate non-idempotent document/decision/milestone writes.
---

created: 2026-07-29 17:24
---
Pass 8 M3/L4: browser overflow summaries lose the true total, and fixed-position task/draft confirmation toasts cover simultaneous amendment feedback.
---

created: 2026-07-29 22:23
---
Pass 12 M3 requires browser initialization and Settings round-trip evidence for YAML-escaped quoted values.
---

created: 2026-07-30 07:04
---
Pass 23 H1 also affects initialization publication: parsed empty required fields currently override preserved valid request/display fields. Reopen browser effective-config publication until stable complete bytes are enforced.
---
<!-- COMMENTS:END -->
