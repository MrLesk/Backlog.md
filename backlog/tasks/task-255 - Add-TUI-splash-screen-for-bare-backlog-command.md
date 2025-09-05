---
id: task-255
title: Add TUI splash screen for bare backlog command
status: In Progress
assignee:
  - '@codex'
created_date: '2025-09-05 14:59'
updated_date: '2025-09-05 15:07'
labels:
  - cli
  - ui
  - dx
dependencies: []
priority: high
---

## Description

Create a welcoming splash screen shown when users run backlog with no subcommand. The splash should present a crisp TUI-compatible ASCII logo, the current version, a quick start tailored to whether the current directory is an initialized Backlog.md project, and a link to https://backlog.md (redirects to GitHub).

Design goals: delightful first-run experience, fast, readable on 80x24, color-aware, and graceful fallbacks for non-TTY/CI. Draw inspiration from modern CLI splash/landing screens (e.g., OpenCode, Claude Code, Gemini CLIs, and other DX-focused tools). Do not block interaction; just print and exit 0.

Notes: standard help should remain on -h/--help. Plain/AI mode must avoid ASCII art and color.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running `backlog` with no args prints a splash (not Commander help).
- [ ] #2 Splash shows a TUI-compatible ASCII Backlog.md logo that renders in common terminals (80x24) and degrades for narrow widths.
- [ ] #3 Splash displays the CLI version (same as `backlog -v`).
- [ ] #4 If project NOT initialized (no backlog/config), show an init tip: `backlog init` (plus a one-liner explaining initialization).
- [ ] #5 If project IS initialized, show 4–6 quickstart commands with one-line hints (e.g., task create, task list --plain, board, browser, overview).
- [ ] #6 Show a docs link: https://backlog.md (printed on its own line).
- [ ] #7 Use color and subtle styling when TTY and colors are enabled; respect NO_COLOR to disable styling.
- [ ] #8 Support plain mode: `backlog --plain` (with no subcommand) prints a minimal, no-ASCII, no-color version with the same information.
- [ ] #9 Auto-fallback to the plain/minimal variant when stdout is not a TTY (CI/pipes).
- [ ] #10 Exit with code 0; do not enter the TUI event loop; return immediately after printing.
- [ ] #11 Keep standard help accessible with `-h`/`--help` and version with `-v`/`--version`.
- [ ] #12 Add tests covering: initialized vs not initialized, plain vs styled, TTY vs non-TTY fallback, and that `--help` shows Commander help not the splash.
- [ ] #13 Update README with a brief screenshot/code block of the splash, and a one-paragraph explanation of the default behavior.
<!-- AC:END -->

## Implementation Plan

1. Research splash UX of modern CLIs (OpenCode, Claude Code, AMP CLI, etc.) and common patterns.
2. Add global bare-run handling in CLI (no subcommand): detect `--help`/`--version` bypass, handle `--plain`.
3. Implement splash renderer with ASCII logo, version, docs link, and dynamic quickstart/init tips.
4. Add color-aware output: detect TTY, honor NO_COLOR, fallback to plain when non-TTY or `--plain`.
5. Add tests: bare run initialized vs not, plain vs styled, TTY vs non-TTY fallback, `--help` shows Commander help.
6. Update README with splash example and explanation.
7. Verify formatting/lint, run tests, and open PR.
