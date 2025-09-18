---
id: task-265.01
title: Install MCP SDK and setup basic server infrastructure
status: Done
assignee: []
created_date: '2025-09-13 18:52'
updated_date: '2025-09-13 21:00'
labels:
  - mcp
  - setup
  - server
  - sdk
dependencies: []
parent_task_id: task-265
---

## Description

Install MCP SDK dependency and create minimal server infrastructure that extends the existing Core class. This provides the foundation for all MCP functionality while maintaining compatibility with existing backlog.md patterns.

### Implementation Details

**Package Installation:**
```bash
bun add @modelcontextprotocol/sdk
```

**Directory Structure:**
```
/src/mcp/
├── server.ts              # Main MCP server class
├── types.ts               # MCP-specific types
├── tools/                 # MCP tool implementations (empty, for future tasks)
├── resources/             # MCP resource handlers (empty, for future tasks)
├── prompts/               # MCP prompt templates (empty, for future tasks)
└── transports/            # Transport handlers (empty, for future tasks)

/src/test/
└── mcp-server.test.ts     # Comprehensive test suite (14 tests)
```

**Comprehensive MCP Server (`/src/mcp/server.ts`):**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	CallToolRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Core } from "../core/backlog.ts";
import type {
	CallToolResult,
	GetPromptResult,
	ListPromptsResult,
	ListResourcesResult,
	ListToolsResult,
	McpPromptHandler,
	McpResourceHandler,
	McpToolHandler,
	ReadResourceResult,
	TransportType,
} from "./types.ts";

export class McpServer extends Core {
	private server: Server;
	private tools: Map<string, McpToolHandler>;
	private resources: Map<string, McpResourceHandler>;
	private prompts: Map<string, McpPromptHandler>;

	constructor(projectRoot: string) {
		super(projectRoot);

		this.tools = new Map();
		this.resources = new Map();
		this.prompts = new Map();

		this.server = new Server(
			{
				name: "backlog.md-mcp-server",
				version: "1.0.0",
			},
			{
				capabilities: {
					tools: {
						listChanged: true,
					},
					resources: {
						subscribe: false,
						listChanged: true,
					},
					prompts: {
						listChanged: true,
					},
				},
			},
		);

		this.setupHandlers();
	}

	private setupHandlers(): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => this.listTools());
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => this.callTool(request));
		this.server.setRequestHandler(ListResourcesRequestSchema, async () => this.listResources());
		this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => this.readResource(request));
		this.server.setRequestHandler(ListPromptsRequestSchema, async () => this.listPrompts());
		this.server.setRequestHandler(GetPromptRequestSchema, async (request) => this.getPrompt(request));
	}

	// Handler methods for tools, resources, and prompts
	protected async listTools(): Promise<ListToolsResult> { /* ... */ }
	protected async callTool(request: any): Promise<CallToolResult> { /* ... */ }
	protected async listResources(): Promise<ListResourcesResult> { /* ... */ }
	protected async readResource(request: any): Promise<ReadResourceResult> { /* ... */ }
	protected async listPrompts(): Promise<ListPromptsResult> { /* ... */ }
	protected async getPrompt(request: any): Promise<GetPromptResult> { /* ... */ }

	// Public API for adding handlers
	public addTool(tool: McpToolHandler): void { /* ... */ }
	public addResource(resource: McpResourceHandler): void { /* ... */ }
	public addPrompt(prompt: McpPromptHandler): void { /* ... */ }

	// Transport stubs for future implementation
	public async connect(transportType: TransportType, options?: Record<string, unknown>): Promise<void> {
		throw new Error(`Transport ${transportType} is not yet implemented`);
	}

	// Test interface for accessing protected methods
	public get testInterface() {
		return {
			listTools: () => this.listTools(),
			callTool: (request: any) => this.callTool(request),
			// ... other test methods
		};
	}
}
```

> **Note**: The implementation above is condensed for brevity. The actual code includes full method implementations, comprehensive error handling, and proper type safety.

**Comprehensive MCP Types (`/src/mcp/types.ts`):**
```typescript
import type {
	CallToolResult,
	GetPromptResult,
	ListPromptsResult,
	ListResourcesResult,
	ListToolsResult,
	Prompt,
	ReadResourceResult,
	Resource,
	Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Handler interfaces for extensible MCP functionality
export interface McpToolHandler {
	name: string;
	description: string;
	inputSchema: object;
	handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

export interface McpResourceHandler {
	uri: string;
	name?: string;
	description?: string;
	mimeType?: string;
	handler: () => Promise<ReadResourceResult>;
}

export interface McpPromptHandler {
	name: string;
	description?: string;
	arguments?: Array<{
		name: string;
		description?: string;
		required?: boolean;
	}>;
	handler: (args: Record<string, unknown>) => Promise<GetPromptResult>;
}

export type TransportType = "stdio" | "sse";

// Re-export SDK types for convenience
export type {
	CallToolResult,
	ListResourcesResult,
	ListToolsResult,
	ReadResourceResult,
	Tool,
	Resource,
	Prompt,
	ListPromptsResult,
	GetPromptResult,
};
```

**Integration Points:**
- Extend `Core` class to inherit existing task management functionality
- Follow existing TypeScript patterns from codebase
- Use Bun runtime compatibility
- Follow existing async/await patterns

**Implementation Steps:**
1. **Red**: Install MCP SDK dependency
2. **Green**: Create minimal server class that extends Core
3. **Green**: Add basic type definitions
4. **Refactor**: Ensure proper integration with existing Core patterns

**Implementation Exceeded Initial Scope:**

The actual implementation went significantly beyond the minimal server initially planned:

- **Comprehensive Architecture**: Full handler setup with Maps for tools/resources/prompts
- **Complete Test Suite**: 14 passing tests covering initialization, tool/resource/prompt management
- **Production-Ready Structure**: Request schema handlers, error handling, test interfaces
- **Extensible Design**: Public APIs for adding tools, resources, and prompts

This provides a much stronger foundation for subsequent MCP tasks.

**Ready for Next Steps:**
- Transport implementation can leverage existing comprehensive server structure
- Tools/resources/prompts can be added via the established handler APIs
- Test infrastructure is already in place for TDD development

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP SDK dependency added to package.json
- [x] #2 McpServer class created extending Core
- [x] #3 Basic MCP types defined in /src/mcp/types.ts
- [x] #4 Server can be instantiated without errors
- [x] #5 Server capabilities method implemented
- [x] #6 Transport method stub throws appropriate error
- [x] #7 All code follows existing codebase patterns and conventions
<!-- AC:END -->

## Implementation Notes

**Implementation Completed Successfully**

**Summary:**
Successfully implemented MCP SDK foundation for backlog.md with all acceptance criteria met. The implementation provides a robust foundation for MCP functionality while maintaining full compatibility with existing codebase patterns.

**Key Accomplishments:**
• ✅ MCP SDK dependency installed (@modelcontextprotocol/sdk@^1.18.0)
• ✅ McpServer class created extending Core class with proper inheritance
• ✅ Comprehensive MCP types defined in /src/mcp/types.ts with all necessary interfaces
• ✅ Server instantiation working flawlessly without errors
• ✅ Server capabilities method implemented returning proper MCP capabilities structure
• ✅ Transport method stubs implemented with appropriate "not yet implemented" errors
• ✅ All code following existing codebase patterns and TypeScript conventions
• ✅ Comprehensive test suite created with 14 passing tests covering all functionality

**Technical Implementation:**
- **Files Created:** /src/mcp/server.ts, /src/mcp/types.ts, /src/test/mcp-server.test.ts
- **Dependencies Added:** @modelcontextprotocol/sdk@^1.18.0 in package.json
- **Architecture:** Clean inheritance from Core class maintaining existing patterns
- **Testing:** Full test coverage with comprehensive validation of all methods
- **Error Handling:** Proper error messages for unimplemented transport methods

**Quality Assurance:**
- All 14 tests passing (server instantiation, capabilities, error handling, inheritance)
- TypeScript compilation successful with no errors
- Biome formatting and linting passed
- Integration with existing Core class verified
- Proper async/await patterns maintained

**Ready for Next Steps:**
This implementation provides the solid foundation required for task 265.02 (transport implementation) and subsequent MCP feature development. The server infrastructure is ready and all integration points are properly established.
