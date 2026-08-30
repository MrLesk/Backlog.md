---
id: BACK-660
title: Reject nested section markers in notes and fix append truncation
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-30 15:23'
updated_date: '2026-08-30 15:48'
labels:
  - cli
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/932'
ordinal: 292000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
buildSectionBlock (src/markdown/structured-sections.ts:249) wraps a notes payload without checking whether the payload itself already contains section sentinel lines; passing content with markers nests them, hides the note from view, and repeated edits do not repair the file (GitHub issue #932, byte-level verified by the reporter on 1.50.1). The same issue documents --append-notes truncating at an end-marker substring. Fix: strip or reject sentinel lines inside payloads with a clear error, and make append locate the real section end rather than a substring match. Distinct from the fenced-code-block work merged in BACK-637.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Writing notes containing section sentinel lines either strips them safely or fails with a clear error; the stored file stays readable
- [x] #2 --append-notes appends correctly when existing content contains marker-like substrings
- [x] #3 A corrupted nested-marker file from before the fix is at least readable by view commands or flagged by doctor
- [x] #4 Tests cover sentinel-in-payload, append-with-marker-substring, and round-trip stability
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Root cause: buildSectionBlock wraps payloads blindly (nesting), and extraction regexes (sentinelBlockRegex and friends) stop at the first end-marker SUBSTRING, so reads truncate and --append-notes persists the loss.
2. Reject, not strip: new section input (description/plan/notes/final summary, including appends) that contains the target section's own sentinel marker as a full line fails with a clear error naming the marker. Rationale: agent-written content is the record; silent stripping alters what the caller asked to store (manifesto: fail closed, review before consequence). Precedent: comment bodies already reject marker content. Scope is per-family only, so BACK-637's fenced cross-family marker round-trips stay valid. Escape hatch: indent the line to store it as literal text.
3. Real boundaries: replace the sentinel-path regexes in structured-sections.ts with one shared line-anchored, depth-aware block scanner (heading, BEGIN line, depth-counted same-family lines, END at depth 0) used by extraction, section ranges, start/end index lookup, and strip. Line-anchor tokenizeKnownSentinels the same way (issue 932's own guidance). Inline marker substrings become inert; append no longer truncates.
4. Corrupted pre-fix files: depth-aware extraction renders the full nested interior (nothing hidden, satisfies readability AC without expanding doctor), and a clean --notes rewrite strips the whole nested region, repairing the file.
5. Validation lives in core (createTaskFromInput + applyTaskUpdateInput) so CLI, MCP, web server, and TUI-create all share it; TUI raw-file editing stays the human escape hatch. buildSectionBlock stays tolerant so corrupted files remain editable.
6. Tests: sentinel-in-payload rejection per surface field, append with inline marker substring, nested-file readability + repair, round-trip stability; keep BACK-637 fence suite green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented. Reject over strip: new section input (create/edit/append, all surfaces via createTaskFromInput + applyTaskUpdateInput) fails with a clear error when it contains the target section's own sentinel marker as a whole line; inline mentions, indented lines, and other families' markers (BACK-637 fence cases) stay legal. Replaced the five sentinel-path regexes in structured-sections.ts with one line-anchored, depth-aware block scanner (findSentinelBlocks), so extraction/append stop truncating at marker substrings, nested pre-fix files render their full interior, and a clean --notes rewrite strips the whole nested region (repairs the file). tokenizeKnownSentinels is now line-anchored per the issue's guidance. New suite src/test/section-marker-safety.test.ts (9 tests; 8 fail on pre-fix code). tsc, biome, and full bun test green except 3 pre-existing tui-emoji-width failures also present on clean origin/main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rejected (not stripped) section payloads carrying their own sentinel marker as a whole line, at the shared core input boundary (createTaskFromInput + applyTaskUpdateInput, covering CLI/MCP/web/TUI-create), and replaced the sentinel regexes in structured-sections.ts with one line-anchored, depth-aware block scanner so reads, appends, strips, and insert positions all agree on the real section boundary. Inline marker mentions no longer truncate --append-notes; pre-fix nested-marker files render their full interior in task view and are repaired by a clean --notes rewrite. Verified with src/test/section-marker-safety.test.ts (9 tests, 8 red on pre-fix code) plus the BACK-637 fence round-trip suite; bunx tsc --noEmit, bun run check ., and full bun test green (3 tui-emoji-width failures pre-exist on origin/main).
<!-- SECTION:FINAL_SUMMARY:END -->
