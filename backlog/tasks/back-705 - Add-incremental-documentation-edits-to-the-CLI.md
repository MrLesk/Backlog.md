---
id: BACK-705
title: Add incremental documentation edits to the CLI
status: Done
assignee:
  - '@codex'
created_date: '2026-09-27 23:13'
updated_date: '2026-10-16 07:43'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1027'
  - 'https://github.com/MrLesk/Backlog.md/pull/1028'
  - src/cli.ts
  - src/test/cli-refs-docs.test.ts
  - src/guidelines/cli-instructions/task-execution.md
  - CLI-INSTRUCTIONS.md
modified_files:
  - src/cli.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/test/cli-refs-docs.test.ts
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
- [x] #1 bun run check . passes when formatting/linting touched
- [x] #2 bun test (or scoped test) passes
- [x] #3 bun run check:types passes when TypeScript touched
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Integrate PR #1044 with origin/main at 3ebe37c, keeping original PR and contributor ancestry. Preserve configureEditCommand and the shared rejection wrapper from BACK-723.
2. Keep --add-doc/--remove-doc within the existing task/draft edit flow and shared update operations. Preserve reference conventions, --doc replacement/empty clearing, --clear-docs, identity checks, and partial multi-ID behavior.
3. Review only the four existing owned files: src/cli.ts, src/test/cli-refs-docs.test.ts, src/guidelines/cli-instructions/task-execution.md, and CLI-INSTRUCTIONS.md. Trace the actual shipped instruction consumer and simplify any integration code.
4. Run current focused CLI documentation/reference tests and related task/draft/MCP/instruction and edit-rejection checks, then bun run check:types, bun run check ., and bun run build. Verify fresh compiled task/draft examples, help, shipped instructions, byte-preserving rejections, and real TTY flag routing if practical. Keep all current evidence separate from older saved runs.
5. Freeze the integrated source and give the coordinator exact main-relative diff, hashes, ancestry, evidence, and limits for full-context architecture review. Do not finalize or commit before that review.
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

Repair started 2026-10-16 for existing PR #1044 on detached exact head a1f7c577. Read current project rules, Backlog execution guide, Groma Backlog guide, context-hunter, issue #1027 and PR scope. Current acceptance scope remains valid. Older validation counts in this record are historical evidence only; this repair will record fresh proof on current main. No source files changed yet.

Integrated origin/main 3ebe37c with git merge --no-commit. Git resolved the source/documentation integration without conflicts; detached HEAD remains original PR head a1f7c577 and MERGE_HEAD is current main. Recorded the four owned files immediately after integration. No source repair has yet been needed; next step is full affected-flow review and fresh validation.

Affected-flow review confirmed the auto-merge kept configureEditCommand and runEditCommand/performEdit from current main. The CLI still feeds existing buildTaskUpdateInput and Core documentation operations; no model or MCP change is needed. Strengthened the owned CLI rejection cases: each carries a valid notes change and now requires exactly one truthful No changes were applied sentence while preserving the full stored bytes. Shipped CLI instructions are sourced through cli-instructions/index.ts -> mcp/workflow-guides.ts -> commands/instructions.ts; generated agent files contain the CLI nudge, so legacy agent-guidelines.md remains outside this change.

Fresh focused source CLI suite passed: 62 tests, 0 failures (Bun 1.4.3). bun run check:types passed for 565 files. The first Biome check found one formatting issue in the owned parameterized rejection test under current Biome; formatted only src/test/cli-refs-docs.test.ts and will rerun Biome. No behavioral test failure occurred.

Fresh repair proof on 2026-10-16 (Bun 1.4.3): focused CLI refs/docs suite passed 62 tests; twelve distinct related files passed 203 tests with 1 existing skip and 0 failures. Existing skipped case: interactive draft picker collision guard > renders unrelated healthy drafts beside an unparsable twin. The existing test is opt-in: it runs only when expect is available and RUN_INTERACTIVE_TUI_TESTS=1. This run did not enable that opt-in; no reliability change is claimed. bun run check:types passed 565 files; bun run check . passed 460 files after formatting the owned rejection block; bun run build passed. Canonical type-check proof is bun run check:types; the historical bunx tsc DoD text has not been rerun or claimed for this repair. Native compiled CLI completed 84 commands covering task/draft repeated/comma/deduplicated add/remove, add-then-remove, replacement/empty clear/clear flag, help and shipped instructions; all 32 rejected edits retained full file bytes and exactly one no-changes sentence. Four real PTY commands (task/draft add and remove, stdin/stdout/stderr attached to a real pseudo-terminal) finished without any input and updated the expected files. Four native partial batch commands retained successful edits and omitted the no-changes sentence. First PTY harness attempt observed the task update but checked process exit immediately after PTY closure; fixed the local probe to wait for process teardown and reran in a new temporary fixture. No product source fix was needed. Evidence in /tmp/back705-repair-20261016-3ebe37c, including both probe attempt logs. Scope remains the original four implementation files plus this task. Subtraction review found the existing shared accumulator, validation and model operations already keep the implementation minimal; no extra abstraction or source changes were needed.

Final repair acceptance (2026-10-16): coordinator full-context architecture review returned KEEP with no source correction or product decision. The reviewed source hashes remain frozen. AC 1 is proven by current task/draft add/remove persistence and deduplication tests plus native compiled examples. AC 2 is proven by repeated/comma/blank/conflict tests, 32 byte-preserving native rejections, four real PTY commands without input, and four native partial batch commands. AC 3 is proven by replacement/clear tests, unchanged existing MCP documentation tests, native help and shipped task-execution instructions. AC 4 is proven by full-file byte assertions and original PR/contributor ancestry; original e718efe2 retains BetExchange91 authorship and Claude Opus 5 co-author.
Current proof has 265 distinct passes across 13 files (62 focused plus 203 related), one existing opt-in draft-picker skip, and zero failures. This is scoped validation, not a full-suite reliability claim. bun run check:types passed 565 files; bun run check . passed 460 files; bun run build and git diff --check passed. Replaced the historical tsc DoD item with the current canonical type-check command through the CLI. Original old-run notes are retained as history. All current acceptance criteria and DoD items are proven; preparing the single final merge commit with direct parents original PR a1f7c577 and main 3ebe37c.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added --add-doc and --remove-doc to task and draft edits through the existing shared documentation operations. Repeated and comma-separated values preserve unrelated entries and avoid duplicates. --doc still replaces the full list; --clear-docs still clears it. Help and shipped CLI instructions describe each operation. The integration keeps current edit rejection messages and partial batch behavior.

Verified on current main 3ebe37c with Bun 1.4.3: 265 distinct passing tests across 13 files, one existing opt-in skip, and no failures. Canonical type checking, Biome and build passed. Fresh compiled CLI checks covered 32 full-byte-preserving rejected edits, four real terminal commands, four partial batch commands, and task/draft replacement, clear, repeated/comma, deduplication, help and instructions. Full-context architecture review accepted the frozen four implementation files. Original BetExchange91 commit e718efe2 and Claude Opus 5 co-author remain in the preserved PR ancestry. Evidence: /tmp/back705-repair-20261016-3ebe37c. Historical MCP failure evidence remains in notes; no test-reliability fix is claimed.
<!-- SECTION:FINAL_SUMMARY:END -->
