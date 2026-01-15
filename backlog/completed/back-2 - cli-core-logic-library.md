---
id: BACK-2
title: "CLI: Design & Implement Core Logic Library"
status: Done
assignee: @MrLesk
reporter: @MrLesk
created_date: 2025-06-03
labels: ["cli", "core-logic", "architecture"]
milestone: m-1
dependencies: ["task-1"]
---

## Description

Develop the central TypeScript library that handles:

- File system operations within the `.backlog` directory.
- Markdown parsing (reading frontmatter and content).
- Markdown serialization (writing task files).
- Basic Git interaction wrappers (e.g., add, commit specific files).
- Defining data structures for tasks, docs, decisions.

## Acceptance Criteria

- [x] Clear interface for file operations.
- [x] Robust Markdown parsing/serialization for Backlog task files.
- [x] Wrapper functions for essential Git commands (e.g., commit changes to a task file).
- [x] Core data models (Task, DecisionLog, Document) defined.
