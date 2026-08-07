---
id: BACK-579
title: Document real-newline handling for every multiline Markdown flag
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 20:10'
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
- [x] #1 Every multiline Markdown flag (--description, --plan, --notes, --comment, --final-summary) mentions real-newline handling in its help output
- [x] #2 The guidance includes a concrete shell example using $'...' quoting
- [x] #3 The guidance is attached once at the schema/help level rather than repeated per option string
- [x] #4 No parsing or storage behavior changes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Render current help for task create/edit/draft create and map every multiline Markdown flag.
2. Add a shared 'Markdown fields' note to renderHelpSchema in src/commands/help-schema.ts, emitted once per command whenever the schema declares a Markdown-typed field. Note carries the real-newline rule plus exactly one bash/zsh $'...' example derived from the schema's first Markdown field, so the example is always a valid flag for that command.
3. Complete the task create schema so --notes and --final-summary are typed Markdown like plan/description (they were undocumented despite existing as flags).
4. Drop the now-redundant '(multi-line: include real newlines...)' parenthetical from --description on task create and task edit; keep it on draft create, which has no help schema.
5. Extend src/test/cli-guidance.test.ts to assert the note renders for task create/edit, that the five flags are typed Markdown, that the option-string duplication is gone, and that schemas without Markdown fields are unaffected.
6. Verify with bunx tsc --noEmit, bun run check ., rendered --help output, and full bun test. No parsing or storage changes; \n escape decoding stays unimplemented by design.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Attached the guidance once in renderHelpSchema (src/commands/help-schema.ts): whenever a command's schema declares a field typed exactly "Markdown", the rendered help gains a "Markdown fields:" block with the real-newline rule and one bash/zsh $'...' example. The example flag is derived from the schema's first Markdown field, so it is always a flag the command actually accepts (--description for task create/edit and milestone add, --content for doc update). Commands with no Markdown field (task list, search, config) render unchanged.

Completed the task create schema with notes and final-summary, which already existed as flags but were undocumented; they now render as Markdown alongside description and plan, and carry plan's restriction by reference rather than new copy.

Removed the now-redundant "(multi-line: include real newlines inside the quoted string)" parenthetical from --description on task create and task edit, since the shared block covers it. draft create keeps its inline note: it is the only multiline Markdown flag there and that command has no help schema to hang the shared block on.

Escape decoding was deliberately not implemented. The reporter did not ask for it and the CLI still stores a literal backslash-n exactly as passed; this change is help text only, with no parsing or storage behavior change.

Verified: bunx tsc --noEmit clean; bun run check . clean (357 files); bun run test 1910 pass / 5 skip / 0 fail across 213 files; rendered task create/edit/draft create/doc update/milestone add/task list --help by hand.

Validation: bunx tsc --noEmit, bun run check ., bun run test (1910 pass, 0 fail), plus manual --help rendering for task create, task edit, draft create, doc update, milestone add, and task list.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved the multiline-Markdown newline guidance from a single option string to the help schema renderer, so every Markdown-typed flag documents it. renderHelpSchema now emits a "Markdown fields:" block (real-newline rule plus one bash/zsh $'...' example whose flag is derived from the schema) for any command declaring a Markdown field; task create schema gained the previously undocumented notes and final-summary fields; the redundant per-option parenthetical was dropped from --description on task create and task edit. Help text only, no parsing or storage change, and backslash-n escape decoding stays unimplemented by design. Verified with bunx tsc --noEmit, bun run check ., bun run test (1910 pass, 0 fail), a new cli-guidance help test, and hand-rendered --help output.
<!-- SECTION:FINAL_SUMMARY:END -->
