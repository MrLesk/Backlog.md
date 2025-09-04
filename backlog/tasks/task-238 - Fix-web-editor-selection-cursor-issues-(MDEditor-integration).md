---
id: task-238
title: Fix web editor selection/cursor issues (MDEditor integration)
status: In Progress
assignee:
  - '@codex'
created_date: '2025-08-17 16:48'
updated_date: '2025-09-04 20:24'
labels:
  - web
  - bug
  - editor
dependencies: []
priority: high
---

## Description

Selection and cursor behave incorrectly in the web UI editor (see #276). Highlighting sometimes targets an invisible layer or misaligns text. This likely stems from how we integrated @uiw/react-md-editor.

Findings:
- We did not import the official CSS for @uiw/react-md-editor and @uiw/react-markdown-preview, which define critical layout/positioning for the overlay/textarea.
- Our global CSS overrides set whitespace wrapping on pre elements (e.g., `.wmde-markdown pre { white-space: pre-wrap !important; }`), which may affect the editor's internal overlay (w-md-editor-text-pre) and cause misalignment with the textarea.
- Global `textarea { resize: vertical }` may also interfere with the editor's layered textarea/highlighter sizing.

Plan:
- Import the official CSS for md-editor and markdown-preview in the web bundle (or copy into our compiled stylesheet) so component styles are applied first.
- Scope our whitespace/overflow overrides to preview-only contexts and explicitly exclude the editor's editing layer.
- Scope textarea resize to exclude the editor (or set `.w-md-editor textarea { resize: none; }`).
- Verify across Chrome/Safari on macOS with a variety of content.

Note: Confirm against the live docs for @uiw/react-md-editor and align with the recommended usage (data-color-mode, CSS imports, height, etc.).

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Import official CSS for @uiw/react-md-editor and @uiw/react-markdown-preview in the web UI build
- [ ] #2 Restrict pre/code wrapping overrides to preview-only; do not affect editor\'s overlay/highlighter
- [ ] #3 Ensure the editor\'s textarea is not resizable; scope global textarea rules accordingly
- [ ] #4 Manual verification: text selection and cursor behave correctly in editor on Chrome/Safari (macOS)
- [ ] #5 Document integration notes: required CSS imports, theme data-color-mode, and what not to override
<!-- AC:END -->

## Implementation Plan

1. Import official CSS for MDEditor and Markdown preview into web bundle
2. Scope pre/code wrapping overrides to preview-only (wmde-markdown), avoid editor overlay
3. Ensure .w-md-editor textarea { resize: none }
4. Manual verification guidance; add brief docs note
