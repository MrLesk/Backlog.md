---
id: BACK-679
title: Quote assignee and reporter under every frontmatter key spelling
status: To Do
assignee: []
created_date: '2026-09-02 20:07'
labels: []
dependencies: []
ordinal: 311000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
preprocessFrontmatter quotes values for keys it matches, but its patterns only recognise the bare key spelling. BACK-678 hit this for due_date and fixed that one key. assignee and reporter have the same gap: their pattern is /^(\s*(?:assignee|reporter):\s*)(.*)$/, so a file written as "assignee": @alex leaves the @ value unquoted, js-yaml throws 'end of the stream or a document separator is expected', and the whole task fails to parse rather than degrading.

Quoted keys are legal YAML, so a task file written by another tool or by hand can be rejected outright. The fix is the same alternation used for due_date, but the blast radius differs: these values feed the flow-list normalisation path, so lists, dash-prefixed entries and empty values all need covering rather than assuming the due_date shape carries over.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 assignee and reporter values are quoted under bare, double-quoted and single-quoted key spellings, and the key is preserved as written
- [ ] #2 A task whose assignee or reporter uses a quoted key parses instead of throwing, with the value read identically to the bare-key spelling
- [ ] #3 Flow lists, dash-prefixed entries and empty values behave the same under every key spelling
- [ ] #4 Tests cover each spelling for both fields, including the @-prefixed value that currently makes the parser throw
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
