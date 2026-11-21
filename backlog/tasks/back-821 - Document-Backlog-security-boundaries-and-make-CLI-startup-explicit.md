---
id: BACK-821
title: Document Backlog security boundaries and make CLI startup explicit
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T17:35:00Z'
updated_date: '2026-11-21T17:36:00Z'
labels: []
dependencies: []
references:
  - scripts/build.ts
  - SECURITY.md
modified_files:
  - scripts/build.ts
  - SECURITY.md
type: chore
ordinal: 419000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People and agents need a clear security policy and a private reporting path. The distributed CLI should start consistently regardless of Bun configuration files in the working directory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SECURITY.md explains repository trust, operator responsibilities, and how to report a Backlog vulnerability privately.
- [x] #2 Standalone builds disable automatic loading of working-directory Bun configuration and dotenv files.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
- [x] #4 Verify a compiled build and its standard smoke checks.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Set the two startup loading options on standalone builds. 2. Add a root security policy covering repository trust, operator responsibilities, the browser, and private reporting. 3. Verify the built CLI and the documentation.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented repository trust, operator responsibilities, and private reporting. Compiled builds ignore automatic Bun configuration and dotenv loading. Types, Biome, 32 focused tests, the standard compiled smoke checks, and an isolated startup check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
