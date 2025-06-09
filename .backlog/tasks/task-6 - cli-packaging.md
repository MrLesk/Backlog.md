---
id: task-6
title: "CLI: Argument Parsing, Help, and Packaging"
status: Done
assignee: []
reporter: @MrLesk
created_date: 2025-06-04
labels: ["cli", "command"]
milestone: "M1 - CLI"
dependencies: ["task-3"]
---

## Description

Implement robust CLI argument parsing (e.g., using `commander.js` or `yargs`).
Provide helpful `--help` messages for all commands.
Use `bun build --compile` to create a standalone executable.
Define `bin` script in `package.json` for npm distribution.

## Acceptance Criteria

- [x] All commands have clear help messages.
- [x] CLI arguments are parsed correctly.
- [x] `bun build --compile` produces a working executable.
- [x] `package.json` configured for CLI publishing.

## Implementation Notes

- Updated `package.json` build script to also compile a standalone executable using `bun build --compile`.
- Added `src/test/build.test.ts` to verify the compiled binary runs and displays help text.
- Existing `bin` entry points to the CLI script for npm distribution.
