---
id: doc-4
title: UI Component Color Catalog
type: guide
created_date: '2026-05-25 12:22'
tags:
  - ui
  - colors
  - design-system
  - audit
---
# UI Component Color Catalog

Date: 2026-05-25

## Scope

This is a catalog of the current component color usage so the project can decide how to fix inconsistent card, panel, form, and focus styling.

Reviewed areas:

- `src/ui/components/` terminal UI components.
- `src/web/components/` React web UI components.
- `src/web/App.tsx` loading fallback.
- `src/web/styles/source.css` Tailwind entrypoint and custom CSS.
- `package.json` and repository file list for Storybook presence.
- `backlog/decisions/decision-1 - Use-Tailwind-CSS-v4-for-web-UI-development.md` for existing styling decisions.

## Existing Color Definition Surfaces

### Storybook

No Storybook setup was found.

Evidence:

- `package.json` has no `storybook`, `@storybook/*`, or storybook scripts.
- No `.storybook/` directory was found.
- No `*.stories.*` files were found in the repository file list.

### Tailwind and CSS

The web UI uses Tailwind CSS 4.1 via `src/web/styles/source.css` and `bun run build:css`.

Current reusable styling definitions are minimal:

- `@theme` defines only `--radius-circle`.
- Base body colors are hardcoded as light `#fafafa` / `#171717` and dark `#0a0a0a` / `#fafafa`.
- The MDEditor dark-theme overrides use neutral values and comments such as `neutral-950`, `neutral-900`, `neutral-50`, `neutral-400`, `neutral-500`, `neutral-700`, and `neutral-800`.
- There is no project-level Tailwind color token layer for cards, panels, forms, borders, muted text, or focus rings.

### Project Documentation

The Tailwind ADR only chooses Tailwind v4 and CSS-first configuration. It does not define a palette or component color contract.

No existing Backlog document matched searches for colors, design system, Storybook, theme, or component styling.

## High-Level Findings

The web UI currently has two competing neutral systems:

- `gray-*` is used heavily by older/general pages: documentation, decisions, drafts, initialization, settings, statistics, milestones, loading states, and several form helpers.
- `neutral-*` is used heavily by the newer task-management surfaces: app layout, board, task cards, task columns, task list, modal shell, task details modal, side navigation, and theme toggle.

`stone-*` is not used as a general surface family. It appears mostly as focus-ring color and navigation accent text. This makes it a third neutral-ish family in interactive states, especially on components whose surfaces are otherwise gray or neutral.

The current shape is therefore:

- Surfaces and text: split between `gray` and `neutral`.
- Focus rings: split between `blue`, `stone`, and some `gray`.
- Primary actions: mostly `blue`.
- Destructive/errors: mostly `red`.
- Warnings/read-only/cross-branch: mostly `amber`.
- Success/done/progress: split between `green` and `emerald` depending on component.

## Terminal UI Components (`src/ui/components`)

These use bblessed color names, not Tailwind families. They do not participate in the `gray` / `neutral` / `stone` Tailwind inconsistency, but they also have no shared palette abstraction.

| Component | Surface / Panel | Border / Focus | Text | Selection / Accent | Notes |
|---|---|---|---|---|---|
| `FilterHeader` | Controls use `bg: "black"`; search/button text uses `fg: "white"`. | Container border starts `cyan`; focused container border becomes `yellow`. | Labels inherit default terminal color. | Search focus is black text on cyan; focused popup buttons are white on blue. | No gray usage here. |
| `FilterPopup` | Popup uses `bg: "default"`; content boxes use `bg: "default"`; backdrop uses `bg: "gray"`. | Popup border is `yellow`. | Help text uses `fg: "gray"`; Esc badge uses white text. | Esc badge and selected/hovered list rows use blue background with white text. | This is the only component in `src/ui/components` that uses terminal `gray`. |
| `GenericList` | Default standalone screen uses white foreground on black background. | Default list border is blue; focused border is yellow. | List items default to white; help line uses gray; search line uses cyan. | Selected row uses white on blue. | Hosts can override style, so popup multi-select inherits custom default/blue colors. |

## Web Component Catalog (`src/web/components`)

Neutral-family counts are unique Tailwind color utility tokens detected per component. Counts are directional, not exact render frequency.

| Component | Neutral Families | Main Surface / Panel Colors | Border / Divider Colors | Text Colors | Focus / Interaction Colors | Semantic Colors | Notes |
|---|---:|---|---|---|---|---|---|
| `AcceptanceCriteriaEditor` | `gray`, `stone` (10) | `bg-white`, `dark:bg-gray-800` | `border-gray-300`, `dark:border-gray-600` | `text-gray-700/900`, `dark:text-gray-100/300` | `focus:ring-blue-*` and `focus:ring-stone-*` | blue add/action, red remove | Gray form surface with mixed blue and stone focus rings. |
| `Board` | `neutral` (24) | `bg-neutral-50/70`, `bg-neutral-100/*`, `dark:bg-neutral-900/*`, `dark:bg-neutral-950/50`, cards also `bg-white` | `border-neutral-200`, `dark:border-neutral-800` | `text-neutral-*` | blue primary/focus | red error, emerald progress | Cohesive neutral-family board shell. |
| `BoardPage` | none | none direct | none direct | none direct | none direct | none direct | Delegates presentation to `Board`. |
| `ChipInput` | `gray` (8) | `bg-white`, `dark:bg-gray-800`; chips use blue | `border-gray-300`, `dark:border-gray-600` | `text-gray-*`, `dark:text-gray-*` | blue focus-within | blue chip | Gray form control used inside neutral `TaskDetailsModal`, creating mixed local surface language. |
| `CleanupModal` | `gray` (17) | `bg-gray-100`, `dark:bg-gray-700`, hover gray | `border-gray-200`, `dark:border-gray-700`, `divide-gray-*` | `text-gray-*` | blue action, gray cancel hover | amber warning, red destructive | Used inside neutral `Modal`, so modal shell and content palette differ. |
| `DecisionDetail` | `gray` (21) | `bg-white`, `bg-gray-50`, `dark:bg-gray-800/900` | `border-gray-200/300`, `dark:border-gray-600/700` | `text-gray-*` | blue primary focus and gray secondary focus | yellow/green/red status badges | Entire detail page is gray-family. |
| `DependencyInput` | `gray` (13) | `bg-white`, `bg-gray-100`, `dark:bg-gray-700/800` | `border-gray-300`, `dark:border-gray-600` | `text-gray-*` | blue focus-within | blue chip | Same pattern as `ChipInput`; mixed when used in neutral modal. |
| `DocumentationDetail` | `gray` (21) | `bg-white`, `bg-gray-50`, `dark:bg-gray-800/900` | `border-gray-200/300`, `dark:border-gray-600/700` | `text-gray-*` | blue primary focus and gray secondary focus | red delete/error | Mirrors `DecisionDetail` gray-family page. |
| `DraftsList` | `gray` (18) | `bg-white`, `bg-gray-100`, `dark:bg-gray-900/700`, hover gray | `border-gray-200`, `dark:border-gray-700` | `text-gray-*`, `dark:text-white` | blue/green action focus | red/yellow/green priority, blue assignee | Gray card/list surface. |
| `ErrorBoundary` | `gray` (11) | `bg-gray-100`, `bg-gray-50`, `dark:bg-gray-700/800` | `border-gray-200`, `dark:border-gray-700` | `text-gray-*` | red focus/action | red error/action | Gray page/card with red recovery action. |
| `HealthIndicator` | none | none neutral | none neutral | `text-white` | red focus/action | red disconnected state | No gray/neutral/stone surface. |
| `InitializationScreen` | `gray` (21) | `bg-white`, `bg-gray-50/100/200`, `dark:bg-gray-700/800/900` | `border-gray-200/300`, `dark:border-gray-600/700` | `text-gray-*` | blue focus/action | blue selected, red error, amber/green status text | Gray wizard surface. |
| `Layout` | `neutral` (2) | `bg-neutral-50`, `dark:bg-neutral-950` | none direct | none direct | none direct | none direct | Root layout sets the newer neutral app background. |
| `LoadingSpinner` | `gray` (6) | skeleton `bg-gray-200`, `dark:bg-gray-700` | spinner `border-gray-300`, `dark:border-gray-600` | `text-gray-600`, `dark:text-gray-300` | blue spinner top border | none | Gray loading skeletons inside a neutral-root app. |
| `MermaidMarkdown` | none | none direct | none direct | none direct | none direct | none direct | Delegates visual styling to markdown/editor CSS and rendered SVG content. |
| `MilestoneTaskRow` | `gray` (9) | hover `bg-gray-50`, `dark:hover:bg-gray-700/50` | none direct | `text-gray-*` | none direct | none direct | Used inside `MilestonesPage`, which is gray-family. |
| `MilestonesPage` | `gray`, `stone` (39) | milestone cards/panels/forms use `bg-white`, `bg-gray-50/100/200`, `dark:bg-gray-700/800/*` | `border-gray-100/200/300`, `dark:border-gray-600/700`, `divide-gray-*` | `text-gray-*` | primary buttons blue; search input uses `focus:ring-stone-*` | amber warning, blue/emerald/green/red/yellow status/progress | Main example of gray surfaces plus stone focus rings. |
| `Modal` | `neutral` (13) | shell/header `bg-white`, `dark:bg-neutral-950`; hover `neutral` | `border-neutral-200`, `dark:border-neutral-800` | `text-neutral-*` | neutral close hover | black backdrop | Modal shell is neutral, while some modal contents are still gray. |
| `Navigation` | `neutral`, `stone` (11) | `bg-white`, `dark:bg-neutral-950/95` | `border-neutral-200`, `dark:border-neutral-800` | neutral text plus stone link accents | stone hover/active text | none | Uses stone as nav accent over neutral chrome. |
| `Settings` | `gray`, `stone` (22) | `bg-white`, `bg-gray-100/200`, `dark:bg-gray-700/800` | `border-gray-*`, red validation border | `text-gray-*` | blue action/toggle; `focus:ring-stone-*` for fields | red errors/destructive | Gray form surface with stone focus rings. |
| `SideNavigation` | `neutral`, `stone` (31) | neutral shell; selected/active surfaces use `stone-50`, `dark:stone-900/30`, plus blue active state | `border-neutral-*`, red error borders | neutral text plus stone labels | stone search focus | red error/disconnect, blue connected/action, green/purple indicators | Cohesive neutral shell with stone accents. |
| `Statistics` | `gray` (18) | `bg-white`, `bg-gray-50/100/200`, `dark:bg-gray-700/800/*` | `border-gray-200`, `dark:border-gray-700` | `text-gray-*` | gray hover | blue/green/yellow/red/purple metrics | Gray dashboard cards. |
| `SuccessToast` | none neutral | none neutral | none neutral | `text-white` | green focus | green success | Isolated semantic toast. |
| `TaskCard` | `neutral` (16) | `bg-white`, `dark:bg-neutral-900`, labels `neutral-100/800`, tooltip `neutral-950/800` | `border-neutral-100/800` | `text-neutral-*` | hover shadow only | red/yellow/green priority, amber branch warning | Cohesive neutral card. |
| `TaskColumn` | `neutral` (20) | non-empty columns `bg-white`, `dark:bg-neutral-900`; empty columns `neutral-50/900`; hover neutral | `border-neutral-200/800` | `text-neutral-*` | blue drop indicator | green/yellow/red status/drop | Cohesive neutral column. |
| `TaskDetailsModal` | `neutral`, `stone` (25) | panels/forms `bg-white`, `dark:bg-neutral-900`, code chips `neutral-100/800` | `border-neutral-200/300/700/800` | `text-neutral-*` | field focus `stone`; action focus blue/emerald/red | blue save/link, emerald complete, red archive/error, amber read-only | Newer modal content is mostly neutral; helper subcomponents still use gray. |
| `TaskList` | `neutral`, `stone` (41) | filters/table/popovers `bg-white`, `neutral-100`, `dark:neutral-900/950` | `border-neutral-200/300/600/700/800`, `divide-neutral-*` | `text-neutral-*` | form focus `stone`, action focus blue | amber cross-branch, blue/green/red/yellow badges | Cohesive neutral table with stone focus rings. |
| `ThemeToggle` | `neutral`, `stone` (7) | hover `neutral-100/900` | none direct | `text-neutral-*` | `focus:ring-stone-*` | none | Neutral control with stone focus. |

## App-Level Fallback

`src/web/App.tsx` has a loading fallback using `bg-gray-100 dark:bg-gray-900` and `text-gray-600 dark:text-gray-300`. This differs from `Layout`, which uses `bg-neutral-50 dark:bg-neutral-950`.

## Inconsistency Hotspots

1. Newer task surfaces use `neutral`, while older pages use `gray`.
   - Neutral examples: `Layout`, `Board`, `TaskCard`, `TaskColumn`, `TaskList`, `Modal`, `TaskDetailsModal`, `SideNavigation`.
   - Gray examples: `MilestonesPage`, `DecisionDetail`, `DocumentationDetail`, `DraftsList`, `InitializationScreen`, `Settings`, `Statistics`, `LoadingSpinner`.

2. Modal composition mixes palettes.
   - `Modal` shell is neutral.
   - `TaskDetailsModal` content is mostly neutral.
   - `CleanupModal`, `ChipInput`, `DependencyInput`, and `AcceptanceCriteriaEditor` use gray surfaces/forms.

3. Focus rings are not consistent.
   - Forms in `TaskList`, `TaskDetailsModal`, `Settings`, `MilestonesPage`, and `ThemeToggle` use stone focus rings.
   - Primary actions and many other controls use blue focus rings.
   - Some detail pages use gray focus rings for secondary buttons.

4. Success/done colors are split.
   - `TaskColumn` and many badges use `green` for done/success.
   - `MilestonesPage` uses `emerald` for progress/done counters.
   - `TaskDetailsModal` uses `emerald` for the complete action.

5. There is no shared component-token contract.
   - Repeated concepts such as page background, card/panel surface, muted surface, border, muted text, field, secondary button, primary button, and focus ring are encoded directly in component class strings.

## Suggested Palette Contract To Decide Next

A lightweight markdown decision is likely enough before introducing Storybook. Storybook would help only after there are shared primitives or component examples worth rendering.

Recommended decision points:

1. Choose one neutral family for web surfaces.
   - `neutral` is the stronger candidate because the app root, task board, task cards, task table, modal shell, and task details modal already use it, and the editor dark-theme comments already map to neutral values.
   - If choosing `neutral`, migrate gray card/panel/form/text usages in older pages to equivalent neutral tokens.

2. Decide whether `stone` is a real accent or accidental drift.
   - If the product accent is blue, replace `focus:ring-stone-*` and stone nav text with blue or neutral equivalents.
   - If stone is intended as the subtle brand accent, document it explicitly as the focus/navigation accent and keep it out of general surfaces.

3. Define semantic roles separately from neutral surfaces.
   - Primary action/link: blue.
   - Destructive/error: red.
   - Warning/read-only/cross-branch: amber.
   - Success/done: choose either green or emerald and use it consistently.
   - Priority badges can remain red/yellow/green if that domain mapping is intentional.

4. Add one shared web UI style surface after the palette decision.
   - Avoid a large design-system layer at first.
   - Start with reused constants or tiny primitives for: panel/card, field, secondary button, primary button, muted text, table header, and focus ring.
   - `TaskDetailsModal` already has local constants that can be used as an analog for a small shared style module.

5. Keep terminal UI separate.
   - `src/ui/components` should not try to share Tailwind tokens.
   - If terminal colors need cleanup later, define a small TUI palette for border, focus, selection, help text, backdrop, and primary action.

## Candidate Fix Order

1. Document palette decision: neutral family, focus ring, success family.
2. Convert app-level fallback and loading skeletons to match the chosen web background/skeleton family.
3. Normalize form helpers used inside `TaskDetailsModal`: `AcceptanceCriteriaEditor`, `ChipInput`, and `DependencyInput`.
4. Normalize `CleanupModal` to match `Modal` and other task surfaces.
5. Normalize older gray pages one surface at a time: `MilestonesPage`, `Settings`, `DecisionDetail`, `DocumentationDetail`, `DraftsList`, `Statistics`, `InitializationScreen`.
6. Add lightweight shared classes/primitives only where the same class recipe is repeated after the first normalization pass.

## Extraction Method

This catalog was produced with repository search plus read-only extraction of Tailwind color utility tokens from component source files. The extraction looked for `bg-*`, `text-*`, `border-*`, `ring-*`, `divide-*`, `placeholder-*`, `from-*`, `to-*`, `fill-*`, and `stroke-*` utilities using the color families present in the codebase.
