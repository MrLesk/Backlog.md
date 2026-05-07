---
id: BACK-467
title: Add local file preview with syntax highlighting and line numbers
status: Done
assignee: kuwork
created_date: '2026-04-26'
updated_date: '2026-05-07 09:25'
labels:
  - enhancement
  - web-ui
dependencies: []
references:
  - src/server/index.ts
  - src/web/components/FilePreviewModal.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/TaskDetailsModal.tsx:707-715
  - src/web/lib/api.ts
  - src/web/styles/style.css
  
priority: medium
---

## Description

Add a local file preview feature to the Web UI that allows users to click on local file paths in task References, Documentation, and Markdown content (Description, Plan, Notes, Final Summary) to view file contents directly in a modal.

**Path semantics:** Paths are always resolved relative to the project root (the directory containing `backlog/`). Users should write paths as relative paths from the project root — for example, `src/server/index.ts` or `CLI-INSTRUCTIONS.md`. Absolute paths are not supported, and attempts to traverse above the project root (`../`) are rejected by the API for security.

The preview supports:
- Full file viewing for code and markdown files
- Syntax highlighting via MDEditor.Markdown with Prism
- Line numbers rendered via CSS counters
- Partial line ranges (e.g., `src/server/index.ts:35-39`) with correct offset numbering
- Language detection from file extension for syntax highlighting
- Fallback to normal link behavior when a file does not exist

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backend /api/file-content endpoint reads local files within project root
- [x] #2 API supports optional line ranges (e.g., file.ts:35-39) with security checks
- [x] #3 API prevents directory traversal outside project root
- [x] #4 FilePreviewModal component renders code files with syntax highlighting
- [x] #5 FilePreviewModal displays line numbers using CSS counters
- [x] #6 Partial line ranges show correct starting line numbers
- [x] #7 MermaidMarkdown intercepts local file links to open preview modal
- [x] #8 References and Documentation local paths are clickable in TaskDetailsModal
- [x] #9 Non-existent files fall back to normal browser link behavior
<!-- AC:END -->

## Definition of Done

- [x] All acceptance criteria implemented and verified
- [x] Code reviewed and feedback addressed
- [x] No unrelated changes to existing markdown/link behavior
- [x] Backlog task metadata accurate (correct task ID, assignee, and AC)

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Backend
1. Add `/api/file-content` route to `src/server/index.ts`
2. Parse optional line range from path parameter (`file:lineStart-lineEnd`)
3. Resolve path within project root and reject directory traversal
4. Return file content, path, line range, total lines, and markdown flag

### Frontend API
1. Add `fetchFileContent(path)` to `src/web/lib/api.ts`

### File Preview Modal
1. Create `src/web/components/FilePreviewModal.tsx`
2. Detect language from file extension for fenced code blocks
3. Render markdown files with `MermaidMarkdown`
4. Render code files via `MDEditor.Markdown` wrapped in fenced blocks
5. Add CSS counter-based line numbers with `counterReset` for partial ranges

### Markdown Link Interception
1. Add `onFileClick` prop to `MermaidMarkdown`
2. Custom `a` component for `MDEditor.Markdown`
3. `isExternalLink()` to distinguish URLs from local paths
4. Async click handler: verify file exists via API, then preview or fallback

### Task Details Modal
1. Pass `onFileClick` to all `MermaidMarkdown` instances (Description, Plan, Notes, Final Summary)
2. Render local file paths in References and Documentation as clickable buttons
3. Open `FilePreviewModal` on click
<!-- SECTION:PLAN:END -->
