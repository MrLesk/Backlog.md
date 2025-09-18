---
id: task-265.14
title: Add MCP output token limits and warnings
status: To Do
assignee: []
created_date: '2025-09-15 12:35'
labels:
  - mcp
  - performance
  - limits
dependencies: ['task-265.11']
parent_task_id: task-265
priority: high
---

## Description

Implement configurable output token limits to prevent overwhelming Claude Code and other MCP clients, following Claude Code MCP best practices for output management and user warnings.

### Technical Context

Claude Code MCP best practices recommend implementing output token limits to ensure responsive performance and prevent clients from being overwhelmed by large responses. This implementation will:

- **Default Limit**: 25,000 tokens as recommended by Claude Code docs
- **Configurable Limits**: Support for custom limits via configuration and environment variables
- **Warning System**: Informative messages when responses approach or exceed limits
- **Graceful Truncation**: Smart truncation with informative messages

### Implementation Details

**Token Limit Configuration (`/src/mcp/limits/types.ts`):**
```typescript
export interface TokenLimitConfig {
  maxOutputTokens: number;
  warningThreshold: number; // Percentage of max before warning
  truncationEnabled: boolean;
  includeWarnings: boolean;
}

export interface TokenLimitResult {
  content: string;
  tokenCount: number;
  wasLimited: boolean;
  warningMessage?: string;
  truncationMessage?: string;
}

export const DEFAULT_TOKEN_LIMITS: TokenLimitConfig = {
  maxOutputTokens: 25000, // Claude Code recommended default
  warningThreshold: 0.8, // Warn at 80% of limit
  truncationEnabled: true,
  includeWarnings: true,
};
```

**Token Counter Implementation (`/src/mcp/limits/token-counter.ts`):**
```typescript
export class TokenCounter {
  /**
   * Estimate token count for text content
   * Uses rough approximation: ~4 characters per token for English text
   */
  static estimateTokens(text: string): number {
    // More accurate estimation could use tiktoken library
    // For now, use conservative estimate
    const roughTokenCount = Math.ceil(text.length / 4);

    // Add overhead for JSON structure, formatting, etc.
    return Math.ceil(roughTokenCount * 1.2);
  }

  /**
   * Estimate tokens for structured data (JSON)
   */
  static estimateJsonTokens(data: any): number {
    const jsonString = JSON.stringify(data, null, 2);
    return this.estimateTokens(jsonString);
  }

  /**
   * Check if content exceeds token limits
   */
  static checkLimits(
    content: string,
    config: TokenLimitConfig
  ): TokenLimitResult {
    const tokenCount = this.estimateTokens(content);
    const warningThreshold = config.maxOutputTokens * config.warningThreshold;

    let result: TokenLimitResult = {
      content,
      tokenCount,
      wasLimited: false,
    };

    // Check if content exceeds limits
    if (tokenCount > config.maxOutputTokens && config.truncationEnabled) {
      const maxChars = Math.floor(config.maxOutputTokens * 4 / 1.2); // Reverse estimation
      const truncatedContent = content.substring(0, maxChars);

      result = {
        content: truncatedContent,
        tokenCount: config.maxOutputTokens,
        wasLimited: true,
        truncationMessage: `Content truncated: Original ${tokenCount} tokens exceeded limit of ${config.maxOutputTokens} tokens. Use pagination or filtering to get complete results.`,
      };
    }
    // Add warning if approaching limit
    else if (tokenCount > warningThreshold && config.includeWarnings) {
      result.warningMessage = `Large response: ${tokenCount} tokens (${Math.round((tokenCount / config.maxOutputTokens) * 100)}% of ${config.maxOutputTokens} token limit). Consider using filters to reduce response size.`;
    }

    return result;
  }
}
```

**Output Limiting Middleware (`/src/mcp/limits/output-limiter.ts`):**
```typescript
export class OutputLimiter {
  private config: TokenLimitConfig;

  constructor(config?: Partial<TokenLimitConfig>) {
    this.config = {
      ...DEFAULT_TOKEN_LIMITS,
      ...config,
    };

    // Override with environment variable if set
    if (process.env.MAX_MCP_OUTPUT_TOKENS) {
      this.config.maxOutputTokens = parseInt(process.env.MAX_MCP_OUTPUT_TOKENS, 10);
    }
  }

  /**
   * Apply token limits to tool response
   */
  limitToolResponse(response: any): any {
    if (typeof response !== 'object' || !response.content) {
      return response;
    }

    // Process each content item
    const limitedContent = response.content.map((item: any) => {
      if (item.type === 'text' && item.text) {
        const result = TokenCounter.checkLimits(item.text, this.config);

        let limitedText = result.content;

        // Add warning message if present
        if (result.warningMessage) {
          limitedText = `⚠️ ${result.warningMessage}\n\n${limitedText}`;
        }

        // Add truncation message if truncated
        if (result.truncationMessage) {
          limitedText = `${limitedText}\n\n🔄 ${result.truncationMessage}`;
        }

        return {
          ...item,
          text: limitedText,
          _tokenInfo: {
            originalTokens: result.wasLimited ? result.tokenCount : undefined,
            finalTokens: TokenCounter.estimateTokens(limitedText),
            wasLimited: result.wasLimited,
          },
        };
      }

      return item;
    });

    return {
      ...response,
      content: limitedContent,
    };
  }

  /**
   * Apply limits to resource response
   */
  limitResourceResponse(response: any): any {
    if (!response.contents || !Array.isArray(response.contents)) {
      return response;
    }

    const limitedContents = response.contents.map((content: any) => {
      if (content.text) {
        const result = TokenCounter.checkLimits(content.text, this.config);

        return {
          ...content,
          text: result.content,
          _limitInfo: result.wasLimited ? {
            originalTokens: result.tokenCount,
            truncated: true,
            message: result.truncationMessage,
          } : undefined,
        };
      }

      return content;
    });

    return {
      ...response,
      contents: limitedContents,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): TokenLimitConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TokenLimitConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }
}
```

**Integration with MCP Tools (`/src/mcp/tools/tool-wrapper.ts`):**
```typescript
export function createLimitedTool<T>(
  tool: Tool,
  validator: (input: unknown) => T,
  handler: (input: T, context: McpContext) => Promise<any>,
  outputLimiter: OutputLimiter
): Tool {
  return {
    ...tool,
    async handler(request, context) {
      try {
        // Input validation
        const validatedInput = validator(request.params);

        // Execute handler
        const result = await handler(validatedInput, context);

        // Format response
        const response = {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, data: result }, null, 2)
          }]
        };

        // Apply token limits
        return outputLimiter.limitToolResponse(response);

      } catch (error) {
        const errorResponse = handleMcpError(error);
        return outputLimiter.limitToolResponse(errorResponse);
      }
    }
  };
}
```

**Configuration Integration (`/src/mcp/config.ts`):**
```typescript
// Update getMcpConfig to include token limits
export function getMcpConfig(config: BacklogConfig): McpConfig {
  // ... existing code ...

  // Token limits configuration
  const tokenLimits = {
    maxOutputTokens: config.mcp?.rateLimiting?.maxOutputTokens
      ?? parseInt(process.env.MAX_MCP_OUTPUT_TOKENS || '25000', 10),
    warningThreshold: 0.8,
    truncationEnabled: true,
    includeWarnings: true,
  };

  return {
    ...mcpConfig,
    rateLimiting: {
      ...mcpConfig.rateLimiting,
      ...tokenLimits,
    },
  };
}
```

**CLI Integration for Token Limit Management:**
```typescript
// Add token limit commands to MCP group
mcpCmd
  .command('limits')
  .description('Manage MCP output token limits')
  .option('--show', 'Show current limits')
  .option('--set-max <tokens>', 'Set maximum output tokens')
  .option('--test <file>', 'Test token counting on file')
  .action(async (options) => {
    if (options.show) {
      await showTokenLimits();
    } else if (options.setMax) {
      await setMaxTokens(parseInt(options.setMax, 10));
    } else if (options.test) {
      await testTokenCounting(options.test);
    }
  });

async function showTokenLimits() {
  const config = await getConfig();
  const mcpConfig = getMcpConfig(config);

  console.log('📊 MCP Token Limits:');
  console.log(`  Max output tokens: ${mcpConfig.rateLimiting.maxOutputTokens.toLocaleString()}`);
  console.log(`  Warning threshold: ${Math.round(mcpConfig.rateLimiting.maxOutputTokens * 0.8).toLocaleString()} tokens (80%)`);
  console.log(`  Environment override: ${process.env.MAX_MCP_OUTPUT_TOKENS || 'Not set'}`);
}

async function testTokenCounting(filePath: string) {
  try {
    const content = await Bun.file(filePath).text();
    const tokenCount = TokenCounter.estimateTokens(content);
    const jsonTokens = TokenCounter.estimateJsonTokens({ content });

    console.log('🧮 Token Count Test:');
    console.log(`  File: ${filePath}`);
    console.log(`  Characters: ${content.length.toLocaleString()}`);
    console.log(`  Estimated tokens (text): ${tokenCount.toLocaleString()}`);
    console.log(`  Estimated tokens (JSON): ${jsonTokens.toLocaleString()}`);
  } catch (error) {
    console.error(`Error reading file: ${error instanceof Error ? error.message : error}`);
  }
}
```

**Environment Variable Support:**
```bash
# Configure output token limits
export MAX_MCP_OUTPUT_TOKENS=50000

# Disable warnings
export BACKLOG_MCP_DISABLE_WARNINGS=true

# Disable truncation (allow unlimited output)
export BACKLOG_MCP_DISABLE_TRUNCATION=true
```

**Integration with Server (`/src/mcp/server.ts`):**
```typescript
export class McpServer extends Core {
  private outputLimiter: OutputLimiter;

  async initialize(): Promise<void> {
    // ... existing code ...

    // Initialize output limiter with configuration
    const mcpConfig = getMcpConfig(await this.getConfig());
    this.outputLimiter = new OutputLimiter({
      maxOutputTokens: mcpConfig.rateLimiting.maxOutputTokens,
      warningThreshold: 0.8,
      truncationEnabled: !process.env.BACKLOG_MCP_DISABLE_TRUNCATION,
      includeWarnings: !process.env.BACKLOG_MCP_DISABLE_WARNINGS,
    });

    // Register tools with output limiting
    this.registerToolsWithLimits();
  }

  private registerToolsWithLimits(): void {
    // Wrap all tools with output limiting
    Object.values(this.tools).forEach(tool => {
      this.server.setRequestHandler(ToolRequestSchema, tool.name, async (request) => {
        const response = await tool.handler(request);
        return this.outputLimiter.limitToolResponse(response);
      });
    });
  }
}
```

### Performance Considerations

- **Efficient Counting**: Use approximation for speed, not exact tokenization
- **Smart Truncation**: Truncate at word boundaries when possible
- **Minimal Overhead**: Fast token estimation without external dependencies
- **Configurable**: Allow tuning based on client capabilities

### Testing Strategy

- **Unit Tests**: Test token counting accuracy and edge cases
- **Integration Tests**: Test with real MCP responses
- **Performance Tests**: Ensure minimal overhead
- **Large Data Tests**: Test behavior with very large responses

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Token counter implementation with estimation logic
- [ ] Configurable output limits (default 25,000 tokens)
- [ ] Warning system for large responses
- [ ] Smart truncation with informative messages
- [ ] Environment variable support (MAX_MCP_OUTPUT_TOKENS)
- [ ] CLI commands for limit management and testing
- [ ] Integration with all MCP tools and resources
- [ ] Configuration system integration
- [ ] Performance optimization for minimal overhead
- [ ] Unit tests for token counting and limiting
<!-- AC:END -->