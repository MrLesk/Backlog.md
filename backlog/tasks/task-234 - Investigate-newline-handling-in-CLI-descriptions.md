---
id: task-234
title: Investigate newline handling in CLI descriptions
status: Done
assignee:
  - '@codex'
created_date: '2025-08-17 15:51'
updated_date: '2025-09-03 21:30'
labels:
  - cli
  - bug
  - ux
dependencies: []
priority: medium
---

## Description

Clarify and validate newline handling for CLI descriptions.

Expected: the CLI preserves literal newline characters when provided by the shell; it does not interpret backslash-n (\n) sequences. Provide clear, shell-specific examples for entering multi-paragraph text (Bash/Zsh ANSI-C quoting), POSIX printf, and PowerShell using backtick n. Ensure help/docs reflect this.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reproduce issue with --desc showing \n in output
- [x] #2 Define expected behavior: CLI preserves literal newlines; it does not interpret \n escape sequences
- [x] #3 Document supported multi-line input patterns with working examples: Bash/Zsh using $'...'; POSIX using printf; PowerShell using backtick n
- [x] #4 Update CLI help for --description/--desc (create/edit) to include concise multi-line examples
- [x] #5 Add tests: creating and editing a task with multi-paragraph descriptions preserves newlines in saved file
<!-- AC:END -->


## Implementation Plan

1. Reproduce newline issue with --desc showing literal \n in output
2. Define expected behavior: literal newlines preserved; do not interpret \n sequences
3. Update CLI help for create/edit/draft to include multi-line examples
4. Document multi-line input patterns in README (Bash/Zsh, POSIX, PowerShell)
5. Add tests to ensure multi-paragraph descriptions are preserved
6. Run Biome checks and full test suite


## Implementation Notes

Implemented newline handling clarifications:
- CLI help updated for --description/--desc across create/edit/draft commands with multi-line examples
- README adds "Multi-line descriptions" section (Bash/Zsh ...', POSIX printf, PowerShell `n)
- Tests added: src/test/description-newlines.test.ts, desc-alias, cli-plain-create-edit
- Verified literal newlines preserved and \n sequences not interpreted
- Ran bun run check and bun test to verify

Covers ACs #1–#5 for task-234
