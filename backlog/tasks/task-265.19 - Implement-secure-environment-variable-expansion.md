---
id: task-265.19
title: Implement secure environment variable expansion
status: To Do
assignee: []
created_date: '2025-09-15 12:57'
labels:
  - mcp
  - security
  - configuration
dependencies: ['task-265.11']
parent_task_id: task-265
priority: high
---

## Description

Enhance environment variable handling in .mcp.json with support for default values, validation, and security checks following Claude Code MCP best practices.

### Technical Context

Claude Code MCP supports environment variable expansion in configuration files with ${VAR} and ${VAR:-default} syntax. This implementation adds security validation and enhanced functionality.

### Implementation Details

**Environment Variable Processor (`/src/mcp/config/env-processor.ts`):**
```typescript
export class EnvironmentVariableProcessor {
  private static readonly EXPANSION_PATTERN = /\$\{([^}]+)\}/g;
  private static readonly DEFAULT_VALUE_PATTERN = /^([^:]+):?-?(.*)$/;

  static expandVariables(configString: string): string {
    return configString.replace(this.EXPANSION_PATTERN, (match, expression) => {
      return this.processExpression(expression.trim());
    });
  }

  private static processExpression(expression: string): string {
    const defaultMatch = expression.match(this.DEFAULT_VALUE_PATTERN);

    if (defaultMatch) {
      const [, varName, defaultValue] = defaultMatch;
      const envValue = process.env[varName.trim()];

      if (envValue !== undefined) {
        this.validateEnvironmentValue(varName, envValue);
        return envValue;
      }

      return defaultValue || '';
    }

    const envValue = process.env[expression];
    if (envValue !== undefined) {
      this.validateEnvironmentValue(expression, envValue);
      return envValue;
    }

    throw new Error(`Environment variable '${expression}' is not set and no default value provided`);
  }

  private static validateEnvironmentValue(varName: string, value: string): void {
    // Security checks
    if (this.containsPathTraversal(value)) {
      throw new Error(`Environment variable '${varName}' contains path traversal patterns`);
    }

    if (this.containsSuspiciousPatterns(value)) {
      console.warn(`Warning: Environment variable '${varName}' contains potentially unsafe patterns`);
    }
  }

  private static containsPathTraversal(value: string): boolean {
    return value.includes('../') || value.includes('..\\') || value.includes('/../../');
  }

  private static containsSuspiciousPatterns(value: string): boolean {
    const suspiciousPatterns = [
      /;\s*rm\s+/,     // Command injection
      /\|\s*sh\s*/,    // Pipe to shell
      /`[^`]*`/,       // Command substitution
      /\$\([^)]*\)/,   // Command substitution
    ];

    return suspiciousPatterns.some(pattern => pattern.test(value));
  }
}
```

**Secure Configuration Loader:**
```typescript
export class SecureConfigLoader {
  static async loadMcpConfig(configPath: string): Promise<any> {
    const configContent = await Bun.file(configPath).text();

    // Expand environment variables
    const expandedContent = EnvironmentVariableProcessor.expandVariables(configContent);

    // Parse JSON
    let config: any;
    try {
      config = JSON.parse(expandedContent);
    } catch (error) {
      throw new Error(`Invalid JSON in MCP configuration: ${error instanceof Error ? error.message : error}`);
    }

    // Validate configuration
    this.validateConfiguration(config);

    return config;
  }

  private static validateConfiguration(config: any): void {
    // Validate required structure
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      throw new Error('MCP configuration must contain mcpServers object');
    }

    // Validate each server configuration
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      this.validateServerConfig(serverName, serverConfig as any);
    }
  }

  private static validateServerConfig(name: string, config: any): void {
    if (!config.command || typeof config.command !== 'string') {
      throw new Error(`Server '${name}' must have a command string`);
    }

    if (config.args && !Array.isArray(config.args)) {
      throw new Error(`Server '${name}' args must be an array`);
    }

    // Security validation for command paths
    if (this.isUnsafeCommand(config.command)) {
      throw new Error(`Server '${name}' command appears unsafe: ${config.command}`);
    }
  }

  private static isUnsafeCommand(command: string): boolean {
    // Check for suspicious commands
    const dangerousCommands = [
      'rm', 'rmdir', 'del', 'format', 'fdisk',
      'dd', 'mkfs', 'shutdown', 'reboot',
      'curl', 'wget', 'nc', 'netcat'
    ];

    const commandName = command.split(/[\s/\\]/).pop()?.toLowerCase() || '';
    return dangerousCommands.includes(commandName);
  }
}
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Support for default values (${VAR:-default})
- [ ] Validation of expanded values
- [ ] Security checks for path traversal
- [ ] Documentation of supported variables
- [ ] Integration with existing configuration system
<!-- AC:END -->