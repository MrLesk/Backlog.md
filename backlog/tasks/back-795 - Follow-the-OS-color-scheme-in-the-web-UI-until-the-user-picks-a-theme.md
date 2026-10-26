---
id: BACK-795
title: Follow the OS color scheme in the web UI until the user picks a theme
status: Done
assignee:
  - '@claude'
created_date: '2026-10-26 12:22'
updated_date: '2026-10-26 12:36'
labels:
  - bug
dependencies: []
references:
  - src/web/contexts/ThemeContext.tsx
  - src/web/index.html
  - src/web/components/ThemeToggle.tsx
  - 'https://github.com/MrLesk/Backlog.md/issues/1158'
modified_files:
  - src/test/web-theme.test.tsx
  - src/web/contexts/ThemeContext.tsx
  - src/web/index.html
type: bug
ordinal: 402000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The browser UI never follows a change of the OS light/dark setting. On first load it saves the theme it derived from the OS to localStorage (`backlog-theme`) even though the user chose nothing, so from then on the saved value wins over the OS for good. It also does not listen for `prefers-color-scheme` changes, so an open tab never updates.

Product decision from the reporter: keep the single toggle button. The UI follows the OS until the user toggles; toggling pins the other theme, and toggling back to the theme the OS currently shows returns to following the OS. Because every existing user already has an auto-saved value they never chose, the choice moves to a new storage key so everyone follows the OS once after upgrading.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With no explicit choice, the web UI uses the OS color scheme on load and switches live when the OS scheme changes, without a reload
- [x] #2 Loading the UI without toggling stores no theme choice
- [x] #3 Toggling to the theme the OS does not show pins that theme across reloads and OS changes
- [x] #4 Toggling back to the theme the OS shows clears the choice, so the UI follows the OS again
- [x] #5 A value in the old backlog-theme key is ignored, so existing users follow the OS after upgrading
- [x] #6 The pre-render script in index.html applies the same rule, so the page does not flash the wrong theme
- [x] #7 Tests cover following OS changes, pinning, clearing the choice and ignoring the old key
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ThemeContext: keep the OS scheme in state, updated by a prefers-color-scheme change listener, and an optional explicit choice read from the new backlog-theme-choice key. The shown theme is the choice, else the OS scheme.
2. toggleTheme stores the opposite theme as the choice, or removes the key when that theme equals the OS scheme. Nothing is written on load.
3. index.html pre-render script reads the new key with the same rule.
4. Add src/test/web-theme.test.tsx with a controllable matchMedia: follows OS changes, writes nothing on load, pins, clears, ignores the old key.
5. Check types, Biome, web tests, and the live behaviour in Brave via Playwright emulateMedia.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added src/test/web-theme.test.tsx first; all four cases failed on the old ThemeContext and pass now.
Verified in Brave 1.98.60 through Playwright on a demo project: with the old backlog-theme=dark key and OS light the UI loads light; emulated OS changes switch the theme without a reload and store nothing; toggling to dark while the OS is light stores backlog-theme-choice=dark, which survives OS changes and a reload; toggling back clears the key and the UI follows the next OS change again.
With the app bundle blocked, the index.html pre-render script alone gives: choice dark + OS light -> dark, no choice + OS dark -> dark, choice light + OS dark -> light, old key dark + OS light -> light.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web UI now follows the OS color scheme until the user toggles. ThemeContext keeps the OS scheme in state, updated by a prefers-color-scheme change listener, and only an explicit toggle writes the theme, under the new backlog-theme-choice key. Toggling back to the theme the OS shows removes the key. The old backlog-theme key, which the previous code wrote on every load, is no longer read, so existing users follow the OS after upgrading. The index.html pre-render script applies the same rule. New web-theme tests cover the behaviour; types, Biome, build and all 387 web tests pass, and the behaviour was checked live in Brave.
<!-- SECTION:FINAL_SUMMARY:END -->
