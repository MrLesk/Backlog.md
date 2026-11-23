---
id: BACK-828
title: Introduce shared colors, type and the page shell of the web redesign
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-23T20:52:00Z'
updated_date: '2026-11-23T22:34:00Z'
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
- [ ] #2 Labels and text use Geist, and IDs, counts, handles, dates and code use Geist Mono. Both fonts ship inside the build with their license files, and the web UI makes no network request for fonts, checked in the compiled binary.
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
1. Fonts: the upright variable faces of Geist and Geist Mono 1.9.2 and the Geist OFL.txt are vendored in src/web/fonts/ (no npm dependency, so bun.lock and bun.nix are unchanged). @font-face rules in src/web/styles/source.css declare them. Bun's HTML bundler embeds them in the built stylesheet as data URLs in the compiled binary, in source runs and in `browser export`, so the browser requests no font. The OFL notice opens source.css as a /*! comment because the minifier keeps such comments only at the top of the output. Geist Mono's ligatures are turned off for font-mono and code, because they join " --" into one dash.
2. Tokens: one @theme block in source.css holds the 17 colors of the description (light values), the panel, control and chip radii and the two font families; a .dark block holds the dark values. Components use Tailwind utilities (bg-paper, text-ink-2, border-line, rounded-panel, font-mono) without dark: variants. Two utilities sit beside them: focus-ring for keyboard focus and section-caption for sidebar captions. body paints paper and ink, so the first paint already has the stored theme.
3. Shell (Layout): the sidebar sits on paper and every page renders inside one floating panel (surface, 1px line border, 12px radius, 8px gap) that holds the header row, the duplicate-ID warning and the scrolling page. Narrow widths keep the menu drawer, which paints paper itself.
4. Sidebar: every destination and control stays, restyled on tokens, with a brand row (logo mark and the collapse or close button), mono captions and counts, and one navItemState helper for the current and the other items.
5. Header row (Navigation): project name, powered-by link, teal branch indexing chip and the theme toggle, on tokens.
6. Mono details on every page through shared components: StoredDate (dates) and the AcceptanceCriteriaProgress count; IDs and code follow --font-mono. The Markdown preview and editor use the two typefaces, and the editor's highlighted copy keeps the same font features as its text area so the caret stays on the text.
7. Page content keeps its colors (maintainer decision; BACK-837 recolors the pages without a redesign task). Tailwind's gray and blue scales are not redefined.
8. Verify with type check, Biome, focused and full tests, the compiled binary, screenshots of every page and a contrast calculation, recorded in the notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions
- Scope: shell only (maintainer, 2026-11-23). Page content keeps its colors; BACK-837 recolors the pages without a redesign task.
- Font files: downloaded with the maintainer's approval from github.com/vercel/geist-font at tag v1.9.2: fonts/Geist/webfonts/Geist[wght].woff2 (69,760 bytes), fonts/GeistMono/webfonts/GeistMono[wght].woff2 (71,596 bytes) and OFL.txt (4,384 bytes). Sizes and git blob hashes matched the GitHub API. Stored as Geist-Variable.woff2, GeistMono-Variable.woff2 and OFL.txt. Upright faces only; italic text is synthesized.
- License in the build: OFL.txt sits beside the fonts in the source tree, the built stylesheet carries the /*! notice (copyright, OFL 1.1, openfontlicense.org), and each font file carries its copyright and license in its name table (IDs 13 and 14). A notice placed after the stylesheet imports was dropped by the minifier, so it opens source.css.
- The theme toggle stays in the header row, type badges keep their colors, and narrow widths keep the menu drawer.
- Sidebar section captions such as TASKS (211) are mono as drawn, so their counts are mono too.
- Geist Mono's standard ligatures joined " --" into one dash (`backlog browser --no-open` read as `browser--no-open`), so "liga" is off for font-mono and code. The Markdown editor's highlighted copy gets normal font features back, so it matches the text area that draws the caret (computed font settings of both layers are identical).
- Tailwind's gray and blue scales are not redefined.

Evidence by criterion (headless Chrome over the DevTools protocol, prefers-color-scheme emulated in a fresh profile per run)
- AC1: the 17 colors, three radii and two typefaces are defined once in src/web/styles/source.css (@theme for light, .dark for dark). Layout, SideNavigation, Navigation, ThemeToggle and BranchIndexingIndicator contain no raw Tailwind gray or blue utility; what is left is the drawer scrim (black/40) and the red error states.
- AC2: `bun run build`, then `bun scripts/smoke-compiled-build.ts dist/backlog 1.57.4` passes, including new assertions that both faces are embedded as woff2 data URLs and that the license notice is present (the same assertions fail on main's stylesheet). Pages served by `dist/backlog browser`: 98 requests over six pages, none outside 127.0.0.1; the only font loads are data: URLs; document.fonts reports Geist and Geist Mono loaded; body text computes to Geist and font-mono elements to Geist Mono. The stylesheet of `dist/backlog browser export` also embeds both faces. IDs, dates (StoredDate), acceptance-criteria counts, sidebar counts, the version and code render in Geist Mono; handles and other counts inside pages follow with their page tasks.
- AC3: screenshots of every page in light and dark at 1440 px show the sidebar on paper and the content in one panel with a hairline border and 12 px radius.
- AC4: search (typed query with results), collapse and expand, Kanban Board, All Tasks, Milestones, Drafts, Statistics, the document tree with its create button, the decision list, Settings and the version are present expanded, collapsed and in the drawer; the sidebar tests pass unchanged.
- AC5: first visit with a light system: light, stored "light". Toggle: dark class, stored "dark", body #08121B. Reload with the app script blocked: html has the dark class and body is #08121B before the app renders. Reload: still dark. Toggle again: light, stored "light".
- AC7: board, All Tasks, Milestones, Drafts, documentation index and page, decision index and page, Statistics, Settings and the task dialog checked in light and dark at 1440 and 390 px, plus the drawer, the collapsed sidebar and sidebar search. On every page the document does not scroll and the panel's main element is the only scroll container, at both widths. Keyboard focus shows a teal outline in the sidebar.
- AC8: no route, filter, API call, stored key (sideNavCollapsed, docsCollapsed, decisionsCollapsed, docsFolderExpanded, backlog-theme) or task code changed; the diff touches styling, the shell markup and the smoke script.

AC6 contrast, calculated with the WCAG 2 formula (Tailwind red values converted from oklch to sRGB). Every text token of the description reaches 4.5:1 on paper, surface, surface-2 and hover in its theme (lowest: 4.94 light, accent-text on hover; 4.85 dark, ink-3 on hover). Pairs the shell draws:

| Text or mark (foreground on background) | Light | Dark | Needed |
| --- | --- | --- | --- |
| Wordmark, search text on hovered results (ink on paper) | 12.34 | 15.91 | 4.5 |
| Wordmark .md (accent-text on paper) | 5.26 | 10.30 | 4.5 |
| Sidebar items, drawer close button (ink-2 on paper) | 6.17 | 9.56 | 4.5 |
| Hovered item (ink on hover) | 11.59 | 12.07 | 4.5 |
| Current item, search text, project name (ink on surface) | 13.51 | 14.84 | 4.5 |
| Captions, counts, version, empty states, result details (ink-3 on paper) | 5.27 | 6.40 | 4.5 |
| Search placeholder, powered by, version in the current Settings item (ink-3 on surface) | 5.77 | 5.97 | 4.5 |
| Backlog.md link (accent-text on surface) | 5.76 | 9.60 | 4.5 |
| Indexing chip (accent-text on surface-2) | 5.08 | 8.63 | 4.5 |
| Search error (red-700 / red-400 on paper) | 5.86 | 6.53 | 4.5 |
| Load error text and retry mark (red-700 on red-50 / red-400 on red-900/20) | 5.88 | 6.19 | 4.5 |
| Retry button (white on red-600 / red-700) | 4.76 | 6.42 | 4.5 |
| Mark: sidebar icons, collapse and create buttons (ink-3 on paper) | 5.27 | 6.40 | 3 |
| Mark: icon on a hovered row (ink-3 on hover) | 4.95 | 4.85 | 3 |
| Mark: header icon buttons (ink-2 on surface) | 6.75 | 8.92 | 3 |
| Mark: indexing spinner arc (accent-strong on surface-2) | 3.66 | 7.07 | 3 |
| Mark: focus outline (accent-strong on paper / surface) | 3.79 / 4.15 | 8.43 / 7.87 | 3 |
| Logo bars (accent on paper), logotype | 2.04 | 8.43 | none |
| Hairlines and the outline of the current item (line on paper), decorative | 1.24 | 1.56 | none |

The search error text was red-600 (4.35:1 on the new paper, 4.56:1 on the old gray-50); it and the collapsed retry mark moved to red-700. The current sidebar item is carried by ink text and medium weight, not by its outline.

Checks
- bun run check:types and bun run check pass.
- Focused tests (sidebar loading, indexing indicator, card dates, acceptance progress): 34 pass.
- Full suite through scripts/run-ci-tests.ts --profile=full --parallel=4 --isolate with the bundled test CLI, as CI runs it: 3146 pass, 13 skip, 0 fail, and 419 pass in the serial DOM pass.
- A plain local `bun run test` reported failures outside the web UI in cli-decision-archive, cli-create-preserves-existing-files, commit-failure-after-change and server-hostname; each of these files passes alone on this branch and on origin/main. scripts/update-nix.test.cjs fails the same way on origin/main under bun; CI runs it with node --test.
- Cold simplicity review applied: editor caret alignment, search error contrast, token and logo comments, the drawer painting its own background, one section-caption utility, and an order-independent font check in the smoke script. Codehygiene flags only JSX depth on the collapsed search button.

Not verified: Firefox, Safari and Windows or Linux font rendering; only Chrome on macOS was used.

AC2 is left unchecked for review: Geist, Geist Mono, the build and the network check are done, and IDs, counts, dates and code are mono in the shell and in the shared date and progress components. IDs, counts and handles that pages render inline (draft, document and decision IDs, column and page counts, card assignees) are still Geist until their page tasks, in line with the shell-only scope; criterion 2 was not narrowed like criteria 1 and 6.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Introduces the shared colors, typefaces and page shell of the web redesign. src/web/styles/source.css defines the 17 color tokens (light in @theme, dark in .dark), three radii, Geist and Geist Mono, and two utilities (focus-ring, section-caption). The fonts are vendored in src/web/fonts with OFL.txt and embedded in the built stylesheet with a license notice, so the browser requests no font. Layout puts the sidebar on the page background and every page into one floating panel; the sidebar, header row, theme toggle and indexing chip read the tokens and keep every control. Dates and acceptance-criteria counts render in Geist Mono on every page. Page content keeps its colors until its own task (BACK-829 to BACK-833, BACK-837).

Verified with the type check, Biome, the CI-style full suite, the compiled-binary smoke checks with new font assertions, a network and font check against the compiled binary, screenshots of every page in light and dark at 1440 and 390 px, a theme first-paint check and a contrast calculation.

Open for review: criterion 2 for IDs, counts and handles that pages render inline. Not checked in Firefox, Safari or on Windows and Linux.
<!-- SECTION:FINAL_SUMMARY:END -->
