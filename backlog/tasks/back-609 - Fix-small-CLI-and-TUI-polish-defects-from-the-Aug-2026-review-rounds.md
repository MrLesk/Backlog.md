---
id: BACK-609
title: Fix small CLI and TUI polish defects from the Aug 2026 review rounds
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 17:20'
labels: []
dependencies: []
ordinal: 248000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Batch of small confirmed defects surfaced during the Aug 2026 reviews, approved by Alex on 2026-08-08: (1) doc create --plain errors instead of printing plain output; (2) doc list breaks on the older docs output path; (3) the TUI does not restore the previous terminal title on exit; (4) piped backlog board output prints a hardcoded "Project: Project" header instead of the real project name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 doc create --plain succeeds and prints plain output
- [x] #2 doc list works on projects using the older docs output path
- [x] #3 The TUI restores the previous terminal title on exit
- [x] #4 Piped board output shows the real project name in the header
- [x] #5 Tests cover the doc command and board header fixes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce all four defects against a scratch project driven by src/cli.ts.
2. doc create --plain: register the flag on the doc create subcommand and document it in the help schema, mirroring the existing 'decision create --plain' precedent (create output is already plain text).
3. doc list: replace the ad-hoc glob-and-string-match document lookup in the interactive branch with the shared Core document resolution that 'doc view' already uses, so both the legacy id-only filename layout and the current 'id - Title.md' layout (including subdirectories) resolve.
4. TUI terminal title: in createScreen, push the terminal window title onto the terminal title stack before blessed renames the window, and on the screen 'destroy' event clear the title and pop the stack. blessed already routes its exit, SIGINT/SIGTERM/SIGQUIT and uncaughtException teardown through screen.destroy(), so no new global signal handlers are added.
5. Piped board header: renderBoardTui's non-TTY branch passes a hardcoded "Project" to the board generators; pass the resolved options.projectName that the TUI path already uses for the window title.
6. Tests: CLI test for 'doc create --plain'; document resolution test for nested and legacy id-only doc filenames; unit test for the non-TTY board header project name; stdout capture test for the TUI title push/pop.
7. Verify with bunx tsc --noEmit, bun run check ., and the full bun run test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Item 1 - doc create --plain: the doc create subcommand never registered --plain, so commander rejected it with "error: unknown option '--plain'". Registered the flag and documented it in the help schema, following the existing 'decision create --plain' precedent: create output is already plain text, so the flag is accepted rather than switching formats.

Item 2 - doc list on the older docs output path: the interactive branch of doc list resolved the picked document by matching its id against filenames (`<id> - `, `/<id>.md`, `<id>.md`) instead of using the document's own path. Documents written before commit 87324692 (2025-07-12) are stored as `backlog/docs/<Title>.md" with no id in the filename, so they matched nothing and selecting one showed an empty viewer. The same matcher also missed the current nested form `<subdir>/<id> - <title>.md` that has been produced since ff4e88b6 (2025-09-06). Commit f1d0bc30 had already replaced this exact matcher in doc view with core resolution but left the copy in doc list; doc list now calls the same core.getDocumentContent reader, so there is one document reader again and both layouts resolve.

Item 3 - TUI terminal title: blessed writes ESC ] 0 ; <title> BEL when the screen title is set and never puts the old title back; its own restore code is commented out in lib/program.ts. createScreen now pushes the current window title onto the terminal's title stack (ESC [ 22 ; 2 t) before blessed renames the window, and on the screen 'destroy' event clears the title and pops the stack (ESC ] 0 ; BEL then ESC [ 23 ; 2 t). Clearing first means terminals without a title stack fall back to their own default instead of keeping a stale view name, while terminals that support the stack restore the exact previous title. No new global signal handlers were added: blessed already routes its exit, SIGINT/SIGTERM/SIGQUIT and uncaughtException teardown through screen.destroy(). The handler is guarded by a once flag because blessed emits 'destroy' twice per screen (Screen.destroy emits it, then Node.destroy emits it again via forDescendants), and one push must not be popped twice.

Item 4 - piped board header: renderBoardTui's non-TTY branch passed the literal string "Project" to the board generators, so piped output always read 'Project: Project'. It now passes options.projectName, the value the TTY branch already resolves for the window title, and keeps "Project" only as the fallback for an unnamed project. Both the status board and the --milestones board are fixed.

Verification. Item 1: reproduced 'error: unknown option --plain' before the change; after it, 'backlog doc create "Plain Doc" --plain' exits 0 and prints the created id and path. Item 2: against a project holding both a legacy title-only file (API-Guidelines.md) and a current nested file (guides/api/doc-2 - Nested-Doc.md), the old id-to-filename matcher resolved neither ('OPENED NOTHING' for both) while the new reader opens both. Item 3: verified under a real PTY (script -q). Before, teardown emitted no title sequence at all and the shell title stayed 'Acme Website - Board'. After, open emits ESC[22;2t then the rename, and teardown emits ESC]0;BEL then ESC[23;2t exactly once - confirmed on both clean exit and the SIGINT path. Item 4: piped 'backlog board' and 'backlog board --milestones' now print 'Project: Acme Website' instead of 'Project: Project'. Checks: bunx tsc --noEmit clean, bun run check . clean, bun run test green with 2078 pass / 6 skip / 0 fail across 223 files.

Out of scope, surfaced while researching item 2 and left unfixed: the document watcher in src/core/content-store.ts retries forever for a file named doc-1.md (it passes the doc- prefix gate but its split(" - ") id never matches the frontmatter id) and compares ids with raw equality where the rest of the codebase uses documentIdsEqual; and src/cli.ts carries an unused duplicate of generateNextDocId that also lives in src/utils/id-generators.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed four independent polish defects. doc create now accepts --plain instead of rejecting it as an unknown option. doc list's interactive branch resolves the picked document through the same core reader as doc view, so documents stored under the older title-only filenames and documents in subdirectories both open instead of showing nothing. The TUI saves the terminal window title before renaming the window and clears and restores it during the teardown blessed already performs, so the shell title survives a session. Piped board output prints the configured project name instead of the literal 'Project'. Verified by reproducing each defect first: CLI runs for the doc and board commands, an old-versus-new resolution run over a project holding both doc layouts, and PTY captures of the title escape sequences on clean exit and on SIGINT. Covered by tests for items 1, 2, 3 and 4; bunx tsc --noEmit and bun run check . are clean and bun run test is green at 2078 pass / 6 skip / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
