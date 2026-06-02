---
id: BACK-482
title: Fix wikilink and Markdown relative-link preview in wiki pages
status: Done
assignee:
  - '@agent'
created_date: '2026-05-22 02:02'
updated_date: '2026-05-22 07:22'
labels:
  - web-ui
  - bug
  - wiki
dependencies: []
priority: medium
ordinal: 27001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Clicking a [[wikilink]] that contains '..' (e.g. [[../developer-notes/security-gotchas]]) shows 'Failed to fetch wiki page' error. The backend readWikiPage() treats the raw relative path as wikiRoot-relative, causing the containment check to reject valid parent-directory references.

Additionally, relative Markdown links (e.g. [子任务与依赖](10-任务管理/03-子任务与依赖.md)) in usermanual/ pages navigate to broken URLs instead of opening a preview modal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a [[wikilink]] with '..' resolves the relative path against the current page's directory, then passes the resolved wikiRoot-relative path to the backend.
- [x] #2 Backend containment check still rejects actual directory-traversal attacks (paths escaping wikiRoot).
- [x] #3 Absolute paths in wikilinks are rejected on the frontend before fetching.
- [x] #4 Tests cover parent-directory wikilinks, sibling-directory wikilinks, and traversal-attack wikilinks.
- [x] #5 Relative Markdown links in all wiki pages are intercepted and resolved against the current page directory, opening a preview modal instead of navigating away.
- [x] #6 Markdown links that escape the project root are blocked with a console warning.
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Modify readWikiPage() to accept an optional rootDir parameter, keeping wiki/ as the default.
2. Update handleGetWikiPage() to strip wiki/ prefix from resolved wiki-internal paths, and fallback to backlog project root for sibling-directory references (e.g. wiki_output/).
3. Update resolveWikiPath() to treat the current page as residing under wiki/ for correct relative resolution against the project root; return null only when traversal escapes the project root.
4. Add resolveMarkdownLink() helper for standard Markdown relative paths (no wiki/ prefix).
5. Wire resolveWikiPath() into WikiDetail sanitizedContent and WikiLinkPreview previewContent so wikilinks are resolved at render time; illegal links become strikethrough text (~~text~~).
6. Add click interceptors in both WikiDetail and WikiLinkPreview that resolve relative links before navigation; use useNavigate for SPA transitions in the preview modal.
7. Expand Markdown link interception from usermanual/ only to all wiki pages.
8. Add unit tests and run checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: readWikiPage() was locked to the wiki/ subdirectory, so wikilinks like ../wiki_output/... failed even though the target files live inside the same backlog project. The frontend also passed raw relative paths straight through without resolving them against the current page.

Fix: expanded readWikiPage() containment to the backlog project root via an optional rootDir parameter (still rejects paths escaping the project). Frontend now resolves .. segments using the current page path as base, treating the page as under wiki/ so ../ reaches sibling directories inside the project.

Security: write operations (saveWikiPage/createWikiPage) remain restricted to wiki/; only read access was expanded. Paths that resolve above the project root return null and are rendered as strikethrough text so users cannot click them.

Regression fix: initial change to readWikiPage broke all wiki pages because it switched the root from wiki/ to backlog/. Fixed by making rootDir optional (defaults to wiki/) and adding smart fallback in handleGetWikiPage. All filesystem tests pass.

Additional fix for relative Markdown links in wiki pages:
- Added resolveMarkdownLink() helper for standard Markdown relative paths (no wiki/ prefix).
- Both WikiDetail and WikiLinkPreview now intercept relative links in all wiki pages, decode URL-encoded hrefs, resolve them against the current page directory, and open a preview modal or SPA-navigate instead of letting the browser jump to a broken URL.

Files modified:
- src/file-system/operations.ts
- src/server/index.ts
- src/web/components/WikiDetail.tsx
- src/test/resolve-wiki-path.test.ts
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
