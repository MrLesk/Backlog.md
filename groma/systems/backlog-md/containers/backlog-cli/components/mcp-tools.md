---
type: C4 Component
title: MCP tools
status: stable
groma:
  id: mcp-tools
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/mcp/tools/tasks/handlers.ts
    - scanner: typescript
      file: src/mcp/tools/tasks/index.ts
      symbol: registerTaskTools
    - scanner: typescript
      file: src/mcp/tools/tasks/schemas.ts
    - scanner: typescript
      file: src/mcp/utils/task-response.ts
      symbol: formatTaskCallResult
    - scanner: typescript
      file: src/mcp/utils/schema-generators.ts
    - scanner: typescript
      file: src/mcp/tools/documents/handlers.ts
    - scanner: typescript
      file: src/mcp/tools/documents/index.ts
      symbol: registerDocumentTools
    - scanner: typescript
      file: src/mcp/tools/documents/schemas.ts
    - scanner: typescript
      file: src/mcp/utils/document-response.ts
      symbol: formatDocumentCallResult
    - scanner: typescript
      file: src/mcp/tools/definition-of-done/handlers.ts
    - scanner: typescript
      file: src/mcp/tools/definition-of-done/index.ts
      symbol: registerDefinitionOfDoneTools
    - scanner: typescript
      file: src/mcp/tools/definition-of-done/schemas.ts
    - scanner: typescript
      file: src/mcp/tools/milestones/index.ts
      symbol: registerMilestoneTools
    - scanner: typescript
      file: src/mcp/tools/milestones/schemas.ts
    - scanner: typescript
      file: src/mcp/tools/workflow/index.ts
      symbol: registerWorkflowTools
  group: MCP
description: Task, document, milestone and Definition of Done tools for agents
---

Implements task_create, task_list, task_search, task_view, task_edit, task_complete and task_archive, the document and milestone tools, Definition of Done defaults, and get_backlog_instructions. Input schemas are generated from the project's statuses, priorities and types; handlers validate arguments, call the core, and answer with text shaped like the CLI's plain output.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/mcp/tools/tasks/handlers.ts](../../../../../../src/mcp/tools/tasks/handlers.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Runs task operations | In-process call |
| [src/mcp/tools/milestones/index.ts](../../../../../../src/mcp/tools/milestones/index.ts) | [src/mcp/tools/milestones/handlers.ts](../../../../../../src/mcp/tools/milestones/handlers.ts) | Manages milestones | In-process call |
| [src/mcp/tools/tasks/handlers.ts](../../../../../../src/mcp/tools/tasks/handlers.ts) | [src/utils/task-search.ts](../../../../../../src/utils/task-search.ts) | Filters tasks | In-process call |
| [src/mcp/tools/tasks/handlers.ts](../../../../../../src/mcp/tools/tasks/handlers.ts) | [src/core/task-detail.ts](../../../../../../src/core/task-detail.ts) | Builds task details | In-process call |
| [src/mcp/utils/task-response.ts](../../../../../../src/mcp/utils/task-response.ts) | [src/formatters/task-plain-text.ts](../../../../../../src/formatters/task-plain-text.ts) | Formats plain task text | In-process call |
