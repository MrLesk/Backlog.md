---
id: BACK-503
title: Task completion in the last year
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-30 17:18'
updated_date: '2026-05-31 10:06'
labels:
  - web-ui
  - feature
  - statistics
  - visualization
dependencies: []
priority: medium
ordinal: 162400
actual_start: '2026-05-30 17:18'
actual_end: '2026-05-31 10:06'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a GitHub-style contribution heatmap to the top of the Web UI Statistics page, showing the number of tasks completed each day over the past year.

Reference style:
- Title format: locale-aware, e.g. "{count} contributions in the last year" (with correct pluralization for English)
- Grid layout: 7 rows (Sun-Sat) x ~53 columns (weeks), matching GitHub's Sunday-start convention
- Width fills container via CSS Grid `repeat(53, 1fr)`, no fixed aspect ratio per cell
- Left weekday labels: Sun, Tue, Thu (or localized equivalents) — Mon/Wed/Fri in original plan changed to align with Sunday-start
- Top month labels: localized abbreviated month names
- Cell color intensity represents daily completed task count
- Bottom legend: Less -> More gradient
- Hover and click tooltip: shows specific date (YYYY-MM-DD) and count
- Supports both light and dark mode with GitHub official color palettes

**Additional requirements discovered during implementation:**
- Server-side statistics caching with auto-refresh: `cachedStatisticsResponse`, 500ms debounced `invalidateStatistics()` triggered by ContentStore change events, WebSocket broadcast `"statistics-updated"`
- Client-side `localStorage` cache for instant page load
- i18n locale switching must not be overridden by background data refreshes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Statistics API /api/statistics returns daily task completion counts for the past year
- [x] #2 Heatmap component renders at the top of the Statistics page
- [x] #3 Heatmap shows month labels, weekday labels, and legend
- [x] #4 Hovering/clicking a cell shows tooltip with date and completion count
- [x] #5 Color intensity correctly maps to task count levels (0 / 1-2 / 3-5 / 6-9 / 10+)
- [x] #6 Supports responsive layout and dark mode
- [x] #7 All i18n files (en/zh-CN/zh-TW/ja) include heatmap translations
- [x] #8 Server-side statistics cache auto-invalidates on task changes and pushes updates via WebSocket
- [x] #9 Locale switcher (ja / zh-TW / zh-CN / en) works reliably without being overwritten by background refreshes
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### 1. Backend: Extend statistics module (src/core/statistics.ts)
- Add `completionHeatmap: Record<string, number>` to `TaskStatistics` interface
  - Key: YYYY-MM-DD date string
  - Value: number of tasks completed on that date
- In `getTaskStatistics()`, compute heatmap data:
  - Iterate all tasks with `status === "Done"`
  - Prefer `actualEnd` as completion date, fallback to `updatedDate`
  - Use `parseStoredUtcDate()` for date parsing
  - Only include data within the past 365 days
  - Format date as YYYY-MM-DD key, accumulate counts
- The data auto-serializes via `handleGetStatistics()` in `src/server/index.ts`

### 2. Backend: Server-side statistics caching (src/server/index.ts)
- Add `cachedStatisticsResponse`, `statisticsDebounceTimer`, `statisticsDirty` fields
- `invalidateStatistics()`: mark dirty, null cache, schedule 500ms debounce → `recomputeAndBroadcastStatistics()`
- `recomputeAndBroadcastStatistics()`: fetch snapshot, compute stats, serialize JSON, broadcast `"statistics-updated"` via WebSocket
- `handleGetStatistics()`: return cached JSON if available, else compute on-demand
- In `ensureServicesReady()` subscribe callback, call `invalidateStatistics()` on **all** ContentStore change events (including `"ready"`)

### 3. Frontend: Heatmap component (src/web/components/Statistics.tsx)
- Add `ContributionGraph` React sub-component, accepting `data` and `total` props
- Generate full date grid for the past year, organized by weeks (7 days x up to 53 weeks)
- **Week starts from Sunday** (changed from Monday to match GitHub)
- Grid layout: CSS Grid `repeat(53, 1fr)`, cells fill width, no fixed aspect ratio
- Level 0 cells: no border, transparent/background-matching
- UI structure:
  - Title: locale-aware with correct pluralization (0/1/N)
  - Month label row based on week start dates (localized)
  - Weekday label column: localized abbreviations
  - Main grid: small cells with gap, no stretching
  - Bottom legend: Less -> 5 color levels -> More
- **Colors use inline `style` instead of Tailwind classes** (due to Bun CSS build crash on Windows)
  - Light mode: `#ebedf0` → `#216e39` (GitHub official)
  - Dark mode: `#161b22` → `#39d353` (GitHub official)
- Separate `hoveredCell` and `clickedCell` states for tooltip
- Tooltip shows date (YYYY-MM-DD) and count
- Insert heatmap below Header, above Key Metrics Cards
- Client cache: save to `localStorage` as `backlog-statistics`, listen to `"statistics-updated"` WS event

### 4. Frontend: i18n locale switching fix (src/web/App.tsx)
- In `loadAllData()`, only call `setLocale(configData.locale)` on **first load** (`isFirstLoad`)
- Prevents background data refreshes (WebSocket events) from overriding user's manual locale selection

### 5. i18n translations
Add to `statistics` namespace in all 4 locale files:
- `contributionTitle(count)`: locale-aware with pluralization
- `less`, `more`, `mon`, `wed`, `fri`
- `tasksCompletedOn(count, date)`
Files: `src/web/locales/en.ts`, `zh-CN.ts`, `zh-TW.ts`, `ja.ts`

### 6. Tests
- Update `src/test/statistics.test.ts`:
  - Verify `completionHeatmap` field exists
  - Verify Done tasks group correctly by actualEnd/updatedDate
  - Verify tasks older than 1 year are excluded
- Run `bun test statistics.test.ts`, `bunx tsc --noEmit`, `bun run check .`

### 7. Build & verify
- `bun run build`
- Start Web UI and verify heatmap renders correctly in both light and dark mode
- Verify statistics auto-refresh after CLI task creation
- Verify locale switching works for ja / zh-TW / zh-CN / en
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Bug 1: Statistics cache auto-refresh not working
**Symptom:** After creating a new task via CLI, the Statistics page still showed old data (e.g. 194 tasks instead of 195).

**Root cause:** Two issues:
1. `invalidateStatistics()` was not placed correctly in the ContentStore subscribe callback
2. `getTaskStatistics()` contained debug `console.log("[heatmap] task=...")` calls that output hundreds of lines per recomputation, blocking the Bun event loop for several seconds and causing API timeouts

**Fix:**
- Ensure `invalidateStatistics()` is called for **all** event types in `ensureServicesReady()` subscribe callback
- Remove all `[heatmap]` debug logs from `src/core/statistics.ts`

### Bug 2: i18n locale switching reverts to Chinese
**Symptom:** Switching to Japanese or Traditional Chinese in Settings still displayed Chinese text.

**Root cause:** `App.tsx`'s `loadAllData()` unconditionally called `setLocale(configData.locale)` on every invocation. `loadAllData()` is triggered by WebSocket events (`tasks-updated`, `config-updated`) and other background refreshes, so the user's manual locale selection was immediately overwritten by the server config's old locale value.

**Fix:** Only sync locale from server config on the first load:
```typescript
if (isFirstLoad && configData.locale && isValidLocale(configData.locale)) {
    setLocale(configData.locale);
}
```
`I18nContext` already handles initial locale loading from config on mount, so `App.tsx`'s repeated override was redundant.

### Technical constraints
- **Bun CSS build crash on Windows:** `bun run build:css` causes Stack Overflow. New Tailwind classes cannot be added via CSS files. All heatmap colors must use inline `style` attributes.
- **ContentStore watcher behavior on Windows:** `fs.watch` may trigger `"rename"` events for file creation, causing `refreshTasksFromDisk()` to be called, which reloads all back-* tasks and can clear non-back-* tasks from memory.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
