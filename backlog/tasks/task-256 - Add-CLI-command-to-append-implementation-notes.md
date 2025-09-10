---
id: task-256
title: Add CLI command to append implementation notes
status: In Progress
assignee:
  - '@codex'
created_date: '2025-09-06 21:34'
updated_date: '2025-09-10 11:25'
labels: []
dependencies: []
---

## Description

Background

Current `backlog task edit <id> --notes` replaces the entire Implementation Notes section. In practice, we often want to append notes incrementally (e.g., while progressing a task or after each significant change), without overwriting the prior notes.

Goal

Introduce a dedicated, ergonomic way to append to the Implementation Notes section while preserving existing content, placement rules, and formatting. Keep `--notes` on `task create/edit` as a replace/"set" operation for when a full rewrite is desired.

Proposed UX

- Primary: `backlog task notes append <id> --notes "..."`
  - Appends the provided text to the Implementation Notes section.
  - Creates the section if missing and positions it after Implementation Plan (if present), otherwise after Acceptance Criteria, otherwise after Description, otherwise at the end.
  - Preserves literal newlines, spacing, and does not inject timestamps or auto bullets.
- Aliases for ergonomics:
  - `backlog task notes add <id> --notes "..."` (alias of `append`)
  - `backlog task edit <id> --append-notes "..."` (flag variant for consistency with existing `edit` usage)
- Multi-append support:
  - Accept multiple `--notes` flags in a single call; append in order.
  - Multiple invocations append again and again, never replacing.
- Plain output: support `--plain` to quickly view the updated task.

Docs & Guidance

- README: Add an "Append notes" entry in CLI reference with multi-line examples ('...
...').
- Agent Guidelines: Mention that `--notes` replaces content; use `task notes append` (or `--append-notes`) to add more notes progressively.
- Keep newline handling guidance consistent: shells don’t convert "\n" inside normal quotes; use ANSI‑C '
' or $(printf ...) etc.

Non-goals

- No change to web UI in this task.
- Do not auto-annotate with timestamps or authors; keep content literal and agent-controlled.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Add new command: backlog task notes append <id> --notes "..."
- [ ] #2 Add alias: backlog task notes add <id> --notes "..."
- [ ] #3 Add edit alias: backlog task edit <id> --append-notes "..."
- [ ] #4 If Implementation Notes exists, append with a single blank line between chunks (normalize spacing)
- [ ] #5 If missing, create Implementation Notes section at correct position (after Plan, else AC, else Description, else end)
- [ ] #6 Support multiple --notes flags in one call; append all in given order
- [ ] #7 Preserve literal newlines and spacing; do not add timestamps or bullets
- [ ] #8 Keep existing --notes (create/edit) behavior as replace/set
- [ ] #9 Add tests for append behavior (existing notes, no notes, with plan present, multi-line, multiple appends, alias parity)
- [ ] #10 Update README and Agent Guidelines with examples and clarifications
<!-- AC:END -->

## Implementation Plan

1. Add `task notes append` command + alias `add`
2. Add `--append-notes` to `task edit` (append, not replace)
3. Implement append logic: detect/insert Implementation Notes after Plan, else AC, else Description, else end; normalize with exactly one blank line between chunks
4. Support multiple `--notes` flags per call; append in given order; preserve literal newlines; keep `--notes` existing create/edit behavior as replace/set
5. Add tests: existing notes, no notes, with Plan present, multi-line content, multiple appends, alias parity
6. Update README + Agent Guidelines with examples and newline guidance
