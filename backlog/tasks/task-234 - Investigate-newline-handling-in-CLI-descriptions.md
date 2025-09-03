---
id: task-234
title: Investigate newline handling in CLI descriptions
status: Done
assignee:
  - '@codex'
created_date: '2025-08-17 15:51'
updated_date: '2025-08-24 16:05'
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

## Implementation Notes

Documented newline handling for descriptions
