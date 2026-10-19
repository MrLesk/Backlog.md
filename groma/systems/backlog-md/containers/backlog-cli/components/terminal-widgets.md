---
type: C4 Component
title: Terminal widgets
status: stable
groma:
  id: terminal-widgets
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/ui/tui.ts
    - scanner: typescript
      file: src/ui/components/generic-list.ts
    - scanner: typescript
      file: src/ui/components/filter-popup.ts
    - scanner: typescript
      file: src/ui/components/filter-header.ts
    - scanner: typescript
      file: src/ui/components/confirm-popup.ts
      symbol: openConfirmPopup
    - scanner: typescript
      file: src/ui/components/help-popup.ts
    - scanner: typescript
      file: src/ui/heading.ts
    - scanner: typescript
      file: src/ui/footer-content.ts
    - scanner: typescript
      file: src/ui/loading.ts
    - scanner: typescript
      file: src/ui/utils/strip-tags.ts
      symbol: stripBlessedFgTags
    - scanner: typescript
      file: src/ui/status-icon.ts
    - scanner: typescript
      file: src/ui/checklist.ts
    - scanner: typescript
      file: src/ui/code-path.ts
    - scanner: typescript
      file: src/ui/acceptance-criteria-progress.ts
    - scanner: typescript
      file: src/ui/project.ts
      symbol: formatProjectBadge
    - scanner: typescript
      file: src/ui/task-type.ts
      symbol: formatTaskTypeBadge
    - scanner: typescript
      file: src/ui/task-lifecycle.ts
    - scanner: typescript
      file: src/utils/clipboard.ts
      symbol: copyToClipboard
  group: Terminal UI
  technology: neo-neo-bblessed
description: Shared screens, lists, popups and status formatting for the terminal UI
---

Building blocks the terminal views share: screen setup and input handling, scrollable lists, filter and confirmation popups, the help popup, loading screens, headings and footers, status icons, checklist and code-path styling, acceptance-criteria progress, clipboard copy and the complete-task action. Some of this formatting also appears in plain text output.
