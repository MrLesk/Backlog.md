---
id: doc-001
title: Testing Style Guide
type: guide
created_date: '2025-07-21'
---

# Testing Style Guide

This document establishes consistent patterns for test files in the Backlog.md project.

## Import Organization

**Standard order:**
1. `bun:test` imports first
2. `node:*` imports second  
3. External library imports (like `bun`)
4. Local relative imports (`../`)
5. Test utility imports (`./test-utils.ts`, `./test-helpers.ts`)

```typescript
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";
```

## Variable Declarations

**Standard pattern:**
- Declare `let TEST_DIR: string;` outside describe blocks
- Assign unique directory in beforeEach using `createUniqueTestDir()`

```typescript
let TEST_DIR: string;

describe("Feature name", () => {
    let core: Core;
    
    beforeEach(async () => {
        TEST_DIR = createUniqueTestDir("test-feature-name");
        // ... rest of setup
    });
});
```

## Directory and Cleanup Patterns

**Standard test directory setup:**

```typescript
beforeEach(async () => {
    TEST_DIR = createUniqueTestDir("test-feature-name");
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
    await mkdir(TEST_DIR, { recursive: true });
    
    // Git setup if needed
    await $`git init`.cwd(TEST_DIR).quiet();
    await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
    await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
    
    // Core initialization
    core = new Core(TEST_DIR);
    await core.initializeProject("Test Project Name");
});
```

**Standard cleanup:**

```typescript
afterEach(async () => {
    try {
        await safeCleanup(TEST_DIR);
    } catch {
        // Ignore cleanup errors - the unique directory names prevent conflicts
    }
});
```

## Git Configuration

**When git setup is needed:**
- Tests that create/modify tasks with auto-commit
- Tests that use CLI commands requiring git
- Board view tests that need git for remote branch operations

**Standard git setup:**
```typescript
await $`git init`.cwd(TEST_DIR).quiet();
await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
```

## Error Handling

**Standard error handling:**
- Use try/catch blocks for cleanup operations
- Use `.catch(() => {})` for non-critical operations like initial cleanup
- Include descriptive comments explaining error handling decisions

```typescript
// For cleanup operations
try {
    await safeCleanup(TEST_DIR);
} catch {
    // Ignore cleanup errors - the unique directory names prevent conflicts
}

// For non-critical setup operations
await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
```

## Sample Data Patterns

**Preferred patterns:**
- Declare reusable sample objects outside describe blocks when used across multiple tests
- Create inline objects when specific to single test
- Use meaningful, descriptive data that clearly indicates test purpose

```typescript
// Reusable across multiple tests
const sampleTask: Task = {
    id: "task-1",
    title: "Test Task",
    status: "To Do",
    assignee: [],
    createdDate: "2025-07-21",
    labels: ["test"],
    dependencies: [],
    body: "This is a test task",
};

describe("task operations", () => {
    it("should create task", async () => {
        await core.createTask(sampleTask, false);
        // ...
    });
    
    it("should handle specific case", async () => {
        // Inline for specific test
        const specialTask: Task = {
            ...sampleTask,
            id: "task-special",
            title: "Special Case Task",
        };
        // ...
    });
});
```

## File Organization

**Test file structure:**
1. Imports
2. Global variable declarations (TEST_DIR, constants)
3. Sample data declarations (if reused)
4. Main describe block
5. beforeEach/afterEach hooks
6. Nested describe blocks for logical grouping
7. Individual test cases

## Naming Conventions

**Test directories:** Use descriptive kebab-case names prefixed with "test-"
- `createUniqueTestDir("test-feature-name")`

**Test descriptions:** Use clear, action-oriented descriptions
- ✅ "should create task with auto-commit"
- ❌ "task creation test"

**Variables:** Use UPPER_CASE for test directory constants, camelCase for other variables

## Why These Patterns?

- **Unique directories:** Prevent test conflicts and cleanup issues
- **Consistent cleanup:** Ensure clean test environment
- **Standard git setup:** Predictable behavior across git-dependent tests  
- **Organized imports:** Easy to scan and maintain
- **Error handling:** Graceful failure without masking real issues

## Migration Notes

When updating existing test files:
1. Add missing imports for `createUniqueTestDir` and `safeCleanup`
2. Replace hardcoded paths with `createUniqueTestDir()` pattern
3. Update cleanup to use `safeCleanup()` with try/catch
4. Ensure consistent import order
5. Move TEST_DIR declaration outside describe blocks
