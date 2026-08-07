---
id: BACK-579
title: Document real-newline handling for every multiline Markdown flag
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/804'
priority: low
type: bug
ordinal: 220000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #804. Only --description explains that multiline values need real newlines (src/cli.ts:1705, src/cli.ts:2687, src/cli.ts:3438). The other multiline Markdown flags - --plan, --notes, --comment, and --final-summary - carry no such note, so `--plan "1. First\n2. Second"` silently stores a literal backslash-n instead of a line break. Agents hit this constantly because the guidance is attached to exactly one of five equivalent flags.

The help schema already types all of these fields as "Markdown" (src/cli.ts:2666-2674), so prefer attaching the guidance once at the schema/help level rather than editing five separate option strings. This is a help and documentation change only, with no parsing or storage behavior change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every multiline Markdown flag (--description, --plan, --notes, --comment, --final-summary) mentions real-newline handling in its help output
- [ ] #2 The guidance includes a concrete shell example using $'...' quoting
- [ ] #3 The guidance is attached once at the schema/help level rather than repeated per option string
- [ ] #4 No parsing or storage behavior changes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
