---
id: BACK-768
title: Refuse ambiguous replacements of legacy task sections
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 20:59'
updated_date: '2026-10-15 21:10'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1110'
  - src/markdown/structured-sections.ts
modified_files:
  - src/test/legacy-section-replacement.test.ts
  - src/markdown/structured-sections.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/cli-instructions/task-execution.md
priority: high
type: bug
ordinal: 388000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1110 shows that replacing a marker-less description, plan, notes or final summary can silently delete following custom sections. Legacy notes already allow extra level-two headings, so their ownership cannot be inferred safely. Reject destructive edits when that ambiguity would discard content, with guidance that lets a person define the intended section boundary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replacing or clearing an ambiguous legacy structured section fails before writing any task or draft changes, including other fields in the same edit.
- [x] #2 The refusal identifies the section and extra heading and explains how to add the matching BEGIN and END markers around the intended section body.
- [x] #3 CLI and MCP use the same protection for descriptions, plans, notes and final summaries.
- [x] #4 Marked sections, unambiguous legacy sections, append operations and unrelated edits preserve their existing behavior.
- [x] #5 Regression tests cover replacement, clearing, mixed marked and legacy content, multiline Markdown and unchanged bytes after refusal; public CLI instructions describe recovery.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one shared pre-write guard for legacy structured sections: refuse replacement or clearing when an extra level-two heading makes ownership ambiguous; allow unchanged bodies and appends. 2. Keep explicit section markers authoritative and ignore heading-shaped text inside fenced code or raw HTML. 3. Add direct parser, CLI task/draft and MCP regression coverage, including byte-identical refusal and the explicit-marker recovery path. 4. Document recovery in shipped CLI instructions; run targeted regressions, type checks, Biome and the CLI build, then review for simplification and open a focused PR for #1110.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared guard in legacy section removal. It refuses destructive replacement or clearing when a prose level-two heading makes ownership ambiguous, preserves unchanged bodies and appends, and respects marked sections. Reused the existing fence/HTML-aware prose scan for checklist validation and the new guard. Added 24 regression tests covering all four sections, CLI byte preservation with LF and CRLF, combined edits, drafts, MCP, marked recovery, and mixed marked/legacy copies. The 143 focused tests, type checks, Biome and compiled CLI build pass. Built CLI checks refuse all four replacements with exit 1 and byte-identical files; a real MCP stdio call returns VALIDATION_ERROR without writing; explicit-marker recovery succeeds and preserves evidence. Full-suite validation is running with localhost and watcher access after sandbox restrictions blocked the first run.

Final simplification review: kept the guard inside the existing shared section-removal path and extracted the existing prose scan for reuse, with no new exported API. The parser keeps legacy heading ownership unchanged; destructive ambiguity is rejected before storage writes. All acceptance criteria are verified by the focused regressions and compiled CLI/MCP checks. A fresh search still finds no open PR for #1110.

Full shared-process suite finished: 2964 pass, 13 skip, 8 fail, and 1 unhandled JSDOM event error. Reproduced the same eight record-creation failures on unchanged main f50071c9 by importing offline-mode tests before record-creation tests: DEBUG restoration leaves debug output enabled. The baseline record-creation file alone passes all 32 tests. The additional asynchronous dispatchEvent error arose in the existing web App test code; the full run is not clean and this limitation is disclosed in the PR. No changes outside issue #1110 were made.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Protected legacy task and draft structured sections from ambiguous replacement or clearing before storage writes. Errors identify the extra heading and provide the exact BEGIN/END markers needed to define the intended body. Marked sections, unchanged bodies and appends retain existing behavior. Added 24 regressions and public recovery instructions. Verified 143 related tests, type checks, Biome, the CLI build, and real compiled CLI/MCP refusal and recovery. Full shared-process run has eight baseline-reproduced DEBUG leak failures and one asynchronous web DOM error, disclosed for review.
<!-- SECTION:FINAL_SUMMARY:END -->
