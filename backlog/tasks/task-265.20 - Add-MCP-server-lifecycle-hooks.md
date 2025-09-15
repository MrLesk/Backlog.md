---
id: task-265.20
title: Add MCP server lifecycle hooks
status: To Do
assignee: []
created_date: '2025-09-15 12:59'
labels:
  - mcp
  - lifecycle
  - hooks
dependencies: ['task-265.07']
parent_task_id: task-265
priority: low
---

## Description

Implement hooks for server startup, shutdown, and error events to enable custom initialization, cleanup, and error recovery logic.

### Technical Context

Server lifecycle hooks provide extension points for custom logic during server lifecycle events, enabling better integration and monitoring.

### Implementation Details

**Lifecycle Hook System (`/src/mcp/lifecycle/hook-system.ts`):**
```typescript
export enum LifecycleEvent {
  PRE_START = 'pre-start',
  POST_START = 'post-start',
  PRE_STOP = 'pre-stop',
  POST_STOP = 'post-stop',
  ERROR = 'error',
  HEALTH_CHECK = 'health-check'
}

export interface LifecycleHook {
  event: LifecycleEvent;
  handler: (context: LifecycleContext) => Promise<void>;
  priority: number;
}

export interface LifecycleContext {
  event: LifecycleEvent;
  server: McpServer;
  error?: Error;
  metadata?: Record<string, any>;
}

export class LifecycleHookManager {
  private hooks: Map<LifecycleEvent, LifecycleHook[]> = new Map();

  registerHook(hook: LifecycleHook): void {
    const eventHooks = this.hooks.get(hook.event) || [];
    eventHooks.push(hook);
    eventHooks.sort((a, b) => a.priority - b.priority);
    this.hooks.set(hook.event, eventHooks);
  }

  async executeHooks(event: LifecycleEvent, context: LifecycleContext): Promise<void> {
    const eventHooks = this.hooks.get(event) || [];

    for (const hook of eventHooks) {
      try {
        await hook.handler(context);
      } catch (error) {
        console.error(`Lifecycle hook failed for event '${event}':`, error);
        // Don't let hook failures prevent server operation
      }
    }
  }
}
```

**Server Integration:**
```typescript
export class McpServer extends Core {
  private lifecycleManager = new LifecycleHookManager();

  async start(): Promise<void> {
    // Pre-start hooks
    await this.lifecycleManager.executeHooks(LifecycleEvent.PRE_START, {
      event: LifecycleEvent.PRE_START,
      server: this
    });

    try {
      // Start server logic
      await this.startInternal();

      // Post-start hooks
      await this.lifecycleManager.executeHooks(LifecycleEvent.POST_START, {
        event: LifecycleEvent.POST_START,
        server: this
      });
    } catch (error) {
      // Error hooks
      await this.lifecycleManager.executeHooks(LifecycleEvent.ERROR, {
        event: LifecycleEvent.ERROR,
        server: this,
        error: error as Error
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    // Pre-stop hooks
    await this.lifecycleManager.executeHooks(LifecycleEvent.PRE_STOP, {
      event: LifecycleEvent.PRE_STOP,
      server: this
    });

    // Stop server logic
    await this.stopInternal();

    // Post-stop hooks
    await this.lifecycleManager.executeHooks(LifecycleEvent.POST_STOP, {
      event: LifecycleEvent.POST_STOP,
      server: this
    });
  }
}
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Pre-start validation hooks
- [ ] Post-start health checks
- [ ] Graceful shutdown handlers
- [ ] Error recovery hooks
- [ ] Hook registration and management system
<!-- AC:END -->