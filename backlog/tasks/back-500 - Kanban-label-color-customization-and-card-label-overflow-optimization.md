---
id: BACK-500
title: Kanban label color customization and card label overflow optimization
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-29 18:08'
updated_date: '2026-05-30 02:09'
labels:
  - web-ui
  - enhancement
dependencies: []
priority: medium
ordinal: 158400
actual_start: '2026-05-29 18:37'
actual_end: '2026-05-30 02:09'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Optimize the Kanban board label display and interaction experience.

1. Label color customization: Currently all task card labels use the same default gray background (bg-gray-100 dark:bg-gray-600). Add a clickable color swatch to the right of each label in the LabelFilterDropdown. Clicking it opens a color picker (or preset palette) to set a custom color for that label. Non-default color mappings are persisted to backlog/config.yml (e.g. a new labelColors field). The Web UI reads this config on startup and renders card labels with their assigned background colors.

2. Card label width-aware overflow: Currently TaskCard hard-codes a limit of 3 labels and shows +N for overflow. Change this to dynamically calculate how many labels fit in the available card width, displaying as many as possible before showing +N.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Color swatch appears next to each label in the filter dropdown and opens a color picker on click
- [x] #2 Label color config is persisted to backlog/config.yml (only non-default colors), and survives server restarts
- [x] #3 Card labels render with configured background colors; unconfigured labels keep the existing default gray
- [x] #4 Color picker supports dark mode (preset palette works for both light and dark themes)
- [x] #5 TaskCard label area becomes width-adaptive: measures container width and label widths to show max possible labels before +N
- [x] #6 Label overflow recalculates correctly on window resize or card width changes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `labelColors?: Record<string, string>` to `BacklogConfig` type (`src/types/index.ts`).
2. Update config parse/serialize logic in `src/file-system/operations.ts` to read/write `label_colors` as a YAML inline object.
3. Create shared color utility `src/web/utils/labelColors.ts` with 17 preset colors mapped to Tailwind `bg-*-200` / `dark:bg-*-800` classes.
4. Wire `labelColors` through the component tree: `App.tsx` → `BoardPage` → `Board` → `TaskColumn` → `TaskCard`.
5. Implement `WidthAwareLabels` sub-component in `TaskCard.tsx` using a hidden measurement container + `ResizeObserver` to dynamically compute `visibleCount`.
6. Update `LabelFilterDropdown.tsx`:
   - Add a color swatch button to the right of each label row.
   - Implement inline color picker panel (4×4 grid + default option + save/cancel).
   - Save selected color via `apiClient.updateConfig` and clear default colors from config.
7. Add i18n `common.default` translation across `en/ja/zh-CN/zh-TW`.
8. Fix legacy web tests (`web-board-filters`, `web-task-list-labels-menu`) by wrapping renders in `<I18nProvider>`.
9. Add filesystem tests for `labelColors` persistence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Files modified:**
- `src/types/index.ts` — Added `labelColors` to `BacklogConfig`
- `src/file-system/operations.ts` — `parseConfig`/`serializeConfig` handle `label_colors` as inline YAML object `{ "bug": "red", "feature": "blue" }`
- `src/web/utils/labelColors.ts` — **New**, shared preset palette (17 colors) with light/dark Tailwind mappings
- `src/web/components/LabelFilterDropdown.tsx` — Color swatches per label; inline picker with 4×4 grid, default option, green Save / white Cancel buttons, X icon close
- `src/web/components/TaskCard.tsx` — `WidthAwareLabels` component with `ResizeObserver` + hidden measurement container
- `src/web/components/TaskColumn.tsx` / `Board.tsx` / `BoardPage.tsx` / `App.tsx` — Props plumbing for `labelColors` and `onLabelColorsChange`
- `src/web/locales/*.ts` — Added `common.default` translations
- `src/test/filesystem.test.ts` — Added `labelColors` persistence tests
- `src/test/web-board-filters.test.tsx` / `web-task-list-labels-menu.test.tsx` — Wrapped renders in `<I18nProvider>`; handled extra `/api/config` fetch from provider

**Key decisions:**
- Color format: stored as color key strings (`"red"`, `"blue"`) in config, mapped to Tailwind class pairs via `getLabelColorClasses`. This avoids raw hex/CSS in config and keeps dark mode support.
- Dark mode colors: used solid `dark:bg-*-800` instead of `dark:bg-*-900/40` to eliminate the translucent/dim appearance seen in screenshots.
- Width adaptation fallback: `ResizeObserver` is undefined in JSDOM test environments, so the effect exits early and shows all labels (safe fallback for tests).
- Picker UI: implemented inline within the dropdown menu rather than a separate modal, keeping the interaction lightweight and contextual.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
