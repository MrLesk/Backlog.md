---
id: BACK-828
title: Introduce shared colors, type and the page shell of the web redesign
status: To Do
assignee: []
created_date: '2026-11-23T20:52:00Z'
labels:
  - web
dependencies: []
references:
  - src/web/styles/source.css
  - src/web/components/Layout.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/Navigation.tsx
  - .github/backlog-logo.png
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Colors, radii and hairlines are defined once as CSS variables with the light and dark values listed in the description, and the sidebar, page header, buttons, inputs, chips and badges read them instead of raw Tailwind gray and blue utilities.
- [ ] #2 Labels and text use Geist, and IDs, counts, handles, dates and code use Geist Mono. Both fonts ship inside the build with their license files, and the web UI makes no network request for fonts, checked in the compiled binary.
- [ ] #3 The sidebar sits on the page background and each page shows its content in one floating panel with a hairline border, in light and dark.
- [ ] #4 The sidebar keeps every destination and control it has today: search, collapse, the task pages, the document tree, the decision list, the create buttons, settings and the version.
- [ ] #5 The theme toggle, the stored theme preference and the load without a flash of the wrong theme keep working.
- [ ] #6 All text reaches a contrast ratio of at least 4.5:1 and status or progress marks at least 3:1 against their background in both themes, checked by calculation.
- [ ] #7 Every existing page still works at desktop width and at a narrow width where the menu stacks above the content, checked in the running browser UI in light and dark.
- [ ] #8 No route, filter, API request, stored value or task behavior changes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
