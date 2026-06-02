---
id: BACK-423
title: Add folder grouping for docs in Web UI
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-05-22 02:15'
labels:
  - web-ui
  - docs
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/488'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #488: make documentation easier to navigate when docs are organized into folders or path groups.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Documentation list groups documents by folder or comparable path/type grouping.
- [x] #2 Users can expand and collapse groups without losing access to flat docs.
- [x] #3 Existing document create/view/edit behavior continues to work for ungrouped docs.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Backend**: Add `DocsTreeNode` type and filesystem operations (`getDocsTree`, `createDocsFolder`).
2. **Backend**: Expose `GET /api/docs/tree` and `POST /api/docs/folder` endpoints.
3. **Frontend API**: Add `fetchDocsTree()` and `createDocsFolder()` to `ApiClient`.
4. **Frontend state**: Load `docsTree` in `App.tsx` and pass through `Layout` to `SideNavigation`.
5. **Frontend components**:
   - Build `DocTreeItem` recursive component with expand/collapse and `localStorage` persistence.
   - Build `DocActionDropdown` for folder-level actions (create file / create folder).
   - Replace flat document list in `SideNavigation` with tree rendering.
6. **New document flow**: Support `?path` query parameter in `DocumentationDetail` to pre-fill target folder.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Why a separate `docsTree` instead of building from `docs` array

The `docs` array only contains `.md` files parsed by `listDocuments()`. Empty folders do not appear in that array. To support "create folder without creating a document first", the sidebar needs a tree scan that includes directories. We added `getDocsTree()` (similar to `getWikiTree()`) which walks the filesystem directly.

### Tree node title resolution

`getDocsTree()` parses the document ID from the filename (`{id} - {title}.md`), but does not read file contents for performance. The frontend resolves the human-readable title by looking up `docId` in the already-loaded `docs` array. If the lookup fails (rare race condition), the component falls back to the sanitized filename.

### Document rename behavior

Unlike Wiki pages (where the filename is independent of content), documents use the convention `{id} - {title}.md`. The backend's `saveDocument()` already handles title changes by renaming the file and deleting the old one. Therefore the docs tree does not need a standalone rename action in the sidebar — users rename by editing the document title.

### New document path pre-fill

When a user clicks "Create file" inside a folder, the sidebar navigates to `/documentation/new?path=<folderPath>`. `DocumentationDetail` reads the `path` search parameter on mount (when `id === 'new'`) and sets it as the initial `docPath` state. On save, `createDoc()` receives this path and stores the file in the correct subdirectory.

### Create folder flow

Clicking "Create folder" opens a modal. The frontend calls `POST /api/docs/folder { path: "parent/subdir" }`. The backend uses `normalizeDocumentSubPath()` for sanitization and performs a directory-traversal containment check before calling `mkdir`. After success, `onRefreshData()` reloads the full `docsTree`.

### No `filteredDocs` in tree view

The previous flat list used `filteredDocs` (which was just `docs`). With the tree view, search results are still shown in the unified search dropdown above the nav sections; the document tree always renders the full `docsTree` so folder structure is preserved.
<!-- SECTION:NOTES:END -->

## Files Changed

- `src/types/index.ts`
- `src/file-system/operations.ts`
- `src/server/index.ts`
- `src/web/lib/api.ts`
- `src/web/App.tsx`
- `src/web/components/Layout.tsx`
- `src/web/components/SideNavigation.tsx`
- `src/web/components/DocumentationDetail.tsx`
