---
id: BACK-796
title: Reject line breaks in acceptance criteria while preserving UI wrapping
status: Done
assignee:
  - '@codex'
created_date: '2026-10-28T22:57:00Z'
updated_date: '2026-11-04T19:08:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1040'
  - src/markdown/structured-sections.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/web/components/AcceptanceCriteriaEditor.tsx
  - src/utils/task-builders.ts
  - src/utils/task-edit-builder.ts
  - src/server/index.ts
  - src/mcp/tools/tasks/handlers.ts
modified_files:
  - src/test/acceptance-criteria.test.ts
  - src/test/server-acceptance-criteria.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/acceptance-criteria-manager.test.ts
  - src/utils/acceptance-criteria.ts
  - src/core/backlog.ts
  - src/utils/task-edit-builder.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/server/index.ts
  - src/markdown/structured-sections.ts
  - src/utils/task-builders.ts
  - src/test/web-acceptance-criteria-editor.test.tsx
  - src/web/components/AcceptanceCriteriaEditor.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/mcp/utils/schema-generators.ts
  - src/cli.ts
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/mcp/task-creation.md
  - src/guidelines/mcp/task-execution.md
priority: high
type: bug
ordinal: 402000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1040 exposes multiline criterion input that writes unindexed continuation lines. Alex decided that an acceptance criterion may wrap across visible UI rows but must remain one logical line in the task file, with no line breaks accepted. Reject actual line breaks consistently before saving, keep a wrapping UI field, and leave --clear-ac and ordinary note preservation unchanged. Existing malformed records remain outside this correction and require separate repair.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Creation, addition and replacement reject actual line breaks in acceptance criteria through supported CLI, HTTP and MCP input paths before writing any task changes.
- [x] #2 The browser keeps a wrapping criterion field for long text, rejects actual line breaks and keeps the last valid input available.
- [x] #3 Valid criteria retain their check states and ordinary edits preserve notes and unrelated sections; --clear-ac behavior remains unchanged.
- [x] #4 CLI help and shipped instructions explain one logical line per criterion and repeated entries for separate criteria; regressions verify the rule.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved scope from Alex on 2026-11-04: criteria may wrap in the UI, stored criterion text must be single-line, and --clear-ac remains unchanged.
1. Reuse the existing creation/addition/replacement paths and shared checklist writer. Add one shared single-line validation rule, rejecting CR/LF before trimming or persistence. Preserve existing valid text, check states and notes.
2. Keep the browser textarea and its visual wrapping. Reject Enter and pasted line breaks with a clear error while retaining the last valid value. Scope this rule to acceptance criteria; the same component also serves Definition of Done.
3. Apply the same rule to CLI, HTTP and MCP inputs; keep each --ac or array entry as one criterion. Update help and shipped instructions.
4. Add focused regression checks that fail before implementation, including unchanged files after a refusal, valid separate criteria, UI wrapping/rejection, and unchanged clear/note behavior. Run types, Biome, affected tests and browser verification. Review, publish the PR and address relevant Codex findings.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex chose single-line stored acceptance criteria on 2026-11-04, with visual wrapping in the browser. The explicit --clear-ac change is outside this task; existing malformed continuation text remains unchanged and needs separate repair.

The shared criterion normalizer rejects CR/LF before trimming. CLI and MCP input builders, core creation/addition/replacement, and the checklist writer use that rule. The HTTP adapter leaves criterion text intact until core validation. MCP preserves incoming whitespace until validation so leading or trailing line breaks cannot disappear first. The browser keeps textareas, rejects Enter and multiline paste with an alert, and retains the last valid value. Its shared Definition of Done editor keeps its existing behavior.

Regression evidence: before implementation, CLI creation accepted a multiline value, HTTP returned 201 for a trailing line break, MCP accepted a leading line break, the checklist writer accepted all six tested CR/LF forms, and the browser did not block Enter. Those regressions now pass, including byte-for-byte unchanged task files after rejected edits.

Validation: 152 tests across acceptance-criteria, server, MCP, malformed-checklist and agent-instructions coverage; four DOM tests for the editor and task modal; types, Biome (no warnings), git diff --check, and CLI build all pass. The three test files changed during cleanup were rerun: 82 passed. The CI runner still separates DOM tests from its parallel pass.

Rendered browser verification used an isolated temporary project. A 500-character criterion wrapped across visible rows, Enter and multiline paste left its value intact, and a valid third criterion saved successfully. The stored block contained exactly three checkbox lines and retained the original 500-character text. CLI creation/execution instruction output and help were checked. Existing tests continue to prove check-state, note, unrelated-section and explicit-clear preservation. Self-review found no remaining in-scope blocking finding. This is a bounded validation fix; no new storage format or migration was added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Acceptance criteria now reject actual CR/LF line breaks before trimming or saving across CLI, HTTP, MCP and the shared writer. The browser still wraps long text and preserves the last valid value after a rejected edit. Help and shipped instructions explain separate values for separate criteria.

Verified by failing-then-passing regressions, 156 focused backend/DOM tests, clean type and Biome checks, CLI build, and a rendered browser save checked against the task file.

--clear-ac and note preservation are unchanged. This prevents new malformed records; it does not repair existing stray continuation lines from issue #1040.
<!-- SECTION:FINAL_SUMMARY:END -->
