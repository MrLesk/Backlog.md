---
id: task-6
title: "CLI: Argument Parsing, Help, and Packaging"
status: "To Do"
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

- [ ] All commands have clear help messages.
- [ ] CLI arguments are parsed correctly.
- [ ] `bun build --compile` produces a working executable.
- [ ] `package.json` configured for CLI publishing.
