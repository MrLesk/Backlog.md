---
id: BACK-724
title: Render angle brackets inside code correctly in the web Markdown preview
status: To Do
assignee: []
created_date: '2026-10-11 10:43'
updated_date: '2026-10-11 10:43'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1062'
type: bug
ordinal: 342000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the browser, a `<` followed by a letter inside an inline code span or a fenced code block is displayed as the literal text `&lt;`, so `<repo>` written in code shows up as `&lt;repo>`. Placeholders and command metavariables such as `<id>` or `<path>` are normally written in code, so usage and reference text in task descriptions and documents is affected, while the same text in prose displays correctly. Reported on 1.51.0 and confirmed on 1.53.0 in a web task description (issue #1062).

The follow-up comment on the issue that confirms the bug on 1.53.0 has the reproduction with a table of affected and unaffected inputs, and notes that writing the entity or a backslash escape in the source does not help. It traces the cause to a step that rewrites `<` in the raw Markdown before rendering, code included. Treat that as a lead to verify, not as the required fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In the web Markdown preview, `<` and `>` inside an inline code span display as the literal characters, so a code span containing `<repo>` displays `<repo>`.
- [ ] #2 `<` and `>` inside a fenced code block display as the literal characters.
- [ ] #3 Angle brackets in prose, such as `<repo>` or `a < b and c > d`, display as they do today.
- [ ] #4 Autolinks such as `<https://example.com>` and `<user@example.com>` still render as links.
- [ ] #5 HTML sanitizing keeps working as today: raw HTML in the Markdown source that is sanitized today is still sanitized.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
