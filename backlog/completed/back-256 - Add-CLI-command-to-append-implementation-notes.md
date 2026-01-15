---
id: BACK-256
title: Add CLI command to append implementation notes
status: Done
assignee:
  - '@codex'
created_date: '2025-09-06 21:34'
updated_date: '2025-09-10 18:43'
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
- [x] #1 Add edit alias: backlog task edit <id> --append-notes "..."
- [x] #2 If Implementation Notes exists, append with a single blank line between chunks (normalize spacing)
- [x] #3 If missing, create Implementation Notes section at correct position (after Plan, else AC, else Description, else end)
- [x] #4 Preserve literal newlines and spacing; do not add timestamps or bullets
- [x] #5 Keep existing --notes (create/edit) behavior as replace/set
- [x] #6 Support multiple --append-notes flags in one call; append all in given order
- [x] #7 Add tests for append via edit (existing notes, no notes, with plan present, multi-line, multiple appends)
- [x] #8 Update README and Agent Guidelines with examples and clarifications
<!-- AC:END -->


## Implementation Plan

1. Add --append-notes to task edit (append, not replace)
2. Implement append logic: detect/insert Implementation Notes after Plan, else AC, else Description, else end; normalize with exactly one blank line between chunks
3. Support multiple --append-notes flags per call; append in given order; preserve literal newlines; keep --notes existing create/edit behavior as replace/set
4. Add tests: existing notes, no notes, with Plan present, multi-line content, multiple appends (via edit)
5. Update README + Agent Guidelines with examples and newline guidance


## Implementation Notes

Implemented append behavior for Implementation Notes via `task edit --append-notes` (append-only).

- Preserves literal newlines; normalizes a single blank line between appended chunks
- Creates section at correct position: after Plan > AC > Description > end
- Supports multiple --append-notes flags per call and repeated invocations
- Prevents mixing replace (`--notes`) with append (`--append-notes`)

Added comprehensive tests for: existing notes append, create-when-missing (with Plan), multi-line content, multiple appends, and flag conflict.

Updated README and Agent Guidelines with examples and newline handling guidance.

Validation: bun test (all green), bunx tsc --noEmit, and bun run check . passed.
