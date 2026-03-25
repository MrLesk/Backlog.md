---
id: BACK-228
title: Replace @uiw/react-md-editor with TOAST UI Editor for rich-text editing
status: To do
assignee: []
created_date: '2025-08-10 14:25'
updated_date: '2025-08-10 18:07'
labels:
  - web-ui
  - enhancement
  - editor
dependencies: []
---

## Description

Replace the current @uiw/react-md-editor with TOAST UI Editor across DocumentationDetail, DecisionDetail, and TaskForm components. The current implementation uses a custom MarkdownEditor wrapper with preview/edit modes - we need to maintain this behavior while adding WYSIWYG capabilities.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Remove @uiw/react-md-editor dependency from package.json
- [ ] #2 Install and configure @toast-ui/editor and @toast-ui/react-editor
- [ ] #3 Implement preview-first UI with edit-on-click behavior
- [ ] #4 Add mode switching between Markdown and WYSIWYG editing
- [ ] #5 Verify markdown export/import functionality works correctly
- [ ] #6 Test editor performance with large markdown documents
- [ ] #7 Replace MarkdownEditor component in DocumentationDetail.tsx to use TOAST UI with preview-first behavior
- [ ] #8 Replace MarkdownEditor component in DecisionDetail.tsx to use TOAST UI with preview-first behavior
- [ ] #9 Update TaskForm.tsx to use TOAST UI Editor instead of MDEditor prop
- [ ] #10 Maintain existing dark mode support using theme context (data-color-mode)
- [ ] #11 Preserve existing placeholder text for each component (docs: 'Write your documentation here...', decisions: 'Write your decision documentation here...')
- [ ] #12 Test that save/cancel functionality works identically to current implementation
- [ ] #13 Use Toast UI Viewer for markdown preview across components
- [ ] #14 Bundle Toast UI CSS (light+dark) under src/web/styles; integrate with ThemeContext; no CDN
- [ ] #15 Persist markdown only; in WYSIWYG, save via editor.getMarkdown()
- [ ] #16 Set usageStatistics: false and sanitize rendered HTML in preview/viewer
- [ ] #17 Define image handling: disable uploads or allow external URLs only; document behavior
- [ ] #18 Lazy-load editor and its CSS in edit mode; keep preview lightweight
- [ ] #19 Ensure code block syntax highlighting on par with current implementation
- [ ] #20 Decisions remain preview-only; do not enable editing
- [ ] #21 Refactor styling to align with the current design system; avoid preserving legacy CSS class names; maintain visual parity without coupling to old class structures
- [ ] #22 Provide a clear, accessible control to switch between Markdown and WYSIWYG while editing; discoverable, labeled, and keyboard accessible
<!-- AC:END -->