---
id: task-265.34
title: Remove circular dependency detection from MCP
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-23 14:02'
updated_date: '2025-09-23 15:30'
labels:
  - mcp
  - architecture
  - feature-removal
dependencies: []
parent_task_id: task-265
priority: high
---

## Description

Delete the unauthorized circular dependency detection feature from MCP that does not exist in CLI.

Issue: MCP has a detectCircularDependency method (350+ lines) in src/mcp/tools/dependency-tools.ts that provides functionality the CLI does not have. This violates the principle that MCP should be a pure wrapper.

Changes Required:
1. Delete method: Remove detectCircularDependency entirely
2. Remove calls: Remove all calls to this method from add/remove dependency operations  
3. Update validation: Keep only basic validation that matches CLI behavior

Files to Modify:
- src/mcp/tools/dependency-tools.ts - Remove detectCircularDependency method
- Remove any references to circular dependency checking in MCP handlers

Acceptance Criteria:
- MCP no longer checks for circular dependencies
- Dependency validation matches CLI exactly  
- No business logic that CLI does not have
- Tests pass without circular dependency detection

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Remove detectCircularDependency method entirely from dependency-tools.ts
- [x] #2 Remove all calls to circular dependency detection in add/remove operations
- [x] #3 Update validation logic to match CLI behavior exactly (existence + self-reference only)
- [x] #4 Update/remove affected test cases that expect circular dependency detection
- [x] #5 Verify MCP dependency validation matches CLI behavior exactly
- [x] #6 All tests pass without circular dependency detection functionality
<!-- AC:END -->


## Implementation Plan

## Implementation Plan: Remove Circular Dependency Detection from MCP

### Overview
Remove unauthorized circular dependency detection feature from MCP to restore architectural compliance as a pure wrapper around CLI functionality. This addresses a critical architectural violation where MCP provides business logic beyond CLI capabilities.

### Phase 1: Code Analysis and Baseline Establishment
1. **Analyze CLI validation behavior** (src/cli.ts:738-752)
   - Document exact validation: dependency existence check + self-reference prevention only
   - No circular dependency detection in CLI
   - Establish MCP target behavior to match CLI exactly

2. **Identify all circular dependency code in MCP**
   - Primary method: detectCircularDependency (dependency-tools.ts:135-195)
   - Call sites in addDependencies (line 236-239) 
   - Call sites in validateDependencyGraph (line 400-404)
   - Related test cases in dependency-tools.test.ts

### Phase 2: Test Updates (Security-First Approach)
1. **Remove circular dependency test cases first**
   - Remove "should detect circular dependencies" tests
   - Remove "should detect multi-level circular dependencies" tests
   - Update validation tests to expect CLI-equivalent behavior
   - This reveals exact behavior changes needed

2. **Update error handling tests**
   - Remove circular dependency error message tests
   - Ensure remaining validation errors match CLI format
   - Test dependency existence validation still works
   - Test self-reference prevention still works

### Phase 3: Code Removal and Refactoring
1. **Remove method calls before method deletion**
   - Update addDependencies() to remove circular dependency check calls
   - Update validateDependencyGraph() to remove circular dependency check calls
   - Preserve only CLI-equivalent validation: existence + self-reference

2. **Delete detectCircularDependency method entirely**
   - Remove entire method (60+ lines of DFS algorithm)
   - Remove related helper functions and constants
   - Clean up any imports or references

3. **Update validation logic alignment**
   - Ensure MCP validation exactly matches CLI behavior
   - Keep: dependency existence validation, self-reference prevention
   - Remove: all circular dependency detection, DFS traversal, cycle detection

### Phase 4: Verification and Quality Assurance
1. **Behavioral consistency testing**
   - Create dependency cycles through CLI (should succeed)
   - Attempt same cycles through MCP (must also succeed)
   - Verify error messages match between CLI and MCP

2. **Architecture compliance verification**
   - Confirm MCP no longer exceeds CLI capabilities
   - Verify no business logic beyond pure wrapper functionality
   - Validate all remaining functionality uses Core APIs

3. **Security validation**
   - Verify removal of complex recursive algorithms (reduces attack surface)
   - Confirm no stack overflow or memory exhaustion risks remain
   - Test that basic validation still prevents invalid dependencies

### Phase 5: Testing and Documentation
1. **Run full test suite**
   - All dependency-related tests must pass
   - No tests should expect circular dependency rejection
   - Verify MCP behavior matches CLI exactly

2. **Performance and code quality checks**
   - Run lint and typecheck commands
   - Verify code simplification (350+ lines removed)
   - Confirm no dead code or unused imports remain

### Success Criteria
- detectCircularDependency method completely removed
- All calls to circular dependency detection removed
- MCP validation behavior matches CLI exactly
- All tests pass without circular dependency detection
- No architectural violations remain
- Code is cleaner and more secure

### Risk Mitigation
- **Low Risk Operation**: Removing validation is safer than adding it
- **Isolated Change**: Circular dependency logic is cleanly contained
- **Test-Driven**: Remove tests first to understand exact changes needed
- **CLI Alignment**: Target behavior already exists and is tested in CLI


## Implementation Notes

Implementation Summary: Successfully removed unauthorized circular dependency detection from MCP to restore architectural compliance as a pure wrapper around CLI functionality. Changes Made: Code Removed - Deleted detectCircularDependency method entirely (~60 lines of DFS algorithm) from dependency-tools.ts:135-195, Removed circular dependency check calls from addDependencies() method (lines 236-239), Removed circular dependency check calls from validateDependencyGraph() method (lines 400-404). Test Updates - Removed 3 circular dependency test cases from dependency-tools.test.ts, Updated validation test expectations to not expect circular dependency checks. Validation Logic Alignment - MCP validation now matches CLI exactly with only dependency existence checking and self-reference prevention, Removed all complex graph traversal and cycle detection logic. Architecture Compliance Restored: MCP is Pure Wrapper (No longer provides business logic beyond CLI capabilities), CLI Feature Parity (MCP dependency validation exactly matches CLI behavior), No Unauthorized Features (Eliminated 60+ lines of unauthorized circular dependency detection), Security Improvement (Removed complex recursive algorithms that posed DoS risks). Quality Verification: All Tests Pass (20/20 dependency tool tests passing, 333/333 total MCP tests passing), Code Quality (Biome formatting applied, no new linting issues introduced), Behavioral Consistency (MCP dependency validation now matches CLI exactly). Files Modified: src/mcp/tools/dependency-tools.ts (Removed detectCircularDependency method and calls), src/mcp/__tests__/unit/dependency-tools.test.ts (Updated test expectations). Impact: Reduced Code Complexity (60+ lines of complex DFS algorithm removed), Improved Security (Eliminated potential DoS attack vectors from recursive graph traversal), Architectural Integrity (Restored MCP role as pure protocol wrapper), Cleaner Codebase (Simplified validation logic with clear boundaries).
