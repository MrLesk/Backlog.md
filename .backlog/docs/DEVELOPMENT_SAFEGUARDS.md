# Development Safeguards

This document outlines the safeguards implemented to prevent common development issues, particularly import errors and TypeScript compilation problems.

## Issue: Import Errors Not Caught by Tests

### What Happened

The codebase had incorrect import statements in two files:
- `src/core/cross-branch-tasks.ts`: imported `GitOps` from `"./git-ops.ts"` (non-existent file)
- `src/core/remote-tasks.ts`: same incorrect import

These imports should have been:
```typescript
import type { GitOperations } from "../git/operations.ts";
```

### Why Tests Didn't Catch It

1. **Code paths not exercised**: The cross-branch functionality wasn't being triggered in test scenarios
2. **No TypeScript compilation check**: Tests only ran at runtime, not compilation time
3. **Bun runtime lenience**: Bun's runtime was more forgiving than TypeScript's strict compilation

### Safeguards Implemented

#### 1. TypeScript Compilation Test

**File**: `src/test/typescript-compilation.test.ts`

This test ensures all TypeScript files compile without errors:
```typescript
test("should compile all TypeScript files without errors", async () => {
  const result = await spawn(["bunx", "tsc", "--noEmit", "--project", "tsconfig.json"]);
  expect(await result.exited).toBe(0);
});
```

#### 2. Cross-Branch Functionality Tests

**File**: `src/test/cross-branch-tasks.test.ts`

Tests that specifically exercise the cross-branch functionality:
- Import validation
- Function calls with proper parameters
- Edge case handling

#### 3. Enhanced Build Process

**Updated scripts in `package.json`**:
```json
{
  "typecheck": "bunx tsc --noEmit",
  "check": "biome check . && bun run typecheck"
}
```

The `check` command now includes TypeScript compilation verification.

#### 4. Pre-commit Hook Enhancement

The existing lint-staged configuration now catches more issues because the `check` command includes TypeScript validation.

## Running Safeguards

### Before Committing
```bash
bun run check
```
This runs both Biome checks AND TypeScript compilation.

### Testing Import Issues
```bash
bun test src/test/typescript-compilation.test.ts
```

### Testing Cross-Branch Functionality
```bash
bun test src/test/cross-branch-tasks.test.ts
```

### Full Test Suite
```bash
bun test
```
Now includes the new safeguard tests.

## Best Practices

### 1. Always Run TypeScript Check
Before building or committing:
```bash
bun run typecheck
```

### 2. Test Import Changes
When adding new imports or moving files:
```bash
bun run check
bun test src/test/typescript-compilation.test.ts
```

### 3. Exercise New Code Paths
When adding new functionality, ensure tests actually call the new code:
```typescript
// Good: Actually calls the function
test("should use new functionality", async () => {
  const result = await newFunction(params);
  expect(result).toBeDefined();
});

// Bad: Only tests imports
test("should import correctly", () => {
  expect(newFunction).toBeDefined();
});
```

### 4. Use Strict TypeScript Configuration
The project uses strict TypeScript settings. Don't disable them without good reason.

## Common Import Issues to Watch For

### 1. Non-existent Files
```typescript
// ❌ Wrong: File doesn't exist
import { Foo } from "./non-existent-file.ts";

// ✅ Correct: Verify file exists
import { GitOperations } from "../git/operations.ts";
```

### 2. Incorrect Relative Paths
```typescript
// ❌ Wrong: Incorrect relative path
import { Foo } from "./git-ops.ts"; // from core/ directory

// ✅ Correct: Proper relative path
import { GitOperations } from "../git/operations.ts"; // from core/ to git/
```

### 3. Wrong Type Names
```typescript
// ❌ Wrong: Type name doesn't match export
import type { GitOps } from "../git/operations.ts";

// ✅ Correct: Matches actual export
import type { GitOperations } from "../git/operations.ts";
```

## IDE Configuration

### VS Code
Ensure TypeScript checking is enabled:
```json
// .vscode/settings.json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "typescript.check.npmIsInstalled": true
}
```

### Other IDEs
Configure your IDE to:
1. Show TypeScript errors in real-time
2. Auto-import from correct paths
3. Highlight unused imports

## Continuous Integration

For CI/CD pipelines, include:
```bash
# Install dependencies
bun install

# Run all checks
bun run check

# Run tests (including compilation tests)
bun test

# Build project
bun run build
```

This ensures import errors are caught before deployment.

## Monitoring

### Regular Checks
Run these commands regularly during development:
```bash
# Quick check
bun run typecheck

# Full verification
bun run check && bun test
```

### Before Pull Requests
```bash
# Complete verification
bun run check
bun test
bun run build
```

## Recovery

If you encounter import errors:

1. **Identify the correct import path**:
   ```bash
   find src -name "*.ts" | grep -E "(operations|git)"
   ```

2. **Check the export**:
   ```typescript
   // Look for: export class GitOperations
   ```

3. **Fix the import**:
   ```typescript
   import type { GitOperations } from "../git/operations.ts";
   ```

4. **Verify the fix**:
   ```bash
   bun run typecheck
   ```

These safeguards ensure that import errors and TypeScript compilation issues are caught early in the development process, preventing them from reaching production.