---
id: BACK-42
title: Visual hierarchy
status: Done
assignee: []
created_date: '2025-06-11'
updated_date: '2025-06-11'
labels:
  - ui
  - enhancement
dependencies: []
---

## Description

Goal: Distinct, consistent heading styles and spacing.

Detailed work:
- Create a Heading helper/component that accepts level ∈ {1, 2, 3}
  - Level 1 → bold bright-white
  - Level 2 → cyan
  - Level 3 → dim white
- In the render pipeline, insert one blank line before every heading
- Refactor existing hard-coded headings to use the helper

## Acceptance Criteria

- [x] Unit test confirms correct color/weight per level
- [x] Snapshot shows a blank line before every heading
- [x] No direct screen.program.write calls remain for headings

## Implementation Notes

Successfully implemented a comprehensive heading system for consistent visual hierarchy across the terminal UI:

### Key Components Created:
- **Heading Helper** (`src/ui/heading.ts`): Core component with 3 distinct heading levels
  - Level 1: Bold bright-white for main titles
  - Level 2: Cyan for section headings  
  - Level 3: Dim white for subsection labels
- **Comprehensive Test Suite** (`src/test/heading.test.ts`): 11 test cases covering all functionality

### Refactoring Completed:
- **Task Viewer UI** (`src/ui/task-viewer.ts`): Replaced all hard-coded bold headings with proper heading levels
- **TUI Components** (`src/ui/tui.ts`): Updated group headings to use Level 2 styling
- **Automatic Spacing**: All headings now include blank lines before them for better visual separation

### Technical Details:
- Blessed tag formatting with proper color codes and bold styling
- Graceful fallback handling when blessed is unavailable
- Consistent spacing implementation across all UI components
- No direct screen.program.write calls found or used

All acceptance criteria have been met with comprehensive test coverage and consistent implementation across the codebase.
