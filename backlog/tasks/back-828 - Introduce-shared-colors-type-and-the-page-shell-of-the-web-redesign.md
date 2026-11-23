---
id: BACK-828
title: Introduce shared colors, type and the page shell of the web redesign
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-23T20:52:00Z'
updated_date: '2026-11-23T23:58:00Z'
labels:
  - web
dependencies: []
references:
  - src/web/styles/source.css
  - src/web/components/Layout.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/Navigation.tsx
  - .github/backlog-logo.png
  - src/web/components/ThemeToggle.tsx
  - src/web/components/BranchIndexingIndicator.tsx
  - src/web/components/StoredDate.tsx
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/web/App.tsx
  - scripts/smoke-compiled-build.ts
modified_files:
  - src/web/fonts/Geist-Variable.woff2
  - src/web/fonts/GeistMono-Variable.woff2
  - src/web/fonts/OFL.txt
  - src/web/styles/source.css
  - src/web/components/Layout.tsx
  - src/web/components/Navigation.tsx
  - src/web/components/ThemeToggle.tsx
  - src/web/components/BranchIndexingIndicator.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/StoredDate.tsx
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/web/App.tsx
  - scripts/smoke-compiled-build.ts
  - src/web/components/DuplicateIdWarning.tsx
  - src/test/web-side-navigation-loading.test.tsx
priority: medium
type: enhancement
ordinal: 424000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web UI is styled page by page with raw Tailwind gray and blue utilities. It has one theme token, no typeface of its own and no visual link to the Backlog.md logo, so every page looks a little different and none looks like the product.

On 2026-11-23 the maintainer asked for a redesign of the whole web UI and chose to deliver it in place, slice by slice, in normal releases, with no second UI beside the current one. This is the first slice: the shared colors, type and page shell that every later slice builds on. It changes how the app looks, not what it does.

Decisions already made by the maintainer:

- Colors come from the logo. Navy is the text and primary-button color, teal marks work in motion, amber marks something that waits for a person, red marks blocked work. Finished work is shown in plain ink.
- Type is sans with mono details: Geist for labels and text, Geist Mono for IDs, counts, handles, dates and code.
- The sidebar sits directly on the page background. A page's content is one floating panel with a hairline border and a 12 px radius.

Token values:

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| paper | #F2F5F7 | #08121B | page background |
| surface | #FFFFFF | #0D1A26 | panels |
| surface-2 | #EDF1F4 | #132433 | group headers, chips, code |
| hover | #EAEEF2 | #182C3D | row and button hover |
| line | #D6DEE5 | #22384C | hairlines |
| line-soft | #E6EBEF | #172A3B | row separators |
| ink | #0E3149 | #E4EDF3 | text, primary button |
| ink-2 | #455E75 | #A9BBC9 | secondary text |
| ink-3 | #54687A | #8499AA | IDs, counts, hints |
| on-ink | #FFFFFF | #08121B | text on the primary button |
| accent | #00C0C9 | #00C0C9 | logo teal |
| accent-strong | #008A93 | #00C0C9 | teal marks on a surface |
| accent-text | #00717A | #2ED3DB | teal text |
| you, you-bg | #8A5200, #FDF1DA | #F2B552, #2E2410 | waiting for a person |
| blocked, blocked-bg | #B3261E, #FBE6E3 | #F28B82, #36171A | blocked |

Every text color above reaches a contrast ratio of at least 4.5:1 on paper, surface, surface-2 and hover in its own theme (calculated on 2026-11-23).

The drawings are on a private design canvas that the maintainer can share. The values above are the binding part.

Related: BACK-668 replaces dead `rounded-full` classes and stays valid for any page this task does not restyle. BACK-414 asks for a theme hook, which variables make easier but which is not part of this task.

Scope decision by the maintainer on 2026-11-23: this task restyles the shell only. Page content keeps its current colors until the task that redesigns that page, and BACK-837 recolors the pages that have no such task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Colors, radii and hairlines are defined once as CSS variables with the light and dark values listed in the description, and the page shell (page background, sidebar, header row and content panel) reads them instead of raw Tailwind gray and blue utilities.
- [x] #2 Labels and text use Geist. IDs, counts, dates and code that the shell or a shared component renders use Geist Mono; IDs, counts and handles that a page renders inline follow in that page's own task. Both fonts ship inside the build with their license text, and the web UI makes no network request for fonts, checked in the compiled binary.
- [x] #3 The sidebar sits on the page background and each page shows its content in one floating panel with a hairline border, in light and dark.
- [x] #4 The sidebar keeps every destination and control it has today: search, collapse, the task pages, the document tree, the decision list, the create buttons, settings and the version.
- [x] #5 The theme toggle, the stored theme preference and the load without a flash of the wrong theme keep working.
- [x] #6 All text and marks that this task restyles reach a contrast ratio of at least 4.5:1 for text and 3:1 for marks against their background in both themes, checked by calculation.
- [x] #7 Every existing page still works at desktop width and at a narrow width with the existing menu drawer, checked in the running browser UI in light and dark.
- [x] #8 No route, filter, API request, stored value or task behavior changes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Fonts: the upright variable faces of Geist and Geist Mono 1.9.2 and the Geist OFL.txt are vendored in src/web/fonts/ (no npm dependency, so bun.lock and bun.nix are unchanged). @font-face rules in src/web/styles/source.css declare them. Bun embeds a url() file smaller than 128 KiB in the built stylesheet as a data URL, so the compiled binary, source runs and `browser export` carry both fonts and the browser requests none; the smoke script fails if one stops being embedded.
2. License: the complete text of OFL.txt, verbatim, opens source.css as a /*! comment, the only position the minifier keeps, so every build carries it; OFL.txt stays beside the fonts.
3. Tokens: one `@theme static` block holds the 17 colors of the description (light values), the panel, control and chip radii and the two typefaces; a .dark block holds the dark values. "static" keeps every token in the built stylesheet before a utility uses it. Components use Tailwind utilities (bg-paper, text-ink-2, border-line, rounded-panel, font-mono) without dark: variants. Two utilities sit beside them: focus-ring (teal at once, no fade) and section-caption.
4. Text is shown as typed: standard ligatures are off for both typefaces through one value (the mono setting refers to the sans one), which also keeps both layers of the Markdown editor equal; the preview's kbd and tt get the mono setting explicitly.
5. Shell (Layout): body paints paper and ink and fades with the controls; the sidebar sits on paper and every page renders inside one floating panel (surface, 1px line border, 12px radius, 8px gap) that also fades. Narrow widths keep the menu drawer, which sets its own background, text color and edge.
6. Sidebar: every destination and control stays, on tokens, with a brand row (logo and the collapse or close button), 16 px icons and one label column, mono captions and counts, and one navItemClass helper that owns shape, transition, focus ring and state (the current row is the only one in medium weight). The collapsed sidebar's react-tooltip labels use the tokens and carry their own stacking.
7. Header row (Navigation): project name, powered-by link, teal branch indexing chip and the theme toggle, on tokens.
8. Mono details on every page through shared components: StoredDate and the AcceptanceCriteriaProgress count.
9. Page content keeps its colors (maintainer decision; BACK-837 recolors the pages without a redesign task). Tailwind's gray and blue scales are not redefined.
10. Verify with type check, Biome, the web tests, the compiled binary (smoke script, built stylesheets, network, fonts, literal text, tooltip), screenshots of every page and a contrast calculation, recorded in the notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions
- Scope: shell only (maintainer, 2026-11-23). Page content keeps its colors until its own task; BACK-837 recolors the pages that have none. Criterion 2 was narrowed to the shell and the shared components on 2026-11-24.
- Font files: downloaded with the maintainer's approval from github.com/vercel/geist-font at tag v1.9.2: fonts/Geist/webfonts/Geist[wght].woff2 (69,760 bytes), fonts/GeistMono/webfonts/GeistMono[wght].woff2 (71,596 bytes) and OFL.txt (4,384 bytes). Sizes and git blob hashes matched the GitHub API. Stored as Geist-Variable.woff2, GeistMono-Variable.woff2 and OFL.txt. Upright faces only; italic text is synthesized.
- License: OFL.txt sits beside the fonts, and its complete text, verbatim, opens source.css as a /*! comment, the only position the minifier keeps, so every build carries the full license with the fonts.
- Embedding: Bun inlines a url() file into the stylesheet only below 128 KiB (a 131,071-byte file was inlined, a 131,072-byte file became a separate asset). Both fonts are about 70 KB; scripts/smoke-compiled-build.ts fails if one stops being embedded.
- Tokens use @theme static. Without it Tailwind dropped the light value of tokens no utility uses yet, while their dark value in .dark stayed (before: on-ink, you, you-bg, blocked and blocked-bg had only dark values in the built stylesheet).
- Text is shown as typed. With standard ligatures, Geist drew "->", "-->", "<-" and "<--" as arrows and Geist Mono also joined " --" into one dash; "liga" is off for both typefaces. The mono setting refers to the sans one, so they stay equal, which is what keeps the Markdown editor's text area and its highlighted copy the same width. The preview's kbd and tt get the mono setting explicitly, because the library's font shorthand resets it on kbd and the defaults do not cover tt.
- Collapsed-sidebar tooltip: react-tooltip injects its default colors at run time with no specificity and outside any layer; an unlayered :root rule sets them to ink, on-ink and opacity 1. The tooltip carries z-20 itself, so the sidebar root needs no relative or z-index.
- Sidebar: one navItemClass helper owns a row's shape, transition, focus ring and state; the current row is the only one in medium weight, every other label is regular. Icons are 16 px and every label starts in one column. Captions stay mono as drawn, and the counts inside them are mono in the drawer too.
- The theme toggle stays in the header row, type badges keep their colors, and narrow widths keep the menu drawer, which sets its own background, text color and edge because a dialog does not inherit them.
- Tailwind's gray and blue scales are not redefined.

Evidence (headless Chrome over the DevTools protocol against the compiled binary, a fresh profile per run, prefers-color-scheme emulated)
- AC1: the stylesheets of the compiled binary, the outdir build and `dist/backlog browser export` hold all 17 color tokens with their light value in :root and their dark value in .dark (12 of 17 before this review round). Layout, SideNavigation, Navigation, ThemeToggle and BranchIndexingIndicator contain no raw Tailwind gray or blue utility; what is left is the drawer scrim (black/40) and the red error states.
- AC2: in all three stylesheets the leading comment after Tailwind's header is byte for byte OFL.txt, and both faces are embedded. `bun scripts/smoke-compiled-build.ts dist/backlog 1.57.4` passes, with assertions for both faces and a line only the full license text has. Pages served by the binary make no request outside 127.0.0.1, load fonts only from data: URLs, and report Geist and Geist Mono loaded. A task titled "Move config -> settings", the editor lines "ptr->field <!-- note -->" and the Preview of "<kbd>--help</kbd> <tt>e -> f --flag</tt>" render as typed in light and dark; kbd and tt compute Geist Mono with "liga" 0. IDs, counts, dates and code that the shell or a shared component renders are Geist Mono: sidebar counts, search result IDs and scores, the version, StoredDate and the acceptance-criteria count.
- AC3, AC4 and AC7: screenshots of every page (board, All Tasks, Milestones, Drafts, documentation index and page, decision index and page, Statistics, Settings, task dialog) in light and dark at 1440 and 390 px, plus the drawer, the collapsed sidebar with its tooltip and the sidebar search with results. On every page the document does not scroll and the panel's main element is the only scroll container, at both widths. Every control of criterion 4 is present expanded, collapsed and in the drawer.
- Sidebar geometry at 1440 px: every icon starts at x 36 and is 16 px wide, every label starts at x 64; rule to caption 16 px, caption to list 8 px, list to rule 8 px.
- AC5: first visit with a light system: light, stored "light". Toggle: dark class, stored "dark", body #08121B. Reload with the app script blocked: the dark class and #08121B before the app renders. Reload: still dark. Toggle again: light. The switch fades body, panel and sidebar together (halfway: body rgb(61, 69, 76)).
- Focus: the ring is teal the moment Tab lands and 300 ms later. The drawer opened with the keyboard focuses its close button; its ring spans y 2 to 54 inside the 56 px brand row, clear of the search field at 56.
- Tooltip: light #0E3149 with white text, dark #E4EDF3 with #08121B text, opacity 1, z-index 20, painting above the panel.
- Editor: the text area and the highlighted copy compute identical font settings, and their line widths agree within 0.11 px (150.09 and 150.09, 140.59 and 140.58, 259.50 and 259.39).
- AC8: no route, filter, API call, stored key (sideNavCollapsed, docsCollapsed, decisionsCollapsed, docsFolderExpanded, backlog-theme) or task code changed.

AC6 contrast, calculated with the WCAG 2 formula (Tailwind red values converted from oklch to sRGB). Every text token of the description reaches 4.5:1 on paper, surface, surface-2 and hover in its theme (lowest: 4.94 light, accent-text on hover; 4.85 dark, ink-3 on hover). Pairs the shell draws:

| Text or mark (foreground on background) | Light | Dark | Needed |
| --- | --- | --- | --- |
| Wordmark, drawer text, search text on hovered results (ink on paper) | 12.34 | 15.91 | 4.5 |
| Wordmark .md (accent-text on paper) | 5.26 | 10.30 | 4.5 |
| Sidebar items, drawer close button (ink-2 on paper) | 6.17 | 9.56 | 4.5 |
| Hovered item (ink on hover) | 11.59 | 12.07 | 4.5 |
| Current item, search text, project name (ink on surface) | 13.51 | 14.84 | 4.5 |
| Captions, counts, version, result IDs and scores, empty states (ink-3 on paper) | 5.27 | 6.40 | 4.5 |
| Search placeholder, powered by, version in the current Settings row (ink-3 on surface) | 5.77 | 5.97 | 4.5 |
| Backlog.md link (accent-text on surface) | 5.76 | 9.60 | 4.5 |
| Indexing chip (accent-text on surface-2) | 5.08 | 8.63 | 4.5 |
| Collapsed-sidebar tooltip (on-ink on ink) | 13.51 | 15.91 | 4.5 |
| Search error (red-700 / red-400 on paper) | 5.86 | 6.53 | 4.5 |
| Load error text and retry mark (red-700 on red-50 / red-400 on red-900/20) | 5.88 | 6.19 | 4.5 |
| Retry button (white on red-600 / red-700) | 4.76 | 6.42 | 4.5 |
| Mark: sidebar icons, collapse, toggle and create buttons (ink-3 on paper) | 5.27 | 6.40 | 3 |
| Mark: icon on a hovered row (ink-3 on hover) | 4.95 | 4.85 | 3 |
| Mark: header icon buttons (ink-2 on surface) | 6.75 | 8.92 | 3 |
| Mark: tooltip edge against the panel (ink on surface) | 13.51 | 14.84 | 3 |
| Mark: indexing spinner arc (accent-strong on surface-2) | 3.66 | 7.07 | 3 |
| Mark: focus outline (accent-strong on paper / surface) | 3.79 / 4.15 | 8.43 / 7.87 | 3 |
| Logo bars (accent on paper), logotype | 2.04 | 8.43 | none |
| Hairlines, the drawer edge and the outline of the current row (line on paper), decorative | 1.24 | 1.56 | none |

The current sidebar row is told apart by ink text, medium weight and its surface box; the other rows are ink-2 and regular.

Checks
- bun run check:types and bun run check pass.
- All web test files: 381 pass in 42 files. The sidebar loading test now reads the visible text, because the counts sit in their own mono element.
- bun run build, then the smoke script on dist/backlog, pass.
- At 629a6cd3 the full suite through scripts/run-ci-tests.ts (as CI runs it) passed: 3146 and 419 tests. This round changed only web files, the smoke script and one web test.
- Codehygiene finds nothing in the changed lines.

Not verified: Firefox, Safari, and font rendering on Windows and Linux; only Chrome on macOS was used.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Introduces the shared colors, typefaces and page shell of the web redesign. src/web/styles/source.css defines the 17 color tokens (light in @theme static, dark in .dark), three radii, Geist and Geist Mono with standard ligatures off so text shows as typed, and two utilities (focus-ring, section-caption). The fonts are vendored in src/web/fonts with OFL.txt; the built stylesheet embeds both and opens with the full license text, so the browser requests no font. Layout puts the sidebar on the page background and every page into one floating panel; the sidebar, drawer, header row, theme toggle, indexing chip and the collapsed sidebar's tooltips read the tokens and keep every control. Dates and acceptance-criteria counts render in Geist Mono on every page. Page content keeps its colors until its own task (BACK-829 to BACK-833, BACK-837).

Verified with the type check, Biome, all web tests, the compiled-binary smoke checks, checks of the built stylesheets of the binary, the outdir build and the export, network, font, literal-text, tooltip and focus checks in the compiled binary, screenshots of every page in light and dark at 1440 and 390 px, and a contrast calculation.

Not checked in Firefox, Safari or on Windows and Linux.
<!-- SECTION:FINAL_SUMMARY:END -->
