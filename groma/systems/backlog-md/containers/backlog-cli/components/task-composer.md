---
type: C4 Component
title: Task composer
status: stable
groma:
  id: task-composer
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/ui/components/task-composer.ts
  group: Terminal UI
  technology: neo-neo-bblessed
description: Creates tasks from inside the terminal board
---

A keyboard-driven form for capturing a new task (title, description, due date, status, type, priority and project) without leaving the board. Choices come from the project config, and the payload is validated before the core writes anything.
