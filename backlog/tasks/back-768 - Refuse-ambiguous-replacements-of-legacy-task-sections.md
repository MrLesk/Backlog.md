---
id: BACK-768
title: Refuse ambiguous replacements of legacy task sections
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 20:59'
updated_date: '2026-10-15 21:37'
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
  - src/core/backlog.ts
  - src/markdown/serializer.ts
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

5. Address Codex review: detect valid one-to-three-space heading indentation, route explicit plan/notes/description clears through the shared writer, and recognize quoted angle brackets in complete HTML tag lines. Add refusal and successful-clear regressions, validate the focused suite, resolve the review threads, and request a review of the final commit before merging.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared guard in legacy section removal. It refuses destructive replacement or clearing when a prose level-two heading makes ownership ambiguous, preserves unchanged bodies and appends, and respects marked sections. Reused the existing fence/HTML-aware prose scan for checklist validation and the new guard. Added 24 regression tests covering all four sections, CLI byte preservation with LF and CRLF, combined edits, drafts, MCP, marked recovery, and mixed marked/legacy copies. The 143 focused tests, type checks, Biome and compiled CLI build pass. Built CLI checks refuse all four replacements with exit 1 and byte-identical files; a real MCP stdio call returns VALIDATION_ERROR without writing; explicit-marker recovery succeeds and preserves evidence. Full-suite validation is running with localhost and watcher access after sandbox restrictions blocked the first run.

Final simplification review: kept the guard inside the existing shared section-removal path and extracted the existing prose scan for reuse, with no new exported API. The parser keeps legacy heading ownership unchanged; destructive ambiguity is rejected before storage writes. All acceptance criteria are verified by the focused regressions and compiled CLI/MCP checks. A fresh search still finds no open PR for #1110.

Full shared-process suite finished: 2964 pass, 13 skip, 8 fail, and 1 unhandled JSDOM event error. Reproduced the same eight record-creation failures on unchanged main f50071c9 by importing offline-mode tests before record-creation tests: DEBUG restoration leaves debug output enabled. The baseline record-creation file alone passes all 32 tests. The additional asynchronous dispatchEvent error arose in the existing web App test code; the full run is not clean and this limitation is disclosed in the PR. No changes outside issue #1110 were made.

Addressed all three Codex findings: indented level-two headings now trigger the ambiguity guard; planClear and notesClear preserve an explicit empty value so serialization actually clears or refuses; empty descriptions also reach the writer; complete custom HTML tag lines recognize quoted attribute values and reject malformed attributes. Fourteen additional regressions failed before the changes and now pass. Final scoped validation: 157 Markdown/CLI/section tests, 64 core tests and 39 MCP tests all pass in separate runs (260 total); type checks, Biome and compiled build pass. The separate runs avoid shared-process test interference. Simplification review kept the clear representation consistent with finalSummaryClear and reused existing serialization and scanning paths.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Protected ambiguous legacy structured sections before writes across replacement and explicit clearing. Added recovery instructions and 38 regression tests, including valid indentation, complete HTML attributes, MCP clear requests, LF/CRLF and combined-edit preservation. Appends and marked sections retain existing behavior. Validated 260 targeted tests, type checks, Biome and compiled build. The initial full shared-process run has the documented baseline DEBUG leak and asynchronous DOM error; GitHub CI on the initial PR commit passed its Linux, macOS, Windows, build and Nix checks. Codex review follow-up is ready for validation on the new commit.
<!-- SECTION:FINAL_SUMMARY:END -->
