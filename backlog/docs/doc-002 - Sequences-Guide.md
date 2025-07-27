---
id: doc-002
title: Sequences Guide
type: guide
created_date: '2025-07-27'
---

# Task Sequences

Task sequences represent groups of tasks that can be executed in parallel based on their dependencies. They are computed automatically from existing task files and exposed across the CLI, TUI and Web UI.

## Viewing Sequences

- **CLI**: `backlog sequence list` shows sequences. Use `--plain` for machine readable output or the interactive TUI for scrolling through sequences vertically.
 - **Web UI**: Navigate to the new *Planning* page to see tasks grouped by sequence. Drag and drop tasks between sequences to update dependencies.

## API

Two endpoints are available:

- `GET /api/sequences` – returns the list of sequences with tasks.
- `POST /api/sequences/move` – move a task to a different sequence; dependencies are updated automatically.

## Notes

Sequences are derived purely from dependencies, so moving a task between sequences updates its `dependencies` list accordingly.
