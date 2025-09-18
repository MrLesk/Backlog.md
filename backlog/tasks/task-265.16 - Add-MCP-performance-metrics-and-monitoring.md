---
id: task-265.16
title: Add MCP performance metrics and monitoring
status: To Do
assignee: []
created_date: '2025-09-15 12:45'
labels:
  - mcp
  - performance
  - monitoring
dependencies: ['task-265.14']
parent_task_id: task-265
priority: low
---

## Description

Implement comprehensive performance metrics tracking and monitoring for MCP operations to enable performance optimization and troubleshooting, following observability best practices.

### Technical Context

Performance monitoring is essential for maintaining optimal MCP server performance and diagnosing issues. This implementation provides:

- **Response Time Tracking**: Monitor tool and resource response times
- **Memory Usage Monitoring**: Track memory consumption and detect leaks
- **Connection Pool Statistics**: Monitor connection health and utilization
- **Performance Dashboard**: Integrated reporting via doctor command

### Implementation Details

**Performance Metrics Types (`/src/mcp/monitoring/types.ts`):**
```typescript
export interface PerformanceMetrics {
  tools: ToolMetrics;
  resources: ResourceMetrics;
  connections: ConnectionMetrics;
  memory: MemoryMetrics;
  system: SystemMetrics;
}

export interface ToolMetrics {
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  slowestOperation: OperationMetric;
  fastestOperation: OperationMetric;
  operationCounts: Record<string, number>;
  responseTimeHistogram: Record<string, number>;
}

export interface ResourceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  resourceSizes: Record<string, number>;
}

export interface ConnectionMetrics {
  activeConnections: number;
  totalConnections: number;
  connectionErrors: number;
  averageConnectionTime: number;
  connectionPool: {
    size: number;
    active: number;
    idle: number;
    pending: number;
  };
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  memoryLeakDetected: boolean;
  gcMetrics: {
    collections: number;
    totalDuration: number;
    averageDuration: number;
  };
}

export interface SystemMetrics {
  uptime: number;
  cpuUsage: number;
  loadAverage: number[];
  diskUsage: {
    used: number;
    total: number;
    available: number;
  };
}

export interface OperationMetric {
  name: string;
  responseTime: number;
  timestamp: number;
  success: boolean;
}
```

**Performance Monitor Implementation (`/src/mcp/monitoring/performance-monitor.ts`):**
```typescript
export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private startTime: number;
  private operationHistory: OperationMetric[] = [];
  private maxHistorySize = 1000;

  constructor() {
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.startMemoryMonitoring();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      tools: {
        totalRequests: 0,
        totalErrors: 0,
        averageResponseTime: 0,
        slowestOperation: { name: '', responseTime: 0, timestamp: 0, success: true },
        fastestOperation: { name: '', responseTime: Infinity, timestamp: 0, success: true },
        operationCounts: {},
        responseTimeHistogram: {},
      },
      resources: {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        resourceSizes: {},
      },
      connections: {
        activeConnections: 0,
        totalConnections: 0,
        connectionErrors: 0,
        averageConnectionTime: 0,
        connectionPool: {
          size: 0,
          active: 0,
          idle: 0,
          pending: 0,
        },
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        memoryLeakDetected: false,
        gcMetrics: {
          collections: 0,
          totalDuration: 0,
          averageDuration: 0,
        },
      },
      system: {
        uptime: 0,
        cpuUsage: 0,
        loadAverage: [],
        diskUsage: {
          used: 0,
          total: 0,
          available: 0,
        },
      },
    };
  }

  /**
   * Track tool operation performance
   */
  trackToolOperation(
    toolName: string,
    responseTime: number,
    success: boolean,
    tokenCount?: number
  ): void {
    const operation: OperationMetric = {
      name: toolName,
      responseTime,
      timestamp: Date.now(),
      success,
    };

    // Update tool metrics
    this.metrics.tools.totalRequests++;
    if (!success) {
      this.metrics.tools.totalErrors++;
    }

    // Update operation counts
    this.metrics.tools.operationCounts[toolName] =
      (this.metrics.tools.operationCounts[toolName] || 0) + 1;

    // Update response time tracking
    this.updateResponseTimeMetrics(operation);

    // Add to history
    this.addToHistory(operation);

    // Update histogram
    this.updateResponseTimeHistogram(responseTime);
  }

  private updateResponseTimeMetrics(operation: OperationMetric): void {
    const tools = this.metrics.tools;

    // Update average (rolling average)
    const total = tools.totalRequests;
    tools.averageResponseTime =
      ((tools.averageResponseTime * (total - 1)) + operation.responseTime) / total;

    // Update slowest operation
    if (operation.responseTime > tools.slowestOperation.responseTime) {
      tools.slowestOperation = operation;
    }

    // Update fastest operation
    if (operation.responseTime < tools.fastestOperation.responseTime && operation.success) {
      tools.fastestOperation = operation;
    }
  }

  private updateResponseTimeHistogram(responseTime: number): void {
    let bucket: string;

    if (responseTime < 100) bucket = '<100ms';
    else if (responseTime < 500) bucket = '100-500ms';
    else if (responseTime < 1000) bucket = '500ms-1s';
    else if (responseTime < 5000) bucket = '1-5s';
    else bucket = '>5s';

    this.metrics.tools.responseTimeHistogram[bucket] =
      (this.metrics.tools.responseTimeHistogram[bucket] || 0) + 1;
  }

  /**
   * Track resource access performance
   */
  trackResourceAccess(
    resourceUri: string,
    responseTime: number,
    cacheHit: boolean,
    dataSize?: number
  ): void {
    this.metrics.resources.totalRequests++;

    if (cacheHit) {
      this.metrics.resources.cacheHits++;
    } else {
      this.metrics.resources.cacheMisses++;
    }

    // Update average response time
    const total = this.metrics.resources.totalRequests;
    this.metrics.resources.averageResponseTime =
      ((this.metrics.resources.averageResponseTime * (total - 1)) + responseTime) / total;

    // Track resource sizes
    if (dataSize !== undefined) {
      this.metrics.resources.resourceSizes[resourceUri] = dataSize;
    }
  }

  /**
   * Track connection metrics
   */
  trackConnection(connected: boolean, connectionTime?: number): void {
    if (connected) {
      this.metrics.connections.activeConnections++;
      this.metrics.connections.totalConnections++;

      if (connectionTime !== undefined) {
        const total = this.metrics.connections.totalConnections;
        this.metrics.connections.averageConnectionTime =
          ((this.metrics.connections.averageConnectionTime * (total - 1)) + connectionTime) / total;
      }
    } else {
      this.metrics.connections.activeConnections = Math.max(0, this.metrics.connections.activeConnections - 1);
    }
  }

  /**
   * Track connection errors
   */
  trackConnectionError(): void {
    this.metrics.connections.connectionErrors++;
  }

  /**
   * Update memory metrics
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      this.updateMemoryMetrics();
    }, 5000); // Update every 5 seconds
  }

  private updateMemoryMetrics(): void {
    const memUsage = process.memoryUsage();

    this.metrics.memory.heapUsed = memUsage.heapUsed;
    this.metrics.memory.heapTotal = memUsage.heapTotal;
    this.metrics.memory.external = memUsage.external;
    this.metrics.memory.rss = memUsage.rss;

    // Simple memory leak detection (rapid growth)
    const previousHeapUsed = this.metrics.memory.heapUsed;
    if (memUsage.heapUsed > previousHeapUsed * 1.5) {
      this.metrics.memory.memoryLeakDetected = true;
    }

    // Update system metrics
    this.updateSystemMetrics();
  }

  private updateSystemMetrics(): void {
    this.metrics.system.uptime = Date.now() - this.startTime;
    this.metrics.system.cpuUsage = process.cpuUsage().user / 1000; // Convert to ms

    try {
      this.metrics.system.loadAverage = require('os').loadavg();
    } catch {
      // Load average not available on all platforms
      this.metrics.system.loadAverage = [0, 0, 0];
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): string {
    const metrics = this.metrics;
    const uptime = Math.round(metrics.system.uptime / 1000);

    return `
📊 MCP Performance Summary:

🔧 Tools:
  • Total requests: ${metrics.tools.totalRequests.toLocaleString()}
  • Error rate: ${((metrics.tools.totalErrors / metrics.tools.totalRequests) * 100 || 0).toFixed(1)}%
  • Average response: ${metrics.tools.averageResponseTime.toFixed(0)}ms
  • Slowest operation: ${metrics.tools.slowestOperation.name} (${metrics.tools.slowestOperation.responseTime.toFixed(0)}ms)

📁 Resources:
  • Total requests: ${metrics.resources.totalRequests.toLocaleString()}
  • Cache hit rate: ${((metrics.resources.cacheHits / metrics.resources.totalRequests) * 100 || 0).toFixed(1)}%
  • Average response: ${metrics.resources.averageResponseTime.toFixed(0)}ms

🔌 Connections:
  • Active: ${metrics.connections.activeConnections}
  • Total established: ${metrics.connections.totalConnections.toLocaleString()}
  • Connection errors: ${metrics.connections.connectionErrors.toLocaleString()}

💾 Memory:
  • Heap used: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(1)} MB
  • RSS: ${(metrics.memory.rss / 1024 / 1024).toFixed(1)} MB
  • Memory leak detected: ${metrics.memory.memoryLeakDetected ? '⚠️ Yes' : '✅ No'}

⏱️ System:
  • Uptime: ${uptime}s
  • CPU usage: ${metrics.system.cpuUsage.toFixed(1)}ms
    `.trim();
  }

  /**
   * Get detailed operation history
   */
  getOperationHistory(limit: number = 100): OperationMetric[] {
    return this.operationHistory.slice(-limit);
  }

  private addToHistory(operation: OperationMetric): void {
    this.operationHistory.push(operation);

    // Keep history size manageable
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory = this.operationHistory.slice(-this.maxHistorySize / 2);
    }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.operationHistory = [];
    this.startTime = Date.now();
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      recentOperations: this.getOperationHistory(50),
    }, null, 2);
  }
}
```

**Performance Wrapper for Tools (`/src/mcp/monitoring/performance-wrapper.ts`):**
```typescript
export function createPerformanceMonitoredTool<T>(
  tool: Tool,
  validator: (input: unknown) => T,
  handler: (input: T, context: McpContext) => Promise<any>,
  performanceMonitor: PerformanceMonitor
): Tool {
  return {
    ...tool,
    async handler(request, context) {
      const startTime = Date.now();
      let success = false;
      let tokenCount = 0;

      try {
        // Input validation
        const validatedInput = validator(request.params);

        // Execute handler
        const result = await handler(validatedInput, context);

        // Estimate token count if result contains text
        if (typeof result === 'object' && result.data) {
          tokenCount = TokenCounter.estimateJsonTokens(result.data);
        }

        success = true;

        // Format response
        const response = {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, data: result }, null, 2)
          }]
        };

        return response;

      } catch (error) {
        const errorResponse = handleMcpError(error);
        return errorResponse;

      } finally {
        // Track performance metrics
        const responseTime = Date.now() - startTime;
        performanceMonitor.trackToolOperation(
          tool.name,
          responseTime,
          success,
          tokenCount
        );
      }
    }
  };
}
```

**CLI Integration for Performance Monitoring:**
```typescript
// Add performance commands to MCP group
mcpCmd
  .command('metrics')
  .description('View MCP performance metrics')
  .option('--summary', 'Show performance summary')
  .option('--detailed', 'Show detailed metrics')
  .option('--export <file>', 'Export metrics to JSON file')
  .option('--history [limit]', 'Show operation history')
  .option('--reset', 'Reset all metrics')
  .action(async (options) => {
    if (options.summary) {
      await showPerformanceSummary();
    } else if (options.detailed) {
      await showDetailedMetrics();
    } else if (options.export) {
      await exportMetrics(options.export);
    } else if (options.history) {
      await showOperationHistory(parseInt(options.history) || 100);
    } else if (options.reset) {
      await resetMetrics();
    } else {
      await showPerformanceSummary(); // Default action
    }
  });

async function showPerformanceSummary() {
  const performanceMonitor = getGlobalPerformanceMonitor();
  console.log(performanceMonitor.getPerformanceSummary());
}

async function showDetailedMetrics() {
  const performanceMonitor = getGlobalPerformanceMonitor();
  const metrics = performanceMonitor.getMetrics();

  console.log('📊 Detailed MCP Metrics:');
  console.log(JSON.stringify(metrics, null, 2));
}

async function exportMetrics(filename: string) {
  const performanceMonitor = getGlobalPerformanceMonitor();
  const metricsJson = performanceMonitor.exportMetrics();

  await Bun.write(filename, metricsJson);
  console.log(`✅ Metrics exported to ${filename}`);
}
```

**Integration with Doctor Command:**
```typescript
// Enhance doctor command with performance metrics
mcpCmd
  .command('doctor')
  .description('Diagnose MCP configuration and setup issues')
  .option('--metrics', 'Include performance metrics in diagnosis')
  .option('--memory-check', 'Focus on memory usage analysis')
  .action(async (options) => {
    // ... existing doctor logic ...

    if (options.metrics || options.memoryCheck) {
      await showPerformanceDiagnostics(options.memoryCheck);
    }
  });

async function showPerformanceDiagnostics(memoryFocus: boolean) {
  const performanceMonitor = getGlobalPerformanceMonitor();
  const metrics = performanceMonitor.getMetrics();

  console.log('\n🔍 Performance Diagnostics:');

  // Response time analysis
  if (metrics.tools.averageResponseTime > 1000) {
    console.log('⚠️ High average response time detected');
    console.log(`   Average: ${metrics.tools.averageResponseTime.toFixed(0)}ms (target: <500ms)`);
  }

  // Error rate analysis
  const errorRate = (metrics.tools.totalErrors / metrics.tools.totalRequests) * 100;
  if (errorRate > 5) {
    console.log('⚠️ High error rate detected');
    console.log(`   Error rate: ${errorRate.toFixed(1)}% (target: <2%)`);
  }

  // Memory analysis
  if (memoryFocus || metrics.memory.memoryLeakDetected) {
    console.log('\n💾 Memory Analysis:');
    console.log(`   Heap used: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   RSS: ${(metrics.memory.rss / 1024 / 1024).toFixed(1)} MB`);

    if (metrics.memory.memoryLeakDetected) {
      console.log('⚠️ Potential memory leak detected');
      console.log('   Recommendation: Monitor memory usage over time');
    }
  }

  // Connection analysis
  if (metrics.connections.connectionErrors > 0) {
    console.log('\n🔌 Connection Issues:');
    console.log(`   Connection errors: ${metrics.connections.connectionErrors}`);
    console.log('   Recommendation: Check network connectivity and server health');
  }
}
```

**Global Performance Monitor:**
```typescript
// Global performance monitor instance
let globalPerformanceMonitor: PerformanceMonitor;

export function getGlobalPerformanceMonitor(): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor();
  }
  return globalPerformanceMonitor;
}

export function initializePerformanceMonitoring(): void {
  if (process.env.BACKLOG_MCP_METRICS === 'true') {
    getGlobalPerformanceMonitor();
    console.log('📊 Performance monitoring enabled');
  }
}
```

### Configuration Integration

```typescript
// Add performance monitoring settings to MCP configuration
export interface McpConfig {
  // ... existing properties ...
  monitoring?: {
    enabled: boolean;
    metricsRetention: number; // History size
    exportInterval?: number; // Auto-export interval in ms
    alertThresholds: {
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
    };
  };
}
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Performance metrics tracking for all MCP operations
- [ ] Response time monitoring and histogram generation
- [ ] Memory usage monitoring with leak detection
- [ ] Connection pool statistics tracking
- [ ] Performance dashboard via CLI commands
- [ ] Metrics export functionality (JSON format)
- [ ] Integration with doctor command for diagnostics
- [ ] Configurable alerting thresholds
- [ ] Operation history tracking with limits
- [ ] Unit tests for all monitoring components
<!-- AC:END -->