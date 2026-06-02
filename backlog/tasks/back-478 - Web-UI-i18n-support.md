---
id: BACK-478
title: Web UI i18n support
status: Done
assignee:
  - Kimi
created_date: '2026-05-16 15:20'
updated_date: '2026-05-16 18:37'
labels:
  - feature
  - web-ui
  - i18n
  - browser
dependencies: []
priority: medium
ordinal: 7600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add internationalization (i18n) support to the Web UI.

Currently, all user-facing text in the Web UI is hardcoded in English across ~20+ React components (Board, TaskList, Settings, Milestones, Navigation, Modal, etc.). This task extracts all hardcoded strings into a type-safe translation dictionary and allows users to switch languages via Settings.

**Scope:** Web UI only. CLI and TUI are out of scope.
**Languages:** English (`en`), Japanese (`ja`), Chinese Simplified (`zh-CN`), Chinese Traditional (`zh-TW`). Default to `en`.
**Approach:** Zero-dependency lightweight i18n (custom React Context + hook), avoiding heavy libraries like i18next to keep the compiled binary small.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### 1. Infrastructure

Create a lightweight i18n layer under `src/web/`:

```
src/web/
├── locales/
│   ├── index.ts      # Locale union type, loader, and fallback logic
│   ├── en.ts         # English dictionary (default)
│   ├── ja.ts         # Japanese dictionary
│   ├── zh-CN.ts      # Chinese Simplified dictionary
│   └── zh-TW.ts      # Chinese Traditional dictionary
├── contexts/
│   └── I18nContext.tsx   # Provides locale state and t() function
└── hooks/
    └── useI18n.ts        # Hook for consuming translations
```

Requirements:
- Full TypeScript type safety: accessing a missing key should be a compile-time error.
- Support simple string interpolation (e.g., `t.tasks.assignedTo(name)`).
- Compile-time embedding: import translation files as modules so they are inlined into the single-file binary by `bun build --compile`.

### 2. Config Integration

- Add `locale?: string` to `BacklogConfig` in `src/types/index.ts`.
- Expose the field through the existing `/config` API (no backend changes needed if the field is passed through JSON).
- In `Settings.tsx`, add a language selector dropdown (`English` / `日本語` / `简体中文` / `繁體中文`).
- Default behavior: if `locale` is unset, fall back to `en` (or optionally detect `navigator.language`).

### 3. Text Extraction & Replacement

Systematically replace hardcoded English strings in all Web UI components. Key components to cover:

- `Board.tsx` / `BoardPage.tsx` — "Kanban Board", "Loading tasks...", filter labels, swimlane titles
- `TaskList.tsx` — column headers, empty states, search placeholder
- `TaskCard.tsx` / `TaskColumn.tsx` — status labels, priority labels, button tooltips
- `TaskDetailsModal.tsx` — form labels, section headers, action buttons
- `Settings.tsx` — all setting labels, validation messages, success toasts
- `MilestonesPage.tsx` — milestone labels, pool titles, archive section
- `Navigation.tsx` / `SideNavigation.tsx` — nav item labels
- `DocumentationDetail.tsx` / `DecisionDetail.tsx` — editor labels, metadata labels
- `DraftsList.tsx` — page title, empty state
- `Statistics.tsx` — chart labels, metric names
- `CleanupModal.tsx` / `FilePreviewModal.tsx` / `InitializationScreen.tsx` — titles, descriptions, buttons
- `ErrorBoundary.tsx` — error messages
- `SuccessToast.tsx` — toast messages

**Estimated translation keys:** ~300 (4 languages).

### 4. Testing & Validation

- Verify `bunx tsc --noEmit` passes (type-safe keys prevent typos).
- Run `bun run check .` for formatting/linting.
- Manual QA: switch language in Settings and verify all visible text updates without page reload.
- Ensure fallback works when `locale` is missing or invalid.

### 5. Build Verification

- Confirm `bun run build` still produces a working single-file binary.
- Confirm translation dictionaries are embedded (no runtime filesystem reads).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Terminology Decisions
- **Definition of Done** → **完成检查项** (Chinese): renamed from "完成定义" to be more intuitive for non-Agile users.
- **poweredBy** → kept as "Powered by" in Chinese (Traditional) to match common UI conventions.

### Challenges
- **C disk space (ENOSPC)**: `bun build --compile` requires large temp space. Resolved by clearing `%TEMP%` and old `dist/` builds before compiling.
- **Locale persistence**: `locale` field is stored in `BacklogConfig` and serialized to `backlog.config.yml` via `parseConfig`/`serializeConfig`.
- **Settings page i18n lag**: initially only the language selector was i18n'd; all remaining hardcoded labels (project name, port, editor, DoD, etc.) were converted in a follow-up pass.
- **Wiki detail page parity**: `Cancel`/`Edit` buttons and placeholder text were aligned to use the same `t.common.*` keys as the document detail page.

### Components Fully Internationalized
Board, TaskList, TaskDetailsModal, TaskCard, TaskColumn, SideNavigation, Navigation, Settings, Statistics, CleanupModal, InitializationScreen, MilestonesPage, DraftsList, WikiDetail, DocumentationDetail, DecisionDetail, Modal, Toast, ErrorBoundary, HealthIndicator, LabelFilter, AcceptanceCriteria, DependencyInput, FilePreview, PasteAwareMDEditor, MermaidMarkdown.
<!-- DOD:END -->
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 Lightweight i18n infrastructure exists (`locales/`, `I18nContext`, `useI18n`) with full TS type safety
- [x] #2 `BacklogConfig` includes optional `locale` field; Settings page has language selector
- [x] #3 All user-facing text in `src/web/components/` is extracted into translation dictionaries
- [x] #4 Default language is English; Japanese, Simplified Chinese and Traditional Chinese are selectable and fully translated
- [x] #5 `bunx tsc --noEmit` passes
- [x] #6 `bun run check .` passes
- [x] #7 `bun run build` produces a working binary with embedded translations
