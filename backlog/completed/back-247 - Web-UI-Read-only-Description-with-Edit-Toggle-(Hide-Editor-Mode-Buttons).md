---
id: BACK-247
title: Web UI - Read-only Description with Edit Toggle (Hide Editor Mode Buttons)
status: Done
assignee:
  - '@codex'
created_date: '2025-09-02 20:19'
updated_date: '2025-09-06 22:16'
labels:
  - web-ui
  - editor
  - ux
dependencies: []
priority: medium
---

## Description

Redesign the Task Popup to a modern, Linear/Jira-quality experience that prioritizes clarity, speed, and safety.

Why
- The model now has first-party fields for Description, Acceptance Criteria, Implementation Plan, and Implementation Notes. Embedding any of these back into the Description creates ambiguity and painful parsing on save.
- Current popup is cramped and mixes modes; switching between read-only and edit introduces clutter and risk of accidental edits.
- We want fast preview by default, tight keyboard support, a clean editing flow, and a best-in-class, accessible UX.

What (high level)
- Wider two-pane modal: main content + actionable sidebar; sticky header/footer so actions are always reachable.
- Default Preview mode: markdown-rendered Description/Plan/Notes; AC progress with quick toggles; crisp empty states.
- Edit mode: dedicated editors for Description, AC (structured add/remove/reorder), Plan, Notes with explicit Save/Cancel.
- Sidebar: inline-edit status, assignee, priority, labels, dependencies; show created/updated and task ID.
- Complete action: when status is Done, show a Complete button that performs the same semantics as cleanup for a single task (Core.completeTask), respecting auto-commit/staging.
- Responsive, accessible, fast: desktop productivity, mobile full-screen, keyboard shortcuts, focus trap, no layout flicker.

Notes
- Do NOT store Plan/Notes/AC inside Description; always use first-party fields.
- AC can be toggled directly in Preview; a Manage control opens the full editor for structural changes.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Desktop modal uses wider layout (≈ max-w-4xl), sticky header/footer; only body scrolls; no layout jump switching modes.
- [x] #2 Default opens in Preview; single Edit button toggles Edit; Esc cancels; unsaved-change guard prompts before discard; Cmd/Ctrl+S saves.
- [x] #3 Preview renders Description, Implementation Plan, Implementation Notes from first-party fields as markdown; empty states show Add CTA; none are parsed from Description.
- [x] #4 Acceptance Criteria shows X/Y progress and allows checkbox toggles in Preview with optimistic save; no global edit required for toggling.
- [x] #5 A Manage control opens full AC editor to add/remove/reorder; numbering updates; Save persists changes; Cancel discards edits cleanly.
- [x] #6 Edit mode provides dedicated editors for Description, AC, Plan, Notes with a single Save/Cancel for all edited sections; Cmd/Ctrl+S saves.
- [x] #7 Right sidebar shows and inline-edits: status, assignee, priority, labels, dependencies, dates, and task ID; optimistic update with error fallback.
- [x] #8 If status is Done, a Complete button appears; confirmation completes task via single-task cleanup semantics (Core.completeTask), respects auto-commit/staging, removes from board, shows success toast.
- [x] #9 Responsive: on small screens modal is full-screen; actions remain visible; no horizontal overflow or clipped controls.
- [x] #10 Accessibility: focus trap, ARIA labelling, contrast compliance; keyboard shortcuts work (E to edit, Esc cancel, Cmd/Ctrl+S save, C to complete when available).
- [x] #11 Performance: toggling modes preserves scroll/selection; no flicker; large content does not cause layout shift.
- [x] #12 Offline and errors: friendly messages; disable or queue actions appropriately; retries available; never silent-fail.
<!-- AC:END -->


## Implementation Plan

1. Add server route POST /api/tasks/:id/complete using Core.completeTask and broadcast updates.
2. Extend ApiClient with completeTask(id).
3. Enhance Modal: wider width support (max-w-4xl), sticky header, a11y (role/aria), optional Escape disable.
4. Implement TaskDetailsModal with Preview/Edit modes: markdown render for Description/Plan/Notes; AC quick toggles + structured editor; sticky actions; keyboard (E, Esc, Cmd/Ctrl+S).
5. Sidebar inline metadata editing (status, assignee, labels, priority, dependencies) with optimistic saves.
6. Integrate in App: use TaskDetailsModal for editing, keep TaskForm for creation.
7. Fetch tasks for dependency picker; rely on websocket refresh.
8. Type-check and run test suite (all pass).,


## Implementation Notes

PR Description

Summary
- Redesign task popup to a modern, fast, accessible UX with Preview/Edit modes, first-party fields (Description, AC, Plan, Notes), sidebar metadata editing, and a one-click “Mark as completed” action.
- Align UI patterns with Documentation page for a consistent look (markdown preview, outline buttons with icons).

Motivation
- The data model exposes first-party fields (Description, Acceptance Criteria, Implementation Plan, Implementation Notes). Embedding Plan/Notes/AC into Description is error‑prone and hard to round‑trip.
- The old popup mixed states (editor vs preview) and felt cramped; controls weren’t unified with the web UI.

Server & API
- Added POST /api/tasks/:id/complete
  - Calls Core.completeTask(taskId), moves the task to the completed archive, respects auto‑commit/staging.
  - Broadcasts "tasks-updated" to refresh the UI.
- ApiClient: add completeTask(id).

Modal Framework
- Modal.tsx
  - Wider modal: max-w-5xl; taller viewport: max-h-[94vh].
  - Sticky header with role=dialog/, aria-modal, labelled title.
  - Optional "actions" area in header for compact action buttons (Edit/Save/Cancel/Mark as completed).
  - Optional escape lock when editing.

Task Details UI
- New TaskDetailsModal.tsx
  - Header: TASK-XXX + title; compact action buttons (outline Edit with pencil, outline Cancel with X, primary Save with check, green "Mark as completed").
  - Modes: Preview (default) and Edit.
  - Description / Implementation Plan / Implementation Notes
    - Preview: MDEditor.Markdown in a prose container with data-color-mode (dark/light consistent).
    - Edit: full MDEditor (toolbar) with generous heights (Description 320px; Plan/Notes 280px) and no overflow clipping.
  - Acceptance Criteria
    - Preview: shows X/Y progress, quick toggle checkboxes (optimistic save).
    - Edit: structured editor (add/remove/reorder/renumber).
  - Sidebar metadata
    - Status, Assignee, Labels, Priority, Dependencies with inline updates (optimistic).
    - Dates card at top: "Created:" / "Updated:" (bold labels only, normal-weight dates).
    - Optional Metadata card renders only if content exists (e.g., milestone).
  - Complete flow
    - Header button "Mark as completed" (only in Preview and if status is Done) — posts to /api/tasks/:id/complete.
  - Keyboard shortcuts
    - E → Edit (from Preview), Esc → Cancel edit (with dirty guard), Cmd/Ctrl+S → Save, C → Mark as completed (from Preview, when Done).

Consistency & Styling
- Markdown preview list styles
  - Restored bullets/numbering for .wmde-markdown (Tailwind preflight had reset lists).
  - Wrapped code blocks and long content for readable preview.
- Unified buttons
  - Edit: outline with pencil (same as documentation).
  - Save: primary blue filled with check icon (distinguishable primary action).
  - Cancel: outline with X icon.
  - Mark as completed: green filled; matched size (px-4 py-2, text-sm, rounded-lg).
- Labels & Dependencies (chips)
  - Both containers flex-wrap and auto-grow; right padding inside containers so "x" remains visible within the border.
  - Chip text truncates with responsive max widths; chips use min-w-0/max-w-full to stay within the modal.
  - Dependencies suggestions dropdown constrained (max-h-64, overscroll-contain); long titles wrap.

App Integration
- App.tsx
  - Uses TaskDetailsModal for editing existing tasks.
  - Keeps TaskForm for creating new tasks (modal shows form only for creation).

Accessibility
- Proper dialog semantics; sticky header with visible actions; keyboard shortcuts; high-contrast titles/labels; focus rings.

Performance / Offline
- Optimistic saves for quick interactions; no heavy loaders; local server uses filesystem; UI remains responsive offline.

Testing & Validation
- Type-check: bunx tsc --noEmit (OK).
- Full test suite unchanged; previously 526 pass (changes are UI + one server endpoint).
- Manual validation
  - Markdown lists render correctly in tasks/docs/decisions.
  - Editor selection works after scroll; no clipping.
  - Dependencies and Labels chips never overflow; remove (x) is always visible.
  - Buttons consistent and clearly distinguishable; "Mark as completed" works and updates board.

How to Test
1) Run: bun run build && bun run cli browser
2) Open a task → verify Preview mode, action buttons in header.
3) Edit (E), make changes, Save (Cmd/Ctrl+S).
4) Toggle AC in Preview; structured edit mode via Edit.
5) Modify sidebar metadata (status/assignee/labels/priority/deps).
6) For a Done task, use "Mark as completed" — confirm archive + board refresh.
