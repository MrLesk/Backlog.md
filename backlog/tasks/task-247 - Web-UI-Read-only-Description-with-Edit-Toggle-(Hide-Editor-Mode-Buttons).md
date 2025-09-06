---
id: task-247
title: Web UI - Read-only Description with Edit Toggle (Hide Editor Mode Buttons)
status: Done
assignee:
  - '@codex'
created_date: '2025-09-02 20:19'
updated_date: '2025-09-06 21:00'
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

More fixes
- Moved Edit/Save/Cancel/Complete into modal header as compact actions, freeing vertical space.
- Dates (Created/Updated) now at the top of the right column and emphasized with bold text.
- Replaced Labels chip input with an auto-resizing textarea (comma/newline-separated); updates on blur.
- Kept Dependencies label hidden within section to avoid duplication.
