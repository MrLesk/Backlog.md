---
id: task-265.11
title: Add MCP configuration types and integrate with config system
status: To Do
assignee: []
created_date: '2025-09-13 18:53'
labels:
  - mcp
  - types
  - configuration
dependencies: ['task-265.01']
parent_task_id: task-265
---

## Description

Extend the existing configuration system to support MCP-specific settings and add proper TypeScript types for all MCP functionality.

### Implementation Details

**Minimal MCP Configuration Extension (`/src/types/index.ts`):**
```typescript
// Add to existing BacklogConfig interface (keeping it minimal)
export interface BacklogConfig {
  // ... existing properties (lines 76-98)

  // MCP Configuration (optional, with sensible defaults)
  mcp?: {
    enabled?: boolean; // Default: false (opt-in)
    stdio?: {
      enabled?: boolean; // Default: true if MCP enabled
    };
    http?: {
      enabled?: boolean; // Default: false
      port?: number; // Default: 3000
      host?: string; // Default: 'localhost'
    };
  };
}

// Separate detailed types in MCP module
// These don't need to be in the main types file
export type McpTransportType = 'stdio' | 'http';
```

**Detailed MCP Types in MCP Module (`/src/mcp/types.ts`):**
```typescript
// Move detailed configuration types to MCP module to avoid polluting main types
export interface McpConfig {
  enabled: boolean;
  stdio: {
    enabled: boolean;
  };
  http: {
    enabled: boolean;
    port: number;
    host: string;
    cors?: {
      enabled: boolean;
      origins: string[];
    };
  };
  server: {
    name: string;
    version: string;
  };
}

export interface McpToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface McpResourceRequest {
  uri: string;
}

export interface McpResourceResponse {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}
```

**Configuration Integration (`/src/mcp/config.ts`):**
```typescript
import type { BacklogConfig } from '../types/index.ts';
import type { McpConfig } from './types.ts';

export const DEFAULT_MCP_CONFIG: McpConfig = {
  enabled: false, // Opt-in by default
  stdio: {
    enabled: true
  },
  http: {
    enabled: false,
    port: 3000,
    host: 'localhost',
    cors: {
      enabled: true,
      origins: ['*']
    }
  },
  server: {
    name: 'backlog-md-mcp',
    version: '1.0.0'
  }
};

export function getMcpConfig(config: BacklogConfig): McpConfig {
  if (!config.mcp) {
    return DEFAULT_MCP_CONFIG;
  }

  return {
    enabled: config.mcp.enabled ?? DEFAULT_MCP_CONFIG.enabled,
    stdio: {
      enabled: config.mcp.stdio?.enabled ?? DEFAULT_MCP_CONFIG.stdio.enabled
    },
    http: {
      enabled: config.mcp.http?.enabled ?? DEFAULT_MCP_CONFIG.http.enabled,
      port: config.mcp.http?.port ?? DEFAULT_MCP_CONFIG.http.port,
      host: config.mcp.http?.host ?? DEFAULT_MCP_CONFIG.http.host,
      cors: {
        enabled: DEFAULT_MCP_CONFIG.http.cors.enabled,
        origins: DEFAULT_MCP_CONFIG.http.cors.origins
      }
    },
    server: DEFAULT_MCP_CONFIG.server
  };
}
```

**Server Integration with Configuration:**
```typescript
// Update McpServer to use configuration
import { getMcpConfig } from './config.ts';

export class McpServer extends Core {
  private mcpConfig: McpConfig;

  constructor(projectRoot: string) {
    super(projectRoot);
    // Configuration is loaded lazily when needed
  }

  async initialize(): Promise<void> {
    const backlogConfig = await this.getConfig();
    this.mcpConfig = getMcpConfig(backlogConfig);

    // Only proceed if MCP is enabled
    if (!this.mcpConfig.enabled) {
      throw new Error('MCP is not enabled in configuration');
    }

    // Initialize server with config values
    this.server = new Server({
      name: this.mcpConfig.server.name,
      version: this.mcpConfig.server.version
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });
  }
}
```

**Key Design Principles:**
- **Minimal Impact**: Only small addition to main BacklogConfig interface
- **Opt-in**: MCP disabled by default, must be explicitly enabled
- **Encapsulation**: Detailed types kept in MCP module, not main types
- **Compatibility**: No breaking changes to existing configuration system
- **Sensible Defaults**: Configuration works out of the box when enabled

**Implementation Steps:**
1. **Minimal extension**: Add optional MCP section to BacklogConfig
2. **Separate concerns**: Keep detailed types in MCP module
3. **Configuration helper**: Create getMcpConfig function with defaults
4. **Server integration**: Update McpServer to use configuration
5. **Validation**: Ensure configuration values are valid

**Benefits:**
- **Non-intrusive**: Doesn't impact existing configuration loading
- **Backward compatible**: Existing configs continue to work
- **Type safe**: Full TypeScript support for MCP config
- **Opt-in**: MCP must be explicitly enabled
- **Flexible**: Easy to extend with additional options

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Minimal MCP configuration extension added to BacklogConfig
- [ ] Detailed MCP types defined in /src/mcp/types.ts
- [ ] getMcpConfig helper function with sensible defaults
- [ ] McpServer updated to use configuration system
- [ ] Configuration integration doesn't break existing patterns
- [ ] MCP is opt-in (disabled by default)
- [ ] All types remain consistent and type-safe
<!-- AC:END -->
