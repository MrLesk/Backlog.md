---
id: task-265.15
title: Implement connection retry and resilience patterns
status: To Do
assignee: []
created_date: '2025-09-15 12:40'
labels:
  - mcp
  - reliability
  - error-handling
dependencies: ['task-265.09']
parent_task_id: task-265
priority: medium
---

## Description

Implement robust connection retry logic and circuit breaker patterns for MCP connections to ensure reliable operation and graceful handling of transient failures, following Claude Code MCP best practices for resilience.

### Technical Context

Reliable MCP connections are critical for Claude Code integration. This implementation provides:

- **Exponential Backoff**: Progressive retry delays to avoid overwhelming failing services
- **Circuit Breaker**: Prevents repeated calls to failing services
- **Connection Health**: Monitoring and automatic recovery
- **Graceful Degradation**: Fallback strategies when services are unavailable

### Implementation Details

**Retry Configuration (`/src/mcp/resilience/types.ts`):**
```typescript
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringWindowMs: number;
  minimumThroughput: number;
}

export interface ResilienceConfig {
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  healthCheck: {
    intervalMs: number;
    timeoutMs: number;
    enabled: boolean;
  };
}

export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterEnabled: true,
  },
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeoutMs: 60000,
    monitoringWindowMs: 60000,
    minimumThroughput: 3,
  },
  healthCheck: {
    intervalMs: 30000,
    timeoutMs: 5000,
    enabled: true,
  },
};
```

**Exponential Backoff Implementation (`/src/mcp/resilience/retry.ts`):**
```typescript
export class ExponentialBackoff {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: Error;
    let attempt = 0;

    while (attempt < this.config.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt >= this.config.maxAttempts) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        console.warn(
          `${context || 'Operation'} failed (attempt ${attempt}/${this.config.maxAttempts}): ${lastError.message}. Retrying in ${delay}ms...`
        );

        await this.sleep(delay);
      }
    }

    throw new Error(
      `Operation failed after ${this.config.maxAttempts} attempts. Last error: ${lastError.message}`
    );
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelayMs);

    // Add jitter to prevent thundering herd
    if (this.config.jitterEnabled) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.round(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Circuit Breaker Implementation (`/src/mcp/resilience/circuit-breaker.ts`):**
```typescript
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig, private name: string) {
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker '${this.name}' is OPEN. Service unavailable.`);
      }
      // Transition to half-open
      this.state = CircuitState.HALF_OPEN;
      console.log(`Circuit breaker '${this.name}' transitioning to HALF_OPEN`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      console.log(`Circuit breaker '${this.name}' transitioning to CLOSED`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN ||
        (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold)) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeoutMs;
      console.warn(`Circuit breaker '${this.name}' transitioning to OPEN (${this.failureCount} failures)`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    console.log(`Circuit breaker '${this.name}' reset to CLOSED`);
  }
}
```

**Connection Health Monitor (`/src/mcp/resilience/health-monitor.ts`):**
```typescript
export class HealthMonitor {
  private isHealthy = true;
  private lastHealthCheck = 0;
  private healthCheckInterval?: Timer;
  private config: ResilienceConfig['healthCheck'];

  constructor(
    config: ResilienceConfig['healthCheck'],
    private healthCheckFn: () => Promise<boolean>,
    private onHealthChange?: (healthy: boolean) => void
  ) {
    this.config = config;

    if (config.enabled) {
      this.startHealthChecking();
    }
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.intervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      const isHealthy = await Promise.race([
        this.healthCheckFn(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), this.config.timeoutMs)
        ),
      ]);

      const responseTime = Date.now() - startTime;
      this.updateHealth(isHealthy, responseTime);
    } catch (error) {
      console.warn(`Health check failed: ${error instanceof Error ? error.message : error}`);
      this.updateHealth(false);
    }
  }

  private updateHealth(healthy: boolean, responseTime?: number): void {
    const wasHealthy = this.isHealthy;
    this.isHealthy = healthy;
    this.lastHealthCheck = Date.now();

    if (responseTime !== undefined) {
      console.debug(`Health check completed in ${responseTime}ms: ${healthy ? 'healthy' : 'unhealthy'}`);
    }

    if (wasHealthy !== healthy && this.onHealthChange) {
      this.onHealthChange(healthy);
    }
  }

  isServiceHealthy(): boolean {
    return this.isHealthy;
  }

  getLastHealthCheck(): number {
    return this.lastHealthCheck;
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}
```

**Resilient Connection Manager (`/src/mcp/resilience/connection-manager.ts`):**
```typescript
export class ResilientConnectionManager {
  private retry: ExponentialBackoff;
  private circuitBreaker: CircuitBreaker;
  private healthMonitor?: HealthMonitor;
  private isConnected = false;

  constructor(
    private config: ResilienceConfig,
    private connectionName: string
  ) {
    this.retry = new ExponentialBackoff(config.retry);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker, connectionName);
  }

  async connect<T>(
    connectionFn: () => Promise<T>,
    healthCheckFn?: () => Promise<boolean>
  ): Promise<T> {
    const connection = await this.circuitBreaker.execute(async () => {
      return await this.retry.execute(
        connectionFn,
        `MCP connection '${this.connectionName}'`
      );
    });

    this.isConnected = true;

    // Start health monitoring if health check function provided
    if (healthCheckFn && this.config.healthCheck.enabled) {
      this.healthMonitor = new HealthMonitor(
        this.config.healthCheck,
        healthCheckFn,
        (healthy) => this.onHealthChange(healthy)
      );
    }

    return connection;
  }

  async executeOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.isConnected) {
      throw new Error(`Connection '${this.connectionName}' is not established`);
    }

    return await this.circuitBreaker.execute(async () => {
      return await this.retry.execute(
        operation,
        `MCP operation on '${this.connectionName}'`
      );
    });
  }

  private onHealthChange(healthy: boolean): void {
    if (!healthy) {
      console.warn(`Connection '${this.connectionName}' became unhealthy`);
      // Could trigger reconnection logic here
    } else {
      console.log(`Connection '${this.connectionName}' became healthy`);
      // Reset circuit breaker on health recovery
      this.circuitBreaker.reset();
    }
  }

  getStatus(): {
    connected: boolean;
    healthy: boolean;
    circuitState: CircuitState;
    stats: any;
  } {
    return {
      connected: this.isConnected,
      healthy: this.healthMonitor?.isServiceHealthy() ?? true,
      circuitState: this.circuitBreaker.getState(),
      stats: this.circuitBreaker.getStats(),
    };
  }

  disconnect(): void {
    this.isConnected = false;
    this.healthMonitor?.stop();
    this.circuitBreaker.reset();
  }
}
```

**Integration with MCP Server (`/src/mcp/server.ts`):**
```typescript
export class McpServer extends Core {
  private connectionManager?: ResilientConnectionManager;

  async connect(transport: TransportType): Promise<void> {
    const config = getMcpConfig(await this.getConfig());
    const resilienceConfig = this.getResilienceConfig(config);

    this.connectionManager = new ResilientConnectionManager(
      resilienceConfig,
      `MCP-${transport}`
    );

    await this.connectionManager.connect(
      () => this.establishConnection(transport),
      () => this.healthCheck()
    );
  }

  private async establishConnection(transport: TransportType): Promise<void> {
    // Existing connection logic with error handling
    switch (transport) {
      case 'stdio':
        return await this.connectStdio();
      case 'http':
      case 'sse':
        return await this.connectHttp(transport);
      default:
        throw new Error(`Unsupported transport: ${transport}`);
    }
  }

  private async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - verify server is responsive
      return this.server?.close !== undefined && this.isInitialized;
    } catch {
      return false;
    }
  }

  private getResilienceConfig(mcpConfig: McpConfig): ResilienceConfig {
    return {
      retry: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        jitterEnabled: true,
      },
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
        monitoringWindowMs: 60000,
        minimumThroughput: 3,
      },
      healthCheck: {
        intervalMs: 30000,
        timeoutMs: 5000,
        enabled: true,
      },
    };
  }

  // Wrap tool execution with resilience
  async executeTool(name: string, params: any): Promise<any> {
    if (!this.connectionManager) {
      throw new Error('Connection manager not initialized');
    }

    return await this.connectionManager.executeOperation(async () => {
      return await this.executeToolInternal(name, params);
    });
  }

  getConnectionStatus(): any {
    return this.connectionManager?.getStatus() ?? { connected: false };
  }
}
```

**CLI Integration for Resilience Management:**
```typescript
// Add resilience commands to MCP group
mcpCmd
  .command('resilience')
  .description('Manage MCP connection resilience')
  .option('--status', 'Show connection resilience status')
  .option('--reset-circuit', 'Reset circuit breaker')
  .option('--test-retry', 'Test retry mechanism')
  .action(async (options) => {
    if (options.status) {
      await showResilienceStatus();
    } else if (options.resetCircuit) {
      await resetCircuitBreaker();
    } else if (options.testRetry) {
      await testRetryMechanism();
    }
  });

async function showResilienceStatus() {
  // Implementation to show current resilience status
  console.log('🛡️ MCP Resilience Status:');
  // Show circuit breaker state, health status, etc.
}
```

### Configuration Integration

```typescript
// Add resilience settings to MCP configuration
export interface McpConfig {
  // ... existing properties ...
  resilience?: {
    retry?: Partial<RetryConfig>;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
    healthCheck?: {
      enabled?: boolean;
      intervalMs?: number;
      timeoutMs?: number;
    };
  };
}
```

### Testing Strategy

- **Unit Tests**: Test retry logic, circuit breaker state transitions
- **Integration Tests**: Test with real connection failures
- **Chaos Testing**: Simulate various failure scenarios
- **Performance Tests**: Ensure minimal overhead during normal operation

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Exponential backoff retry implementation
- [ ] Circuit breaker with configurable thresholds
- [ ] Connection health monitoring
- [ ] Automatic recovery mechanisms
- [ ] Integration with MCP server and tools
- [ ] CLI commands for resilience management
- [ ] Configuration system integration
- [ ] Comprehensive error handling and logging
- [ ] Unit tests for all resilience patterns
- [ ] Documentation for resilience configuration
<!-- AC:END -->