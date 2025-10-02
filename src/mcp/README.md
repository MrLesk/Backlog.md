# MCP (Model Context Protocol) Implementation

This directory contains the MCP implementation for backlog.md, enabling AI agents to interact with task management functionality through standardized protocols.

## Current Status

### ✅ Completed Tasks

#### Task 265.01 - MCP Server Foundation
- **Comprehensive MCP Server**: Full `McpServer` class extending `Core` with handler infrastructure
- **MCP SDK Integration**: Using `@modelcontextprotocol/sdk@^1.18.0`
- **Handler System**: Maps for tools, resources, and prompts with registration APIs
- **Type Definitions**: Complete interfaces for `McpToolHandler`, `McpResourceHandler`, `McpPromptHandler`
- **Test Suite**: 14 comprehensive tests covering all server functionality

#### Task 265.25 - Document Management Tools
- **Document Tools**: `doc_create`, `doc_list`, `doc_view` for managing project documentation
- **Full CRUD Support**: Create, read, and list operations for markdown documents
- **Type Classification**: Support for readme, guide, specification, and other document types

#### Task 265.27 - Acceptance Criteria Management Tools
- **AC Tools**: `criteria_add`, `criteria_remove`, `criteria_check`, `criteria_list` for managing task acceptance criteria
- **Batch Operations**: Support for multiple criteria operations in single calls
- **Status Tracking**: Check/uncheck individual criteria with visual status indicators
- **Order Preservation**: Maintains proper numbering and formatting of acceptance criteria

### 🔄 Next Steps
- **Task 265.02**: Implement stdio transport for local connections ✅ **Completed**
- **Task 265.03**: Add core task management tools (create, list, update) ✅ **Completed**
- **Task 265.03.1**: Re-enable task tools after upstream merge ✅ **Completed 2025-10-01**
- **Task 265.03.2**: Re-enable draft tools after upstream merge ✅ **Completed 2025-10-01**
- **Task 265.03.3**: Re-enable decision tools after upstream merge ✅ **Completed 2025-10-01**
- **Task 265.04**: Implement resources for data access
- **Task 265.05**: Add board management tools ✅ **Completed**
- **Task 265.06**: Create workflow prompts ✅ **Completed**

## Architecture

### Server Infrastructure (`server.ts`)
The `McpServer` class provides a comprehensive foundation:

```typescript
export class McpServer extends Core {
    private server: Server;
    private tools: Map<string, McpToolHandler>;
    private resources: Map<string, McpResourceHandler>;
    private prompts: Map<string, McpPromptHandler>;

    // Handler registration
    public addTool(tool: McpToolHandler): void
    public addResource(resource: McpResourceHandler): void
    public addPrompt(prompt: McpPromptHandler): void

    // Transport methods (stubs for future implementation)
    public async connect(transportType: TransportType): Promise<void>
    public async start(): Promise<void>
    public async stop(): Promise<void>
}
```

### Type System (`types.ts`)
Comprehensive interfaces for extensible MCP functionality:

- **McpToolHandler**: Tools that agents can execute
- **McpResourceHandler**: Read-only data access
- **McpPromptHandler**: Structured workflow templates
- **TransportType**: Support for "stdio" and "sse" transports

### Directory Structure
```
/src/mcp/
├── server.ts              # Main MCP server class (✅ Complete)
├── types.ts               # MCP-specific types (✅ Complete)
├── tools/                 # Tool implementations (✅ Partially Complete)
│   ├── task-tools.ts      # Task management tools (✅ Complete - 10 tools)
│   ├── task-handlers.ts   # Task operation handlers (✅ Complete)
│   ├── document-tools.ts  # Document management tools (✅ Complete - 3 tools)
│   ├── document-handlers.ts # Document operation handlers (✅ Complete)
│   ├── notes-tools.ts     # Notes management tools (✅ Complete - 8 tools)
│   └── notes-handlers.ts  # Notes operation handlers (✅ Complete)
├── resources/             # Resource handlers (📁 Ready for task 265.04)
├── prompts/               # Prompt templates (📁 Ready for task 265.06)
├── transports/            # Transport handlers (📁 Ready for task 265.02)
└── README.md              # This file

/src/test/
└── mcp-server.test.ts     # Comprehensive test suite (✅ Tests passing)
```

## Key Design Decisions

### 1. Extended Core Class
The `McpServer` extends the existing `Core` class to inherit all task management functionality, ensuring compatibility with existing backlog.md operations.

### 2. Handler Maps Architecture
Uses `Map<string, Handler>` for efficient registration and lookup of tools, resources, and prompts. This design supports dynamic registration and easy testing.

### 3. Request Schema Integration
Integrates with MCP SDK request schemas (`CallToolRequestSchema`, `ListToolsRequestSchema`, etc.) for proper protocol compliance.

### 4. Test Interface
Provides `testInterface` property for accessing protected methods during testing, enabling comprehensive unit test coverage.

### 5. Comprehensive Foundation
The implementation went beyond initial minimal specifications to provide a production-ready foundation that subsequent tasks can build upon.

## Available Tools

### Task Management Tools (10 tools)
- **`task_create`**: Create new tasks with title, description, labels, and acceptance criteria
- **`task_list`**: List tasks with filtering by status, assignee, labels, and search
- **`task_update`**: Update existing task properties
- **`task_view`**: Get complete task details with metadata and relationships
- **`task_archive`**: Archive completed tasks
- **`task_demote`**: Convert tasks back to draft status

### Acceptance Criteria Tools (4 tools)
- **`criteria_add`**: Add new acceptance criteria to tasks (supports batch operations)
- **`criteria_remove`**: Remove acceptance criteria by index (supports batch operations)
- **`criteria_check`**: Check/uncheck acceptance criteria items (supports batch operations)
- **`criteria_list`**: List all acceptance criteria with completion status

### Document Management Tools (3 tools)
- **`doc_create`**: Create new documentation with type classification
- **`doc_list`**: List documents with filtering by type and tags
- **`doc_view`**: Get complete document content and metadata

### Notes Management Tools (8 tools)
- **`notes_set`**: Replace entire implementation notes content (50KB limit)
- **`notes_append`**: Append to implementation notes with configurable separator
- **`notes_get`**: Retrieve current implementation notes content
- **`notes_clear`**: Clear all implementation notes
- **`plan_set`**: Replace entire implementation plan content (50KB limit)
- **`plan_append`**: Append to implementation plan with configurable separator
- **`plan_get`**: Retrieve current implementation plan content
- **`plan_clear`**: Clear all implementation plan

## Usage Example

```typescript
import { McpServer } from './mcp/server.ts';
import { registerTaskTools } from './mcp/tools/task-tools.ts';
import { registerDocumentTools } from './mcp/tools/document-tools.ts';
import { registerNotesTools } from './mcp/tools/notes-tools.ts';

// Create server instance
const server = new McpServer(process.cwd());

// Register tool suites
registerTaskTools(server);     // Adds 10 task management tools
registerDocumentTools(server); // Adds 3 document management tools
registerNotesTools(server);    // Adds 8 notes management tools

// Connect transport (when implemented in task 265.02)
// await server.connect('stdio');
// await server.start();
```

## Testing

The comprehensive test suite covers:
- Server instantiation and Core inheritance
- Handler registration and Maps functionality
- Tool, resource, and prompt management
- Error handling and edge cases
- Transport method stubs

Run tests:
```bash
bun test src/test/mcp-server.test.ts
```

## Integration Points

### With Core Class
- Inherits `filesystem`, `gitOps`, `fs`, `git` functionality
- Access to existing task management operations
- Configuration system integration

### With CLI System
Future CLI integration will add:
```bash
backlog mcp start        # Start MCP server with stdio
backlog mcp start --debug # With debug logging
```

### With AI Agents
Once transport is implemented, agents can:
- Call tools for task operations
- Access resources for data reading
- Use prompts for workflow guidance

## Implementation Notes

### Task 265.01 Exceeded Scope
The initial task planned a minimal server, but the implementation provides:
- Complete handler infrastructure
- Full MCP SDK integration
- Comprehensive error handling
- Production-ready architecture
- Extensive test coverage

This deviation provides a much stronger foundation for subsequent MCP tasks.

### Future Development
The infrastructure is designed for incremental development:
1. **Transport Layer**: Add stdio/SSE transport functionality
2. **Tool Implementation**: Connect handlers to actual Core operations
3. **Resource Access**: Provide read-only data through MCP protocol
4. **Prompt Templates**: Create workflow guidance for agents
5. **Configuration**: Integrate with backlog.md config system

## Contributing

When adding new MCP functionality:
1. Follow the established handler interface patterns
2. Add corresponding tests to the existing test suite
3. Update this README with new capabilities
4. Ensure integration with existing Core functionality