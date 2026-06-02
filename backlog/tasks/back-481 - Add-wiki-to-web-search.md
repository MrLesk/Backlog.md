---
id: BACK-481
title: Add wiki to web search
status: Done
assignee: []
created_date: '2026-05-22'
updated_date: '2026-05-22'
labels:
  - web-ui
  - search
  - wiki
  - enhancement
dependencies: []
priority: medium
---

## Description

Currently the web UI search (top-left search box in the browser) only supports three result types: **task**, **document**, and **decision**.
Wiki pages are accessible via their own routes (`/wiki/*`) but are **not indexed** by the shared `SearchService`, so they cannot be found through the unified search.

This task adds wiki pages to the web search scope, allowing users to quickly find wiki content from the global search bar.

## Acceptance Criteria

- [x] #1 Wiki pages are indexed by `SearchService` alongside tasks, documents, and decisions
- [x] #2 `SearchResultType` includes `"wiki"` in type definitions
- [x] #3 Server `/api/search` endpoint accepts `type=wiki` and returns wiki results
- [x] #4 Web search UI (`SideNavigation.tsx`) renders wiki results with correct title/path
- [x] #5 Clicking a wiki search result navigates to the corresponding `/wiki/${path}` page
- [x] #6 Search query syntax `type:wiki <keyword>` works in the web search box
- [x] #7 Existing search behavior for task/document/decision remains unchanged

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Extend type definitions** (`src/types/index.ts`): add `"wiki"` to `SearchResultType`, create `WikiSearchResult` interface.
2. **Add bulk wiki loading** (`src/file-system/operations.ts`): implement `listWikiPages()` to recursively read all `.md` files under `backlog/wiki/` and parse frontmatter.
3. **Extend ContentStore** (`src/core/content-store.ts`): add `wikis` to `ContentSnapshot`, load wiki pages during initialization, wire wiki file watcher to refresh the cache and emit `"wikis"` events.
4. **Extend SearchService** (`src/core/search-service.ts`): add `WikiSearchEntity` with `title` (from frontmatter or filename), `bodyText` (content), and `fileName` (for filename search); include wiki in Fuse index with `fileName` key at weight 0.25.
5. **Update server search endpoint** (`src/server/index.ts`): expand allowed `SearchResultType` list to include `"wiki"`.
6. **Update CLI search** (`src/cli.ts`): add `"wiki"` to `allowedTypes`, skip wiki results in plain-text CLI output (web-only scope).
7. **Update web search UI** (`src/web/components/SideNavigation.tsx`): import `WikiSearchResult`, add wiki icon, render wiki results with title/path metadata, link to `/wiki/${path}`.
8. **Validate**: run `bunx tsc --noEmit`, `bun test` (search-related suites), `bun run check --write`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Architecture decision — chose Option A (extend ContentStore)**
Rather than having SearchService read wiki data directly from FileSystem, wiki pages were integrated into `ContentStore`'s existing snapshot/event pipeline. This keeps the data flow consistent with tasks/documents/decisions and gives SearchService automatic cache invalidation via the wiki file watcher.

**Title resolution for wiki pages**
Wiki files don't have a mandatory `title` field. SearchService derives the display title with this priority:
1. `frontmatter.title` if present and non-empty
2. Filename without `.md` extension

**Search weights**
Wiki pages use the same Fuse.js configuration as other entities, with one additional key:
- `fileName` (weight 0.25) — enables searching by filename even when it doesn't appear in the body text

**CLI scope note**
The `search` CLI command now recognizes `--type wiki`, but wiki results are intentionally skipped in plain-text output because the terminal TUI does not have a wiki viewer. The scope remains web-only per acceptance criteria.

**Verification evidence**
- `bun test src/test/search-service.test.ts` → pass (6 passed, 0 failed)
- `bun test src/test/server-search-endpoint.test.ts src/test/cli-search-command.test.ts` → pass (22 passed, 0 failed)
- `bunx tsc --noEmit` → no new errors (2 pre-existing unrelated warnings in PathAutocomplete.tsx)
- `bun run check --write` → 3 files auto-formatted, no lint errors introduced
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` passes with no new type errors
- [x] #2 `bun run check --write` passes with no new lint/format errors
- [x] #3 `bun test` passes for search-related test suites
- [x] #4 All acceptance criteria are satisfied
<!-- DOD:END -->

## Notes

- The terminal (CLI/TUI) does not support wiki currently; this scope is **web-only**.
- `SearchService` lives in `src/core/search-service.ts` and uses Fuse.js for fuzzy matching.
- Wiki API endpoints (`/api/wiki/*`) already exist; the main work is wiring wiki content into the search index.
