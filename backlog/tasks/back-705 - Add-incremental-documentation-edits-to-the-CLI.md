---
id: BACK-705
title: Add incremental documentation edits to the CLI
status: Done
assignee:
  - '@codex-documentation-flags'
created_date: '2026-09-27 23:13'
updated_date: '2026-09-27 23:39'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1027'
  - 'https://github.com/MrLesk/Backlog.md/pull/1028'
type: enhancement
ordinal: 335000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the existing MCP addDocumentation and removeDocumentation operations through the canonical task and draft edit CLI, using the same shared task-update primitive and established reference-flag conventions. Issue #1027 identifies this surface gap; BACK-597 recorded documentation as its follow-up. Preserve explicit --doc replacement behavior. Use contributor work from closed PR #1028 where it fits and retain its authorship; maintainer edits are disabled on that branch.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task and draft edits can add or remove documentation entries through the existing shared operations, preserving other entries and avoiding duplicates.
- [x] #2 New flags follow reference-flag conventions for repeated and comma-separated values, invalid empty input, mutually exclusive replacement or clear operations, and interactive command handling.
- [x] #3 Existing --doc replacement and MCP documentation behavior remain unchanged; CLI help and shipped instructions clearly distinguish replacement, addition, and removal.
- [x] #4 Behavioral tests prove successful updates and unchanged task bytes on rejected edits; contributor authorship is retained.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Expose --add-doc and --remove-doc in src/cli.ts through the existing shared task/draft edit options, parsing, validation, edit builder, and Core update operations. Preserve --doc replacement and empty clearing, --clear-docs, duplicate avoidance, and the existing add-then-remove order.
2. Match reference flags for repeatable/comma-separated input, per-flag blank rejection, replacement/clear conflicts, and direct handling when isTTY is true. Do not add model, MCP, configuration, creation, assignee, or batch behavior.
3. Update canonical help/reference in src/cli.ts and CLI-INSTRUCTIONS.md, plus the shipped src/guidelines/cli-instructions/task-execution.md. Leave legacy guidelines unchanged after tracing their consumers.
4. Extend src/test/cli-refs-docs.test.ts with bounded task/draft cases using its existing fixtures and simulated-isTTY helper. Verify adds/removes, duplicates, repeated/comma forms, replacement/clear compatibility, help, unrelated field preservation, and complete unchanged file bytes after each rejected command.
5. Verify with a freshly built CLI bundle, focused CLI tests, existing draft/MCP/documentation/reference/instruction regression tests, type checking, Biome, and live source CLI commands. Preserve all failure and rerun evidence accurately.
6. Keep the implementation small: reuse createMultiValueAccumulator for --doc and the existing shared helpers. Preserve original contributor commit e718efe2 and its attribution during coordinator integration, obtain architecture review, and finalize the task from the saved evidence. The coordinator owns publication.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Planning evidence (2026-09-27): read MANIFESTO.md, AGENTS.md, CLI overview/execution/creation instructions, context-hunter, BACK-597 completed record, issue #1027, PR #1028, and the saved contributor patch. Task and draft edit share addEditFieldOptions/runEditCommand; buildTaskUpdateInput already maps both documentation operations and Core.applyTaskUpdateInput already applies them for locked task and draft edits. MCP task_edit publicly exposes addDocumentation/removeDocumentation and src/test/mcp-refs-docs.test.ts already checks schema plus persisted set/add/remove behavior.
Live before probe used a temporary --no-git project and the current source CLI: task create with docs/a.md,docs/b.md succeeded; task edit --doc docs/c.md replaced the list with only c; task edit --add-doc docs/d.md exited 1 with unknown option and unchanged file bytes. Task and draft edit help both lack --add-doc/--remove-doc.
Prospective implementation files are exactly src/cli.ts, src/guidelines/agent-guidelines.md, and src/test/cli-refs-docs.test.ts. The original patch is a suitable base. Its main proof gaps are checking only the parsed documentation list after rejection and having no draft behavior tests; cover both using existing fixture/helpers. Shared-model semantics settle names, deduplication, and removal order, so no new product decision was found. Waiting for source writer release; no source or test files changed.

Coordinator approved the shared-primitive plan and requested continued waiting for BACK-704 to release src/cli.ts. Contributor attribution remains recorded above. No source/test changes made.

Implementation ready for architecture review; source frozen on base d2220ec. Four owned files: src/cli.ts, src/test/cli-refs-docs.test.ts, src/guidelines/cli-instructions/task-execution.md, CLI-INSTRUCTIONS.md. Applied contributor CLI wiring, parameterized bounded task/draft tests, and corrected docs to the active shipped guide/reference. No Core/MCP/schema/config behavior changed. Reused the existing --doc accumulator helper; no new abstraction.
Validation: fresh bundled CLI; cli-refs-docs 62 pass; six-file draft/MCP/documentation/reference/instructions regression rerun 116 pass, 1 existing skip, 0 fail. First regression run had one MCP search tripwire failure (repository-root call count), which passed alone and in the exact rerun; logs retained. tsc, Biome (437 files), diff whitespace check passed. Live source CLI task/draft add/remove/replacement/clear passed, with eight byte-preserving invalid-command checks and shipped instruction verification.
Review artifacts: /tmp/back705-implementation-d2220ec contains preimages, owned-paths.json, final-sha256.json, back705.patch, evidence.txt, logs and live-cli.json. Original e718efe2 author BetExchange91 and Claude Opus 5 co-author are recorded for coordinator ancestry preservation. No task finalization or Git mutation performed.

Final review and acceptance evidence:
- Architecture review accepted the four frozen source/documentation files without corrections. AC 1-3 are covered by 62 passing CLI tests, existing MCP schema/update tests, and live task/draft commands. AC 2 interactive coverage uses the existing simulated process.stdin/process.stdout isTTY helper; no real PTY check is claimed. AC 4 checks complete stored bytes after each rejected edit, including eight live CLI rejections.
- All recorded test runs used Bun 1.4.2 (744846f84), not Bun 1.3.14. The 62-test CLI suite passed. The first related six-file run returned 115 pass, 1 skip, 1 fail: MCP task tools (MVP) > includes completed tasks in task_search results and excludes archived tasks; expect(getRepositoryRoot).toHaveBeenCalledTimes(0) received 1 at src/test/mcp-tasks.test.ts:64, called from line 787. No concrete transient cause was observed. The isolated test passed, and the exact six-file rerun passed with 116 pass, 1 skip, 0 fail. These passing reruns do not establish that the initial failure was unrelated or fixed; no source correction was made. Logs: /tmp/back705-implementation-d2220ec/regression.log, mcp-search-recheck.log, regression-recheck.log. CLI suite log: cli-refs-docs.log in that directory.
- Type checking passed; Biome passed across 437 files; whitespace validation and live source CLI add/remove/replacement/clear checks passed. The fresh bundle and full live command evidence are retained in /tmp/back705-implementation-d2220ec.
- Contributor ancestry is verified in coordinator preview 6c0c427b882f83565460070b765dce13e1068751: original e718efe2fe158cddec08b94da50cb61bd02c3ba5 and base d2220ec72176fbb9f59a66ff4bbf03876be8e969 are its parents. BetExchange91 authorship and the original Claude Opus 5 co-author remain preserved. The preview contains exactly the four frozen files plus this task; shared HEAD and staged entries were unchanged. Evidence: /tmp/back705-implementation-d2220ec/publication/preview.json. The coordinator will regenerate the candidate with this finalized task and create a ready PR superseding closed #1028 because maintainer edits are disabled. New-PR CI has not yet run.
- All acceptance criteria and Definition of Done items are satisfied by the saved evidence and accepted review. Marking the task Done; source remains frozen and publication stays with the coordinator.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added --add-doc and --remove-doc to task and draft edits through the existing shared update model. Repeated and comma-separated values preserve other documentation, avoid duplicates, and follow reference-flag validation. --doc remains replacement; --clear-docs remains clearing. Canonical help, command reference, and shipped execution instructions explain these operations.
Verified on Bun 1.4.2: 62 focused CLI tests passed; the related rerun passed 116 tests with one existing skip; type checking, Biome, and live source CLI checks passed. Invalid edits preserved complete file bytes. Interactive tests simulated isTTY. An initial MCP search call-count failure remains unexplained; isolated and exact reruns passed without a source change. Architecture review accepted the frozen implementation. Coordinator preview preserves original contributor e718efe2 ancestry and attribution; new-PR CI remains pending publication.
<!-- SECTION:FINAL_SUMMARY:END -->
