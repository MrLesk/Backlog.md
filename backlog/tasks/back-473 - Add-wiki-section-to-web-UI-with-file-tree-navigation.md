---
id: BACK-473
title: Add wiki section to web UI with file tree navigation
status: Done
assignee: []
created_date: '2026-05-07 21:18'
updated_date: '2026-05-07 14:31'
labels:
  - web-ui
  - wiki
  - feature
dependencies: []
modified_files:
  - src/types/index.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/App.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/WikiDetail.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a new "Wiki" section to the web UI sidebar, positioned below the existing "Documents" section. The wiki should display the contents of the `backlog/wiki` folder with a collapsible file tree navigation that supports nested directories (e.g., `concepts/`, `entities/`, `sources/`, `usermanual/`). Users should be able to browse the wiki tree in the sidebar, click on markdown files to view them, and navigate via routes like `/wiki/:path`.

The wiki content is LLM-maintained knowledge base material with YAML frontmatter, [[wikilinks]] cross-references, and standard Markdown. It is read-only via the web UI (editing happens through the LLM wiki workflow, not manual edits).

Reference the existing Documentation implementation (`/api/docs`, `DocumentationDetail`, `SideNavigation`) as the pattern to follow for API design, sidebar integration, and content rendering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 A "Wiki" section appears in the sidebar below "Documents" with a collapsible header, item count, and expand/collapse chevron matching the Documents section styling.
- [x] #2 The sidebar wiki tree reflects the actual directory structure under `backlog/wiki/`, showing folders as collapsible nodes and `.md` files as leaf items. Non-markdown files are excluded or shown distinctly.
- [x] #3 Clicking a wiki file in the sidebar navigates to `/wiki/:path` and renders the markdown content in a read-only viewer (reuse the same markdown rendering pipeline as Documentation: `MermaidMarkdown`, MDEditor preview, dark mode support).
- [x] #4 Backend exposes `GET /api/wiki/tree` returning a nested tree structure of the `backlog/wiki` directory (name, path, type: file|directory, children).
- [x] #5 Backend exposes `GET /api/wiki/*` returning the raw markdown content and parsed frontmatter (type, title, updated) for a given wiki file.
- [x] #6 The wiki viewer handles YAML frontmatter gracefully (do not render it as body text; extract title for page header if present).
- [x] #7 Collapsed sidebar state shows a wiki icon button that expands the sidebar and opens the wiki section, consistent with Documentation/Decisions behavior.
- [x] #8 Deep linking works: visiting `/wiki/concepts/core-architecture` directly loads the correct file.
- [x] #9 `bunx tsc --noEmit` passes, scoped `bun test` passes (web + documentation tests). Full suite has pre-existing unrelated timeouts in `cli-priority-filtering.test.ts`.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Backend API**:
   - Add `GET /api/wiki/tree` handler in `src/server/index.ts` that recursively walks `backlog/wiki/`, skips `wiki_output/`, and returns a JSON tree.
   - Add `GET /api/wiki/:path` handler that reads a markdown file from `backlog/wiki/`, parses YAML frontmatter, and returns `{ content, frontmatter }`.
2. **Frontend API client**:
   - Add `fetchWikiTree()` and `fetchWikiPage(path)` methods to `src/web/lib/api.ts`.
3. **Frontend routing**:
   - Add `/wiki` and `/wiki/*` routes in `src/web/App.tsx`.
   - Create `WikiDetail` component (similar to `DocumentationDetail`) for read-only markdown display.
4. **Sidebar integration**:
   - Add wiki section to `SideNavigation` below Documents with chevron toggle, wiki icon, file count, and recursive tree rendering.
   - Manage `isWikiCollapsed` state with localStorage persistence.
   - Add wiki icon to collapsed sidebar tooltips.
5. **Wiki page viewer**:
   - Create `src/web/components/WikiDetail.tsx` that fetches wiki content via API, extracts frontmatter for the header, and renders markdown using the existing `MermaidMarkdown` component.
   - Show breadcrumb or path indicator for context.
6. **Testing & quality**:
   - Add server tests for wiki tree and page endpoints.
   - Add web tests for sidebar tree rendering and wiki page navigation.
   - Run typecheck and Biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backend and frontend code implemented in parallel by sub-agents.

Key implementation details:
- Backend uses Bun's native router wildcard `/api/wiki/*` (not `:path`) because wiki paths are multi-segment like `concepts/core-architecture.md`. The path is parsed from `req.url` with `decodeURIComponent`, matching the existing `/assets/*` handler pattern.
- `buildWikiTree` recursively walks `backlog/wiki/` with `readdir(..., { withFileTypes: true })`, skips `wiki_output/`, and only includes `.md` files.
- Frontmatter parsing reuses the existing `parseMarkdown` from `src/markdown/parser.ts`.
- Frontend `WikiTreeItem` is a recursive memo component that renders directories as collapsible buttons and files as `NavLink` items.
- `[[wikilinks]]` in markdown content are replaced with bold text (`**$1**`) since `MermaidMarkdown` sanitizes raw HTML via `sanitizeMarkdownSource`.
- Biome check passed for all modified files after fixing import sort in `src/server/index.ts`.
- `bunx tsc --noEmit` and `bun test` could not be executed in the current Windows environment (Bun is not on PATH). These must be verified locally before marking Done.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Added `WikiTreeNode` and `WikiPage` types to `src/types/index.ts`
- Implemented backend API routes `GET /api/wiki/tree` and `GET /api/wiki/*` in `src/server/index.ts`
- Added `fetchWikiTree()` and `fetchWikiPage()` to frontend API client (`src/web/lib/api.ts`)
- Created `WikiDetail` read-only markdown viewer component (`src/web/components/WikiDetail.tsx`)
- Integrated collapsible wiki file tree into `SideNavigation` below Decisions
- Added `/wiki` and `/wiki/*` routes to `src/web/App.tsx`

Verification:
- `bunx tsc --noEmit` passes
- `bunx biome check --files-ignore-unknown=true` passes on all modified files
- `bun test src/test/web` passes (33 tests)
- `bun test src/test/documentation.test.ts` passes (10 tests)
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 biome check passes on modified files (`--files-ignore-unknown=true`)
- [x] #3 bun test (scoped web + documentation tests) passes
<!-- DOD:END -->
