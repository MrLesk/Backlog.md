---
id: task-265.18
title: Add project vs user scope configuration
status: To Do
assignee: []
created_date: '2025-09-15 12:55'
labels:
  - mcp
  - configuration
  - cli
dependencies: ['task-265.07']
parent_task_id: task-265
priority: medium
---

## Description

Support different installation scopes for MCP configuration following Claude Code best practices for project-scoped vs user-scoped MCP servers.

### Technical Context

Claude Code supports different scopes for MCP configuration:
- **Local Scope**: Private to current project (default)
- **Project Scope**: Shared via .mcp.json in version control
- **User Scope**: Available across all projects

### Implementation Details

**Configuration Scope Types (`/src/mcp/config/scope-types.ts`):**
```typescript
export enum ConfigScope {
  LOCAL = 'local',
  PROJECT = 'project',
  USER = 'user'
}

export interface ScopeConfig {
  scope: ConfigScope;
  requiresApproval: boolean;
  configPath: string;
  description: string;
}
```

**Scope Management (`/src/mcp/config/scope-manager.ts`):**
```typescript
export class ScopeManager {
  async setupScope(scope: ConfigScope, force: boolean = false): Promise<void> {
    const scopeConfig = this.getScopeConfig(scope);

    if (existsSync(scopeConfig.configPath) && !force) {
      throw new Error(`Configuration already exists in ${scope} scope. Use --force to overwrite.`);
    }

    await this.createScopeConfiguration(scopeConfig);

    if (scopeConfig.requiresApproval) {
      await this.promptForApproval(scopeConfig);
    }
  }

  private getScopeConfig(scope: ConfigScope): ScopeConfig {
    switch (scope) {
      case ConfigScope.LOCAL:
        return {
          scope,
          requiresApproval: false,
          configPath: resolve(process.cwd(), '.mcp.local.json'),
          description: 'Local configuration (private to this project)'
        };

      case ConfigScope.PROJECT:
        return {
          scope,
          requiresApproval: true,
          configPath: resolve(process.cwd(), '.mcp.json'),
          description: 'Project configuration (shared via version control)'
        };

      case ConfigScope.USER:
        return {
          scope,
          requiresApproval: false,
          configPath: resolve(os.homedir(), '.config', 'backlog-md', 'mcp.json'),
          description: 'User configuration (available across all projects)'
        };
    }
  }
}
```

**CLI Integration:**
```typescript
mcpCmd
  .command('setup')
  .description('Set up MCP configuration for this project')
  .option('--scope <scope>', 'Configuration scope (local|project|user)', 'local')
  .option('--force', 'Overwrite existing configuration', false)
  .option('--global', 'Use global installation template', false)
  .action(async (options) => {
    const scope = options.scope as ConfigScope;
    const scopeManager = new ScopeManager();

    await scopeManager.setupScope(scope, options.force);
  });
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Support for local, project, and user configuration scopes
- [ ] User approval flow for project-scoped configurations
- [ ] CLI --scope flag for mcp setup command
- [ ] Configuration precedence rules implementation
- [ ] Scope reset and management functionality
<!-- AC:END -->