---
type: C4 Component
title: Terminal board
status: stable
groma:
  id: terminal-board
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/ui/board.ts
    - scanner: typescript
      file: src/ui/unified-view.ts
    - scanner: typescript
      file: src/ui/view-switcher.ts
    - scanner: typescript
      file: src/board.ts
    - scanner: typescript
      file: src/readme.ts
      symbol: updateReadmeWithBoard
  group: Terminal UI
  technology: neo-neo-bblessed
description: Kanban board in the terminal, plus its Markdown export
---

Renders `backlog board`: status columns, optional milestone grouping, filters, multi-select moves and a task popup that stays in sync with file changes. Tab switches to the task browser without reloading, and the board creates tasks through the task composer. The same column grouping produces `backlog board export`, a Markdown board written to a file or into the README.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/board.ts](../../../../../../src/ui/board.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Moves and edits tasks | In-process call |
| [src/ui/board.ts](../../../../../../src/ui/board.ts) | [src/ui/components/task-composer.ts](../../../../../../src/ui/components/task-composer.ts) | Opens the composer | In-process call |
| [src/ui/board.ts](../../../../../../src/ui/board.ts) | [src/ui/tui.ts](../../../../../../src/ui/tui.ts) | Creates the screen | In-process call |
| [src/ui/unified-view.ts](../../../../../../src/ui/unified-view.ts) | [src/utils/task-watcher.ts](../../../../../../src/utils/task-watcher.ts) | Watches task files | In-process call |
