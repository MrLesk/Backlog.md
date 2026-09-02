---
id: BACK-682
title: Make frontmatter preprocessing robust to valid YAML shapes
status: To Do
assignee: []
created_date: '2026-09-02 20:31'
labels: []
dependencies: []
ordinal: 314000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
preprocessFrontmatter (src/markdown/parser.ts around lines 47-56) works line by line and quotes the value it finds, which assumes block-style YAML with a scalar on the same line. Valid YAML that breaks that assumption is mishandled in two ways.

Values it never sees: flow-style frontmatter such as {id: TASK-1, due_date: 2026-09-05T00:30:00+14:00} bypasses the line matcher entirely, so the value reaches js-yaml unquoted, is resolved to an instant, and the day it was written with is lost. Another tool writing flow YAML is plausible; none of our own writers emit it.

Values it wrongly quotes: a key followed by a comment (due_date: # none), a block scalar, an explicit tag such as !!str, or an alias all get quoted as if they were plain scalars, which makes parsing or normalization throw and the record is then skipped by list loaders. The comment form is realistic in a hand-edited file.

BACK-679 covers the related key-spelling gap for assignee and reporter; this task is about the shapes rather than the key spellings. Deciding not to support some of these is a legitimate outcome, as long as the record degrades visibly instead of disappearing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Flow-style frontmatter preserves a due date as written rather than resolving it to an instant and shifting the day
- [ ] #2 A key followed by a comment, a block scalar, an explicit tag, or an alias no longer causes a parse failure through wrongful quoting
- [ ] #3 Any shape that is deliberately unsupported fails visibly rather than making the record vanish from listings
- [ ] #4 Tests cover each shape for tasks and milestones
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
