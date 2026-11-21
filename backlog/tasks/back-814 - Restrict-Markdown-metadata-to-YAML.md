---
id: BACK-814
title: Restrict Markdown metadata to YAML
status: Done
assignee:
  - '@codex'
created_date: '2026-11-20T20:53:00Z'
updated_date: '2026-11-20T21:13:00Z'
labels: []
dependencies: []
references:
  - src/markdown/frontmatter.ts
  - src/test/markdown.test.ts
  - src/markdown/serializer.ts
  - src/markdown/parser.ts
modified_files:
  - src/test/markdown.test.ts
  - src/markdown/frontmatter.ts
  - README.md
  - src/markdown/serializer.ts
  - src/markdown/parser.ts
priority: high
type: bug
ordinal: 413000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reading Backlog Markdown must treat the metadata header as YAML data. A header can currently select another parser. Apply the same rule when preserving existing metadata during an edit, and keep an entered Markdown body separate from its metadata.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reading a Markdown record rejects a non-YAML header before interpreting its contents, including when the header is empty.
- [x] #2 An edit that preserves existing metadata uses the same YAML-only rule. Creating a record preserves header-like text supplied as its Markdown body.
- [x] #3 Existing YAML records keep their dates, aliases and unknown metadata when edited. Markdown without a header still reads normally.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace gray-matter reads and writes and capture the supported behavior with data-only fixtures.
2. Enforce YAML at the shared Markdown boundary and keep new record bodies literal.
3. Run the Markdown and persistence tests, verify native CLI reads and edits, then run the repository checks.

4. Preserve explicitly labeled YAML delimiters in decision edits. A data-only fixture shows the reader accepts this YAML but the writer loses track of its header.

5. Use the shared YAML opening-line rule for record preprocessing. Verify a title-only edit preserves an offset timestamp's written calendar day in plain, labeled and byte-order-marked task files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A data-only JSON header exposed missing checks on both read and metadata-preserving save. A separate regression showed that serializing a new decision consumed header-like body text. All 61 focused tests now pass. A compiled CLI refused both view and edit for an unsupported header without changing the file, and editing a YAML task preserved its anchors and aliases. The README explains the supported header and how to convert an older file.

An explicitly labeled YAML decision already read correctly but changing its status failed. The decision writer now keeps the original opening line. The compiled CLI verified a status edit while preserving the byte-order mark, CRLF line endings, custom metadata and the body.

Cold review reproduced a one-day due-date change on a title edit of a labeled YAML task. Ordinary headers already preserve the written day; record preprocessing must recognize the same YAML headers as the reader.

The reader now checks and normalizes the opening line before record-field preprocessing. Before the fix the due date in a labeled task moved from September 5 to September 4. In the rebuilt CLI, both viewing the task and editing only its title kept September 5 for three labeled or byte-order-marked variants. All 63 focused tests pass.

The original reviewer reran the title-edit case and confirmed the due date is preserved. A separate review checked the final parse/save flow and found no blockers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Backlog reads only YAML metadata. It preserves header-like text entered as a decision body and keeps an explicitly labeled YAML header when editing a decision. Plain, labeled and byte-order-marked YAML follow the same date rules, so a title edit preserves the written due day. The parser remains at js-yaml 4.3.2. The compiled CLI, TypeScript, Biome, two independent reviews and the full local CI test profile verified the fix (3,803 tests passed, 13 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
