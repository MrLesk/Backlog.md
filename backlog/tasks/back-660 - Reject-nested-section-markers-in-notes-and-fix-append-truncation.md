---
id: BACK-660
title: Reject nested section markers in notes and fix append truncation
status: To Do
assignee: []
created_date: '2026-08-30 15:23'
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
- [ ] #1 Writing notes containing section sentinel lines either strips them safely or fails with a clear error; the stored file stays readable
- [ ] #2 --append-notes appends correctly when existing content contains marker-like substrings
- [ ] #3 A corrupted nested-marker file from before the fix is at least readable by view commands or flagged by doctor
- [ ] #4 Tests cover sentinel-in-payload, append-with-marker-substring, and round-trip stability
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
