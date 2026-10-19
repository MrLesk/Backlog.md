---
id: BACK-725
title: Keep a cleared default editor when init runs again
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-11 11:05'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1066'
modified_files:
  - src/cli.ts
  - src/commands/advanced-config-wizard.ts
  - src/test/config-commands.test.ts
type: bug
ordinal: 343000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog config set defaultEditor ""` is accepted and means no editor. That choice does not survive re-running `backlog init` in the same project: init writes the current shell's `$EDITOR` or `$VISUAL` back into the project config and exits 0 without mentioning the editor (issue #1066, reproduced on 1.53.0 and on main). The project config is usually committed, so a re-init by any contributor silently puts that contributor's editor into the shared config and undoes an explicit choice.

The issue observes that the cleared value is stored as an absent key, which makes it indistinguishable from never having chosen an editor, and that a hand-written empty `default_editor` value is overwritten the same way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After `backlog config set defaultEditor ""`, re-running `backlog init` in the same project with `$EDITOR` or `$VISUAL` set does not write an editor into the project config.
- [x] #2 After that re-init, `backlog config get defaultEditor` reports no editor command.
- [x] #3 Re-running `backlog init` in a project that has a configured editor keeps that editor.
- [x] #4 A first `backlog init` in a new project still takes its default editor from `$EDITOR` or `$VISUAL` as it does today.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Research findings
- Every surface already agrees that a project has no editor when defaultEditor is not set (absent default_editor key, or a hand-written empty value): the config loader and serializer (empty is written as an absent key), config set "", config get ("defaultEditor is not set"), config list, the web settings field and runtime resolution. Other optional keys are cleared the same way (zeroPaddedIds, defaultAssignee, defaultStatus) and re-init leaves them cleared.
- Init is the one place that disagrees. For a project that already has a config it reads "not set" as "ask the environment": src/cli.ts applyAdvancedOptionOverrides (init --defaults / flags) falls back to EDITOR/VISUAL, and the advanced wizard (src/commands/advanced-config-wizard.ts, shared by interactive init and backlog config) pre-fills its editor prompt from EDITOR/VISUAL/platform default, so pressing Enter writes it back.

Approach (smallest change, no config format change)
1. Make init agree with the rest: the environment only suggests an editor for a project that has no config yet. Once a config exists, its defaultEditor, set or not, is the project's choice and is kept unless --default-editor is passed.
2. src/cli.ts applyAdvancedOptionOverrides: explicit --default-editor wins; otherwise an existing project keeps the loaded value; only a first init falls back to EDITOR then VISUAL.
3. src/commands/advanced-config-wizard.ts: with an existing config the editor prompt starts from the configured value (blank when none); without one it keeps today's EDITOR -> VISUAL -> platform default suggestion.
4. No change to the loader, serializer, config set/get/list, web settings or core/init.ts. What is written for a cleared editor (no default_editor line) and what config get prints stay as they are; absent key and hand-written empty value both keep meaning no editor.
5. Tests through the public CLI in src/test/config-commands.test.ts: init with EDITOR, clear, re-init with a different EDITOR and with VISUAL only, hand-written empty value, configured editor kept, first init still seeded from VISUAL; inspect the config file and config get. One wizard test with the existing prompt stub for the pre-filled editor value.
6. Verify with scoped tests, bunx tsc --noEmit, bun run check ., the issue's reproduction before/after, and an interactive re-init through a PTY.

Behavior choice to flag for review
- A project whose editor was never chosen (absent key) is also no longer seeded from EDITOR/VISUAL on re-init, because that state is the same absent key as a cleared editor. Alternative considered: persist a cleared editor as default_editor: "" so re-init can still seed never-chosen projects. Rejected as larger: it changes the committed file format and the shipped BACK-574 behavior (config set "" removes the key), introduces a state no surface except the raw file can show, and needs matching changes in the serializer, core init, wizard, web settings and config migration.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-725-keep-cleared-editor.

What changed
- src/cli.ts (init --defaults / flags): an explicit --default-editor still wins; otherwise a project that already has a config keeps its defaultEditor as loaded, set or not. Only a project without a config takes EDITOR, then VISUAL.
- src/commands/advanced-config-wizard.ts (interactive init and backlog config): with an existing config the editor prompt starts from the configured value, blank when there is none. Without a config it still offers EDITOR, VISUAL, then the platform default.
- Nothing else changed: loader, serializer, config set/get/list, web settings and core/init.ts already treat an unset defaultEditor as no editor. Init was the only place that read it as 'ask the environment'.

Config contract (unchanged)
- Cleared editor in the config file: no default_editor line, before and after.
- backlog config get defaultEditor for a cleared editor: prints 'defaultEditor is not set' and exits 1, before and after.
- Absent key and hand-written default_editor: "" both still load as no editor. A hand-written empty line is still dropped by the next save, as before; re-init no longer replaces it with EDITOR.

Verification
- Issue #1066 reproduction through the CLI: before, re-init wrote default_editor: "other-editor --wait"; after, no default_editor line and config get prints 'defaultEditor is not set'. Same with only VISUAL set and with a hand-written empty value. A configured editor is kept; a first init still takes EDITOR or VISUAL.
- Interactive re-init through a PTY (EDITOR=cat, Enter on every wizard prompt): before, the prompt was pre-filled with cat and default_editor: "cat" was written; after, the prompt is blank and nothing is written.
- New tests in src/test/config-commands.test.ts: four CLI tests (cleared editor with EDITOR and with VISUAL, hand-written empty value, configured editor kept after a first init from VISUAL) and two wizard tests with a prompt runner that accepts every starting value. The four bug tests fail on the unfixed source and pass with the fix.
- bun test --timeout=10000 src/test/config-commands.test.ts: 31 pass, 1 fail. The failure ('reads the config key at column 0...') is unrelated and also fails on unmodified source: local Bun 1.4.3 rejects tab-indented YAML, CI pins Bun 1.3.14.
- Also green: enhanced-init, cli-init-create, cli-init-input, cli-init-no-git, editor test files; bunx tsc --noEmit; bun run check .

Behavior choice left for review
- A project whose editor was never chosen (absent key) is no longer seeded from EDITOR/VISUAL by re-init either, because that is the same absent key as a cleared editor. Interactive first init without the advanced wizard already leaves the key absent, so this is a normal state. Persisting a cleared editor as default_editor: "" would keep seeding for never-chosen projects but changes the committed file format and the BACK-574 behavior; not done.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Re-running backlog init no longer writes EDITOR or VISUAL into a project whose default editor was cleared (issue #1066).

What changed
- Rule: an existing project keeps its own editor setting on re-init, including none; only a first-time init reads the environment. An explicit --default-editor still wins.
- src/cli.ts: init --defaults and flag-driven init keep the loaded defaultEditor of an existing project and fall back to EDITOR, then VISUAL, only when there is no config yet.
- src/commands/advanced-config-wizard.ts: with an existing config the editor prompt starts from the configured value, blank when there is none. This covers interactive init and bare backlog config, which share the wizard. Without a config it still offers EDITOR, VISUAL, then the platform default.
- Config file format and config get defaultEditor output are unchanged: a cleared editor is still an absent default_editor key and still prints 'defaultEditor is not set'. An absent key and a hand-written empty value both keep meaning no editor.

Why this shape
- Every other surface (loader, serializer, config set/get/list, web settings, runtime resolution) already treats an unset defaultEditor as no editor. Init was the only place that read it as 'ask the environment', so the fix removes that disagreement instead of adding a stored empty state.

Verification
- AC1/AC2: CLI tests clear the editor, re-run init with a different EDITOR and with only VISUAL, then assert the config file has no default_editor line and config get prints 'defaultEditor is not set'. A hand-written empty value is covered the same way. These tests fail on the unfixed source.
- AC3/AC4: a CLI test takes the editor from VISUAL on a first init and keeps it across a re-init with a different EDITOR; the cleared-editor tests start from a first init that takes EDITOR.
- Wizard: two tests with a prompt runner that accepts every starting value, plus a manual PTY re-init (EDITOR=cat, Enter on every prompt) that leaves the editor prompt blank and writes nothing.
- Editor and wizard tests in src/test/config-commands.test.ts: 13 pass, 0 fail. Neighbouring files pass: enhanced-init (26), cli-init-create (40), cli-init-input (7), cli-init-no-git (4), editor (14). bunx tsc --noEmit and bun run check . pass.
- One unrelated test in config-commands.test.ts ('reads the config key at column 0...') fails under the locally installed Bun 1.4.3 with or without this change, because that Bun rejects tab-indented YAML. CI pins Bun 1.3.14.

Behavior change to confirm
- A project that never chose an editor has the same absent key as one that cleared it, so init --defaults on such a project no longer writes the caller's EDITOR. Storing a cleared editor as default_editor: "" would keep that seeding, but it changes the committed config format and reverses the shipped behavior where config set defaultEditor "" removes the key, so it was not done.
<!-- SECTION:FINAL_SUMMARY:END -->
