---
id: BACK-494
title: Fix task edit modal keyboard shortcuts interfering with title input
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-27 02:31'
updated_date: '2026-05-28 18:34'
labels: []
dependencies: []
priority: medium
ordinal: 43400
actual_start: '2026-05-28 03:38'
actual_end: '2026-05-28 03:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `TaskDetailsModal` component registers global `window` keydown listeners (capture phase) for shortcuts like `E` (edit), `C` (complete), `D` (demote), `P` (promote), `Ctrl+S` (save), and `Escape` (cancel). These shortcuts fire even when the user is typing into form inputs — most critically the **title input** — making it impossible to enter characters that match shortcut keys.

**Affected shortcuts in `TaskDetailsModal.tsx`:**
- `E` → switches to edit mode
- `C` → completes a done-status task
- `D` → demotes a non-done task
- `P` → promotes a draft task
- `Ctrl/Cmd+S` → saves in edit mode
- `Escape` → cancels edit

**Root cause:**
The global `window.addEventListener("keydown", onKey, { capture: true })` handler does not check whether the event target is an `<input>`, `<textarea>`, or content-editable element before invoking `e.preventDefault()`.

**Expected behavior:**
When focus is inside any text-input element (title, description editor, criteria text, etc.), all modal-level shortcuts should be suppressed so the user's keystrokes reach the input normally.

**Scope:**
- Add an `isTypingTarget(event)` guard to the global keydown handler in `TaskDetailsModal.tsx`.
- Ensure the guard covers `<input>`, `<textarea>`, and `contenteditable` elements.
- Verify no other Web UI modals have the same issue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Typing the letter `E` into the task title input no longer triggers edit mode.
- [x] #2 Typing the letters `C`, `D`, or `P` into any text input inside `TaskDetailsModal` does not trigger their respective actions.
- [x] #3 `Ctrl/Cmd+S` and `Escape` are also suppressed when focus is inside a text-input element.
- [x] #4 Shortcuts continue to work normally when focus is outside text-input elements (e.g. on the modal backdrop or non-input UI).
- [x] #5 The fix uses a reusable `isTypingTarget` helper placed in a shared location (e.g. `src/web/utils/`).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:IMPLEMENTATION_PLAN:BEGIN -->
1. Inspect the global `keydown` listener in `TaskDetailsModal.tsx` to catalog all affected shortcuts.
2. Create a reusable `isTypingTarget` helper in `src/web/utils/keyboard.ts` that detects `<input>`, `<textarea>`, and `contenteditable` elements using duck-typing (no DOM-only `instanceof` checks so tests run outside a browser).
3. Add unit tests for `isTypingTarget` covering inputs, textareas, contenteditable, plain divs, null targets, and non-HTMLElement objects.
4. Insert `if (isTypingTarget(e)) return;` at the top of the global `keydown` handler in `TaskDetailsModal.tsx`.
5. Run TypeScript check, Biome check, and unit tests.
<!-- SECTION:IMPLEMENTATION_PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Duck-typing instead of `instanceof HTMLElement`**
The first version of `isTypingTarget` used `target instanceof HTMLElement`, which fails in Bun's test runner because `HTMLElement` is not defined outside a browser. Switched to duck-typing (`typeof target === "object"`, then read `.tagName` and `.isContentEditable`). This keeps the helper testable in Node/Bun while remaining fully compatible with real DOM elements in the browser.

**Capture-phase listener left intact**
The existing `window.addEventListener("keydown", onKey, { capture: true })` was kept as-is; only an early-return guard was added. This preserves the existing shortcut behavior for non-input focus (e.g. clicking the modal backdrop and pressing `E` still enters edit mode).

**Files modified:**
- `src/web/utils/keyboard.ts` — new helper
- `src/web/utils/keyboard.test.ts` — unit tests
- `src/web/components/TaskDetailsModal.tsx` — added guard + import
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
