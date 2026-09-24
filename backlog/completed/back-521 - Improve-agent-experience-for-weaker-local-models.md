---
id: BACK-521
title: Improve agent experience for weaker local models
status: Done
assignee:
  - '@codex'
created_date: '2026-07-06 13:40'
updated_date: '2026-07-10 19:33'
labels: []
dependencies: []
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use real local/self-hosted model runs to improve Backlog.md's public agent workflow surfaces. The work validates weaker LM Studio models against disposable Backlog projects, records concrete workflow failures, and applies only the smallest CLI/MCP/instruction changes needed to make the shipped workflow easier to follow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At least two distinct local LM Studio model families are baseline-tested against a disposable Backlog tic-tac-toe workflow, or model availability blockers are recorded with exact commands and output.
- [x] #2 Each observed workflow failure is recorded with model ID, demo directory, command shape, and evidence from Backlog state or Pi JSONL output.
- [x] #3 Public-surface fixes are limited to observed failure modes in CLI commands/help, generated instruction files, MCP workflow resources/tools, README, or CLI instructions.
- [x] #4 Guide or nudge changes include focused tests covering the rendered public instructions; CLI behavior/help changes include focused command tests.
- [x] #5 After fixes, at least two distinct local model families are rerun successfully or the remaining external model blocker is documented in implementation notes.
- [x] #6 Finalization guidance requires objective verification evidence before checking acceptance criteria, writing final summary, or moving a task to the terminal status, and tests cover the rendered instruction text.
- [x] #7 Task creation rejects non-task parent IDs such as milestone IDs before writing task files, with a clear error that points agents to --milestone for milestone assignment, and focused tests cover the command behavior.
- [x] #8 Generated CLI agent instructions tell agents exactly which detailed workflow guide to read before task creation, execution, and finalization phases, and tests cover the rendered AGENTS.md text.
- [x] #9 Task-creation workflow guides explicitly hand off to task-execution before same-session implementation, and CLI/MCP rendered-guide tests cover the handoff text.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Discover available LM Studio models with `pi --provider lmstudio --list-models` and treat exact listed model IDs as source of truth.
2. Run baseline disposable Backlog tic-tac-toe demos outside the repo for up to four LM Studio models, without changing repo source first.
3. Audit each demo for overview usage, milestone/task creation, direct backlog file edits, one complete task lifecycle, implementation notes, checked ACs, final summary, terminal status, playable game files, and verification evidence.
4. Record model IDs, command shapes, demo directories, blockers, and failures in this task using Backlog CLI notes.
5. Implement the smallest public-surface fixes justified by observed failures in CLI/MCP workflow guides, generated instruction nudges, README/CLI instructions, or command help/errors.
6. Add focused tests for any public instruction/help changes, run project validation, then rerun at least two distinct local model families or document any remaining external model blocker.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline Gemma run evidence (model google/gemma-4-12b-qat, demo /tmp/backlog-ax-gemma.E9iQEQ, command via Pi LM Studio with --thinking xhigh): created milestone m-0 and tasks TASK-1/TASK-2 through the CLI, used backlog instructions overview/task-creation/task-execution, avoided direct writes under backlog/, and completed both tasks. Failure: it did not run backlog instructions task-finalization before checking ACs/final summary/Done, did not run an objective verification command, and falsely checked TASK-2 AC #1. Static audit shows script.js never toggles currentPlayer after a valid non-terminal move, so alternating X/O turns do not work despite final summary claiming they do.

Baseline Qwen run evidence (model qwen/qwen3.6-27b, demo /tmp/backlog-ax-qwen.mWTmCd, command via Pi LM Studio with --thinking xhigh): created milestone m-0 and three tasks through the CLI, used backlog instructions overview/task-creation/task-execution/task-finalization, avoided direct writes under backlog/, completed TASK-2 lifecycle, and produced a playable single-file index.html. jsdom behavior audit passed a basic two-move and X-win scenario. Remaining failure class: Qwen checked ACs and marked Done after grep/code-shape checks rather than behavior-level verification, leaving TASK-3 verification task To Do and using final summary language that says grep checks confirmed feature code presence.

Implemented the evidence-backed finalization fix in CLI and MCP task-execution/task-finalization guides. The execution guides now tell agents not to check ACs/final summary/terminal status from execution alone; finalization guides now require objective behavior evidence and explicitly reject code-presence, grep-output, or intent-only AC checks. Focused validation passed: bun test src/test/cli.test.ts -t 'backlog instructions command'; bun test src/test/mcp-server.test.ts -t 'workflow guides require objective evidence'.

Fixed-guide Qwen rerun evidence (model qwen/qwen3.6-27b, demo /tmp/backlog-ax-qwen-fixed.zwxicK, Pi LM Studio with --thinking xhigh): used overview/task-creation/task-execution/task-finalization, created milestone m-0 and tasks TASK-1/TASK-3 via CLI, avoided direct writes under backlog/, completed TASK-1, and produced index.html. Node/jsdom behavior audit passed rendered 9 cells, X/O alternation, reset, and X-win detection. Remaining weakness: the model still checked ACs and marked Done after grep/static structural checks, including a failed grep -P attempt, so its own verification evidence was weaker than the new finalization guidance asks for.

Fixed-guide Gemma rerun evidence (model google/gemma-4-12b-qat, demo /tmp/backlog-ax-gemma-fixed.7bhBri, Pi LM Studio with --thinking xhigh): used overview/task-creation/task-execution/task-finalization and created milestone m-0, but passed milestone ID m-0 to backlog task create --parent. The CLI accepted this and created task files with IDs M-0.1, M-0.1.1, and M-0.2.1 under backlog/tasks; backlog task list then reported 'No tasks found' and milestone list showed m-0 (0/0 done). Gemma continued against those IDs, checked ACs, wrote final summary, and marked M-0.1 Done, but the resulting tasks are not recognized by the public CLI. This exposes a narrow CLI validation gap: --parent should not accept a milestone/non-task ID that creates task IDs outside the configured task prefix.

Post-parent-fix Qwen rerun evidence (model qwen/qwen3.6-27b, demo /tmp/backlog-ax-qwen-parentfix.k2olMA, Pi LM Studio with --thinking xhigh): used overview/task-creation/task-execution/task-finalization, created milestone m-0, created normal TASK-1/TASK-3 with -m m-0, avoided direct edits under backlog/, completed TASK-2 lifecycle, and produced index.html. External Node/jsdom audit passed rendered 9 cells, X/O alternation, reset, and X-win detection. Remaining observed weakness: the model still checked ACs and marked Done after grep/code inspection, with final summary saying code inspection confirmed all ACs, despite finalization guidance requiring objective behavior evidence.

Final Qwen rerun after UI-verification nudge (model qwen/qwen3.6-27b, demo /tmp/backlog-ax-qwen-final.GYXbRH, Pi LM Studio with --thinking xhigh) used the updated guides, created milestone m-0 and normal TASK-1/TASK-3 with -m m-0, avoided direct backlog edits, created index.html, and noted that a Node.js headless DOM test should verify the game. The run stalled for several minutes after implementation notes before running that verification or finalizing TASK-2; I interrupted Pi with Ctrl-C (exit 130). External Node/jsdom audit of index.html passed rendered 9 cells, X/O alternation, reset, and X-win detection, but the model did not complete the task lifecycle in this final run.

Final Gemma rerun evidence (model google/gemma-4-12b-qat, demo /tmp/backlog-ax-gemma-final.9sM3Bs, Pi LM Studio with --thinking xhigh): used overview and task-creation, created milestone m-0, created normal TASK-1 parent plus TASK-1.1/TASK-1.2 subtasks with -p TASK-1 and --milestone m-0, avoided direct backlog edits, completed TASK-1.1 lifecycle, and produced index.html/style.css/script.js. The previous invalid --parent m-0 failure is resolved. External Node/jsdom audit passed rendered 9 cells, X/O alternation, reset, and X-win detection. Remaining weakness: Gemma skipped backlog instructions task-execution/task-finalization during lifecycle work and checked ACs/finalized without running its own objective verification command.

Validation after implementation: git diff --check passed. Targeted Biome check for touched public-surface files passed. Focused tests passed with 114 tests across src/test/parent-id-normalization.test.ts, src/test/cli-parent-shorthand.test.ts, src/test/cli.test.ts, and src/test/mcp-server.test.ts. Full bun test ran 1417 tests with 1414 pass, 2 skip, and 1 fail: src/test/build.test.ts packaging test builds the executable but the compiled OUTFILE --help exits 137 locally. bun test src/test/build.test.ts reproduces the same exit 137. bunx tsc --noEmit is blocked by ignored tmp/test-editor.ts unused-variable errors for tty and inputBuffer. bun run check . is blocked by pre-existing CRLF formatting diagnostics in files such as src/core/config-migration.ts, src/core/milestones.ts, src/core/prefix-migration.ts, src/web/utils/milestones.test.ts, and src/web/utils/milestones.ts. Local dependency refresh via bun i aligned Tailwind/Biome versions with package.json; regenerated src/web/styles/style.css reflects existing web source classes and is unrelated to the agent workflow fix.

Trace-backed generated-instruction fix: inspecting /tmp/backlog-ax-gemma-final.9sM3Bs/pi-run.jsonl showed Gemma read backlog instructions overview and task-creation, then moved directly into task view/edit, implementation, AC checks, final summary, and Done without reading task-execution or task-finalization. The generated demo AGENTS.md still said to use detailed guides 'when needed', which left that phase decision to the model. Updated src/guidelines/cli-agent-nudge.md so generated CLI instructions require the matching detailed guide before creation, execution, and finalization lifecycle actions. Added a focused AGENTS.md regression assertion in src/test/agent-instructions.test.ts. Validation passed: bun test src/test/agent-instructions.test.ts; bun test src/test/cli.test.ts src/test/mcp-server.test.ts src/test/parent-id-normalization.test.ts src/test/cli-parent-shorthand.test.ts; git diff --check; bunx biome check src/guidelines/cli-agent-nudge.md src/test/agent-instructions.test.ts.

Post-nudge Gemma rerun evidence (model google/gemma-4-12b-qat, demo /tmp/backlog-ax-google-gemma-4-12b-qat-nudge.B0CMyB, Pi LM Studio with --thinking xhigh using a temp backlog shim for this checkout): generated AGENTS.md contained the updated phase-specific nudge, but the Pi runner/model did not read AGENTS.md. Gemma used overview and task-creation, created milestone m-0 and TASK-1 through TASK-4 via CLI, avoided direct writes under backlog/, then moved directly from task-creation into task view/edit/In Progress/plan and implementation without reading task-execution. It attempted objective verification with verify.js, but got stuck rewriting invalid draw tests and never finalized; I interrupted after several minutes (exit 130). Backlog state after interruption: TASK-4 In Progress, TASK-1 through TASK-3 To Do, milestone m-0 0/4 done. Static audit of script.js shows no currentPlayer toggle after a valid non-terminal move, so alternating X/O turns still fail. Evidence-backed fix: updated CLI and MCP task-creation guides to explicitly stop and read task-execution before viewing, assigning, planning, editing, or implementing a task in the same session. Focused validation passed: bun test src/test/cli.test.ts -t 'backlog instructions command'; bun test src/test/mcp-server.test.ts -t 'task creation guide resource returns correct content'; bun test src/test/agent-instructions.test.ts.

Post-handoff rerun evidence: Gemma 12B (model google/gemma-4-12b-qat, demo /tmp/backlog-ax-google-gemma-4-12b-qat-handoff.2sw8ke, Pi LM Studio with --thinking xhigh using current-checkout backlog shim) read overview, task-creation, task-execution, and task-finalization. It created milestone m-0 and three tasks assigned to @gemma, avoided direct backlog edits, completed TASK-2 lifecycle with all ACs checked and status Done, and produced index.html/style.css/script.js plus verify_game.js. Its own verification was still weaker than ideal: it eventually passed a standalone win/draw/no-win logic script and claimed manual UI verification. Independent jsdom audit by Codex passed turn alternation, win, draw, and reset behavior for the generated app. Post-handoff Qwen rerun evidence (model qwen/qwen3.6-27b, demo /tmp/backlog-ax-qwen-qwen3.6-27b-handoff.SqrHxq, Pi LM Studio with --thinking xhigh using current-checkout backlog shim) read overview, task-creation, task-execution, and task-finalization; created milestone m-0 and three tasks assigned to @qwen; avoided direct backlog edits; implemented index.html; and wrote a jsdom verifier. The verifier first failed under bun/jsdom, then under node with 19 pass / 2 fail due incorrect click sequences. Qwen correctly did not check ACs or mark Done after failed verification, but stalled while repairing verifier scenarios; I interrupted it (exit 130), leaving TASK-2 In Progress. Independent jsdom audit by Codex passed turn alternation, row/column/diagonal wins, draw, reset, and post-reset play for the generated app. Net result: the task-creation handoff fix caused both Gemma and Qwen to read task-execution after task creation; both later read task-finalization. Remaining weakness is model-side verification design/repair, especially producing clean UI behavior checks without long reasoning loops.

Extra-model run evidence: qwen/qwen3.6-35b-a3b was run via Pi LM Studio with --thinking xhigh in disposable demo /tmp/backlog-ax-qwen-qwen3.6-35b-a3b-extra.FQ1ZgC using the current-checkout backlog shim. It read overview, task-creation, task-execution, and task-finalization; created exactly one milestone m-0; created five tasks assigned to @qwen35; avoided direct writes under backlog/; implemented index.html/styles.css/script.js; and left TASK-1 In Progress instead of checking ACs or marking Done while its own jsdom verifier failed. The model then entered a repetitive reasoning loop while trying to repair the verifier, so Pi was interrupted with Ctrl-C. Independent Codex jsdom audit passed rendered 9 cells, X/O alternation, row win, draw, and reset behavior. This reinforces the remaining model-side weakness: larger Qwen follows the workflow guidance, but can still stall on verifier design/repair and correctly leaves terminal Backlog status unfinished when verification fails. Current additional-model blocker: after the sandbox/session transition, previous temp dirs were no longer visible under /private/tmp, Pi reported 'No models available' for 'pi --provider lmstudio --list-models', and direct local API checks 'curl -sS http://localhost:1234/api/v1/models' and 'curl -sS http://localhost:1234/v1/models' both failed with curl (7), 'Could not connect to server'. The planned google/gemma-4-31b-qat extra run could not be restarted until the LM Studio server exposes models again.

Exact-main finalization verification on e9dc9c5bf5124f217352e1bc9b271d07323f036c (2026-07-10): bunx tsc --noEmit passed; bun run check . passed across 324 files; bun test passed 1643 tests with 2 expected interactive skips and 0 failures. The unavailable extra model and deeper verifier-design research remain optional follow-up, not required for this task completion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the evidence-backed public workflow hardening for weaker local models: phase-specific CLI/MCP guide handoffs, objective-evidence finalization guidance, generated instruction nudges, and rejection of non-task parent IDs, with focused coverage. Gemma and Qwen reruns documented the observed improvements and remaining verifier limitations. Exact shipped main e9dc9c5bf5124f217352e1bc9b271d07323f036c passes TypeScript, Biome across 324 files, and the full suite with 1643 passing, 2 expected interactive skips, and 0 failures. Additional model-family and verifier-design research remains optional follow-up and is not claimed here.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
