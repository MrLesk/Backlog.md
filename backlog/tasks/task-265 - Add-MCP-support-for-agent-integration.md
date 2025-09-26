---
id: task-265
title: Add MCP support for agent integration
status: In Progress
assignee: []
created_date: '2025-09-13 18:52'
updated_date: '2025-09-26 15:35'
labels:
  - mcp
  - integration
  - agent
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Model Context Protocol (MCP) support to expose backlog.md functionality directly to AI agents through a standardized protocol. This enables agents to interact with tasks, manage projects, and access documentation through MCP tools, resources, and prompts using stdio and HTTP transports.

### Technical Context
MCP is a protocol that allows AI agents to access external data sources and tools through a standardized interface. This implementation will:

- **Extend Core Class**: Build MCP server on top of existing `Core` class (`src/core/backlog.ts`) to leverage existing task management, configuration, and file operations
- **SDK Integration**: Use `@modelcontextprotocol/sdk` TypeScript library for protocol implementation
- **Dual Transport**: Support stdio (local) and HTTP/SSE (network) transports for different agent connection scenarios
- **Configuration Integration**: Extend `BacklogConfig` interface (`src/types/index.ts:76-98`) with MCP-specific settings

### Architectural Constraints (CRITICAL)
MCP implementation MUST follow these non-negotiable principles:
- **Pure Wrapper**: MCP is protocol translation only - no business logic
- **No Feature Creep**: Cannot exceed CLI capabilities (no circular dependency detection, advanced analytics, etc.)
- **Core API Only**: Must use existing Core methods, not reimplement them
- **ID Generation**: Must use `core.generateNextId()` for all IDs (tasks, drafts, etc.)

### Known Issues & Refactoring Tasks
Based on architectural audit (2025-09-23):
- **task-265.34-37**: Remove unauthorized features (circular deps, analytics, filtering, caching)
- **task-265.38-39**: Fix ID generation to use Core APIs
- **task-265.40-41**: Refactor to use Core methods (createTaskFromData, promoteDraft)
- **task-265.42-43**: Extract and share validation logic
- **task-265.44-45**: Audit and document architecture compliance

### Architecture Overview
```
/src/mcp/
├── server.ts          # Main MCP server extending Core
├── tools/             # MCP tool implementations (task CRUD, board ops)
├── resources/         # MCP resource handlers (data access)
├── prompts/           # MCP prompt templates (workflows)
└── transports/        # stdio and HTTP transport handlers
```

The implementation will expose:
- **Tools**: Actions agents can perform (create/update/list tasks, view board, manage config)
- **Resources**: Read-only data access (task details, board state, configuration)
- **Prompts**: Structured templates for common workflows (task creation, planning)

### Integration Points
- CLI commands via `src/cli.ts` (add `backlog mcp start/stop/status`)
- Configuration system integration for MCP settings
- Existing task management workflow compatibility
- Security and validation leveraging existing patterns

## Implementation Progress

### Completed Work
- **Dual-Mode Installation Detection**: Created `src/utils/installation-detector.ts` with intelligent detection for development vs global installations
- **MCP Wrapper Script**: Implemented `scripts/mcp-server.cjs` following project CommonJS distribution standards
- **Claude Code Configuration**: Created `.mcp.json` with proper Claude Code integration using wrapper script pattern
- **Non-Interactive Testing**: Built comprehensive test helpers in `src/test/mcp-test-helpers.ts` to avoid CLI prompt issues
- **Documentation Framework**: Established comprehensive MCP documentation structure (needs accuracy updates)

### Approach Changes
- **Claude Code First**: Shifted from generic agent support to Claude Code-first implementation for faster validation
- **Script Standards**: Changed from TypeScript scripts to CommonJS wrapper pattern for npm distribution compatibility
- **Testing Strategy**: Moved from CLI-based testing to programmatic helpers due to interactive command limitations

### Current Status
- Basic MCP infrastructure is in place and testable
- Wrapper script intelligently handles both development and global installation modes
- Claude Code configuration ready for testing
- Documentation needs updates to reflect wrapper script approach
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
### Core MCP Implementation (Completed ✅)
- [x] #1 Dual-mode installation detection system implemented
- [x] #2 MCP wrapper script following project standards created
- [x] #3 Claude Code configuration files generated
- [x] #4 Non-interactive testing infrastructure built
- [x] #5 MCP server can be started via CLI command (`bun run cli mcp start`)
- [x] #6 AI agents can create and update tasks through MCP tools (8 tools implemented and working)
- [x] #7 Task data is accessible through MCP resources (3 data resources implemented)
- [x] #8 MCP prompts provide workflow templates for agents (prompt infrastructure complete)
- [x] #9 Both stdio and HTTP transports are supported (both implemented and working)
- [x] #10 Configuration integrates with existing backlog.md config system (completed in task-265.11)

### MCP Feature Expansion (In Progress 🔄)
- [x] #11 **task-265.22**: Critical infrastructure fixes completed (resource registration, test failures)
- [x] #12 **task-265.23**: Draft management tools implemented (draft_create, draft_list, draft_promote)
- [x] #13 **task-265.24**: Task lifecycle tools added (task_view, task_archive, task_demote)
- [x] #14 **task-265.25**: Document management tools implemented (doc_create, doc_list, doc_update, doc_delete)
- [x] #15 **task-265.26**: Decision record creation tool added (decision_create)
- [x] #16 **task-265.27**: Acceptance criteria management implemented (criteria_add, criteria_update, criteria_remove)
- [x] #17 **task-265.28**: Task dependency management added (dependency_manage)
- [x] #18 **task-265.29**: Project overview tool implemented (project_overview)
- [x] #19 **task-265.30**: Task notes management added (notes_add, notes_update, notes_list)
- [x] #20 **task-265.31**: Task cleanup tool implemented (task_cleanup)
- [x] #21 **task-265.32**: Batch task update tool added (batch_update)
- [x] #22 **task-265.33**: Additional MCP resources implemented (individual tasks, archived tasks, metrics)

### Final Integration Goals
- [x] #23 20+ MCP tools providing complete CLI coverage
- [x] #24 10+ MCP resources for comprehensive data access
- [ ] #25 All 103+ tests passing (100% success rate)
- [ ] #26 Full workflow support from task creation to completion
- [ ] #27 Agent-optimized operations for improved efficiency
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Current Status (2025-09-26)
**Phase: POLISH** - Core MCP implementation complete, shifting to polish and architectural compliance.

#### ✅ Major Accomplishments (28+ tasks completed):
- **Core Infrastructure**: Complete MCP server extending Core class with stdio and HTTP transports
- **CLI Integration**: Full `bun run cli mcp start` command with multiple transport options  
- **Tool Coverage**: 20+ MCP tools providing complete CLI coverage including:
  - Task management (create, list, update, view, archive, demote)
  - Draft management (create, list, promote)
  - Document and decision record management
  - Board operations and project overview
  - Configuration management
  - Task dependencies and acceptance criteria
- **Resource Access**: 10+ MCP resources for comprehensive read-only data access
- **Test Performance**: Optimized test suite from 100s to under 20s (80%+ improvement)
- **Architecture Cleanup**: Removed unauthorized features (circular deps, advanced analytics, caching)

#### 🎯 Production Ready:
The MCP server is fully functional and ready for AI agent integration with comprehensive coverage of backlog.md functionality.

#### 🔧 Polish Phase Focus:
Remaining tasks focus on final architectural compliance, security hardening, and lifecycle improvements:
- Architecture compliance (Core API usage, ID generation)
- Security and authentication (OAuth2, environment variables)
- Connection lifecycle and resilience
- Integration testing and documentation
<!-- SECTION:NOTES:END -->
