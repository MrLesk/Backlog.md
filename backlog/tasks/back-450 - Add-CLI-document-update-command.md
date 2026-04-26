---
id: BACK-450
title: Add CLI document update command
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-26 13:21'
updated_date: '2026-04-26 13:22'
labels:
  - feature
  - cli
  - documentation
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/610'
  - 'https://github.com/MrLesk/Backlog.md/pull/598'
modified_files:
  - src/cli.ts
  - src/test/cli.test.ts
  - src/guidelines/agent-guidelines.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-436 aligned document create/update behavior in core, Web/server APIs, and MCP, but the shipped CLI still exposes only `backlog doc create`, `backlog doc list`, and `backlog doc view`. Add a public CLI document update command so CLI users can update document content and metadata through the same core document contract instead of editing markdown files directly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog doc update <docId>` updates an existing document through the core document update contract and preserves existing metadata when options are omitted.
- [ ] #2 The command exposes user-facing options for updating title, content, type, tags, and docs-relative path, with help text matching supported document types and path rules.
- [ ] #3 The command rejects missing documents, invalid document types, and unsafe absolute/traversal paths with clear CLI failures rather than corrupting files.
- [ ] #4 CLI regression tests cover content/metadata updates, path moves, metadata preservation, and at least one invalid input case.
- [ ] #5 Agent/CLI guidance is updated so document management instructions include the new CLI update path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a `backlog doc update <docId>` CLI subcommand next to the existing `doc create/list/view` commands.
2. Reuse `Core.updateDocumentFromInput` as the single persistence path. Load the current document first so omitted options preserve existing content/title/type/tags/path.
3. Expose `--title`, `--content`, `-t/--type`, `-p/--path`, and repeatable/comma-delimited `--tags` options. Let core validation handle missing docs, invalid document types, and unsafe paths, then surface those errors through CLI stderr with non-zero exit code.
4. Add focused CLI tests for content/metadata updates, metadata preservation, path moves, and invalid input.
5. Update agent/CLI guidance to document the new CLI update command, then run scoped CLI tests plus `bun run check .` and `bunx tsc --noEmit`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context check before implementation: BACK-436 added `Core.updateDocumentFromInput` and Web/MCP document updates, but `src/cli.ts` still registers only `doc create`, `doc list`, and `doc view`. Existing CLI document tests live in `src/test/cli.test.ts` under `doc and decision commands`; document types are constrained by `DOCUMENT_TYPE_VALUES`. Chosen implementation keeps CLI as a thin adapter over core rather than duplicating document path or type validation.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
