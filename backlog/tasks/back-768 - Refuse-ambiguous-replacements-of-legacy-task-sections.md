---
id: BACK-768
title: Refuse ambiguous replacements of legacy task sections
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 20:59'
updated_date: '2026-10-15 22:15'
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
  - package.json
  - bun.lock
  - src/test/implementation-notes.test.ts
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

6. Address the second Codex review: track paragraph state before starting a custom-tag HTML block, recognize empty level-two headings as ambiguous, and parse block openers directly after list markers. Reuse the existing shared scan, test both refusal and valid fenced/HTML examples, and request another review of the final commit.

7. Verify raw-text HTML block endings against CommonMark: any permitted closing raw-text tag ends the block, while a self-closing raw-text tag without intervening whitespace does not start one. Add refusal and valid-example coverage before the final review.

8. Evaluate the latest Codex findings with regressions. Keep ambiguous legacy sections unmarked across unchanged edits and appends, so later replacements remain protected. Correct HTML delimiter, tab-column and blockquote handling, preferably by reusing a complete Markdown parser already available in the runtime. Reconcile recovery documentation with the CLI-only agent workflow. Validate, resolve each review thread and request review of the new head.

9. Preserve safe unchanged/appended legacy sections when an earlier section rewrite normalizes existing extra blank lines. Compare retained bodies using the existing whitespace normalization, add direct and CLI/MCP sequential-edit regressions, and make the raw-tag delimiter mask explicit to avoid the CodeQL escaping warning. Review all findings from the running review before the final push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared guard in legacy section removal. It refuses destructive replacement or clearing when a prose level-two heading makes ownership ambiguous, preserves unchanged bodies and appends, and respects marked sections. Reused the existing fence/HTML-aware prose scan for checklist validation and the new guard. Added 24 regression tests covering all four sections, CLI byte preservation with LF and CRLF, combined edits, drafts, MCP, marked recovery, and mixed marked/legacy copies. The 143 focused tests, type checks, Biome and compiled CLI build pass. Built CLI checks refuse all four replacements with exit 1 and byte-identical files; a real MCP stdio call returns VALIDATION_ERROR without writing; explicit-marker recovery succeeds and preserves evidence. Full-suite validation is running with localhost and watcher access after sandbox restrictions blocked the first run.

Final simplification review: kept the guard inside the existing shared section-removal path and extracted the existing prose scan for reuse, with no new exported API. The parser keeps legacy heading ownership unchanged; destructive ambiguity is rejected before storage writes. All acceptance criteria are verified by the focused regressions and compiled CLI/MCP checks. A fresh search still finds no open PR for #1110.

Full shared-process suite finished: 2964 pass, 13 skip, 8 fail, and 1 unhandled JSDOM event error. Reproduced the same eight record-creation failures on unchanged main f50071c9 by importing offline-mode tests before record-creation tests: DEBUG restoration leaves debug output enabled. The baseline record-creation file alone passes all 32 tests. The additional asynchronous dispatchEvent error arose in the existing web App test code; the full run is not clean and this limitation is disclosed in the PR. No changes outside issue #1110 were made.

Addressed all three Codex findings: indented level-two headings now trigger the ambiguity guard; planClear and notesClear preserve an explicit empty value so serialization actually clears or refuses; empty descriptions also reach the writer; complete custom HTML tag lines recognize quoted attribute values and reject malformed attributes. Fourteen additional regressions failed before the changes and now pass. Final scoped validation: 157 Markdown/CLI/section tests, 64 core tests and 39 MCP tests all pass in separate runs (260 total); type checks, Biome and compiled build pass. The separate runs avoid shared-process test interference. Simplification review kept the clear representation consistent with finalSummaryClear and reused existing serialization and scanning paths.

Addressed the second Codex review: paragraph state prevents complete custom HTML tags from hiding real headings; empty ATX level-two headings now trigger refusal; block openers directly after list markers are recognized. The scan also ends fenced and HTML blocks when their list container ends, retains list context across blank lines, and applies the ordered-list paragraph-interruption rule. Reproduced an additional ordered-list/custom-tag data-loss case before fixing it. Added CLI/MCP byte-preservation and valid-example regressions, for 46 tests in the new regression file. Final validation: 165 focused section/CLI tests, 64 core tests, 39 MCP tests (268 total), type checks, Biome and build all pass. The solution reuses existing block state and helpers and adds no public API or parser dependency.

Additional HTML verification found two data-loss gaps in the existing raw-text scan: a closing raw-text tag may end a different raw-text opening tag, and a directly self-closing raw-text tag does not start an HTML block. Both cases now refuse unsafe replacements. Added coverage for all raw-text tag pairs and whitespace distinctions, plus CLI/MCP byte preservation. Final validation: 167 focused section/CLI tests, 64 core tests and 39 MCP tests (270 total), type checks, Biome and compiled build pass. The regression file contains 48 tests. Final simplification review reuses the shared HTML block matcher; no new dependency or exported helper is needed.

The third review exposed valid Markdown cases and an append-then-replace data-loss path. Replaced the new custom prose scanner with mdast-util-from-markdown, already present through the browser Markdown stack, and declared its existing pinned version directly. The parser handles blockquotes, tab columns, exact HTML delimiters, Setext headings and prior review examples. A narrow offset-preserving mask covers the raw-text self-closing tag exclusion that both tested parsers miss. Ambiguous legacy sections now stay unmarked through appends and unrelated structured edits, preserving protection on later writes. Recovery instructions tell agents to ask the user for marker repair instead of editing record files. Eleven new/expanded regression cases failed before the changes.

Final third-review validation: 174 focused Markdown/CLI/section tests, 64 core tests and 39 MCP tests (277 total) pass; the new file contains 55 regressions. Type checks, Biome, compiled build and compiled CLI/browser/MCP smoke checks pass. Regenerating bun.nix into a temporary file produces identical output. Final simplification replaces more than one hundred lines of new scanner state with the existing CommonMark parser and keeps checklist/whitespace scanners unchanged. CLI and MCP append-plus-unrelated-edit regressions verify that later replacement is refused with byte-identical files.

A final sequential-edit check found that earlier section rewrites normalize extra blank lines before the guard compares an unchanged legacy body. Two regressions failed before normalizing both sides with the existing whitespace helper; they now pass, including CLI/MCP combined edits and later byte-identical refusal. Changed the exact single-delimiter mask to replaceAll to make its intent clear to CodeQL, without changing matched input behavior. Final validation: 175 focused tests, 64 core tests and 39 MCP tests (278 total), 56 new regressions, type checks, Biome, build and compiled CLI/browser/MCP smoke checks pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refuse ambiguous legacy section replacements and explicit clears before persistence across CLI and MCP. Keep ambiguous appends and unchanged sections unmarked so later replacements remain protected, including safe combined edits with extra blank lines. Use the existing CommonMark parser for real top-level headings, preserve Markdown examples, and ask the user to repair marker ownership when necessary. Added 56 regressions and validated 278 related tests, type checks, Biome, build and compiled CLI/browser/MCP smoke checks. The Nix dependency file is unchanged. Initial shared-process suite limitations remain disclosed in the PR.
<!-- SECTION:FINAL_SUMMARY:END -->
