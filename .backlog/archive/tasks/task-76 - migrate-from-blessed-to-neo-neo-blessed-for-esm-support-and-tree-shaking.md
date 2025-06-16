---
id: task-76
title: Migrate from blessed to neo-neo-blessed for ESM support and tree shaking
status: Won't Do
assignee:
  - '@ai-agent'
created_date: '2025-06-16'
updated_date: '2025-06-16'
labels:
  - refactoring
  - dependencies
  - build
  - performance
dependencies: []
---

## Description

Migrate the project from the legacy `blessed` library to `neo-neo-blessed`, a modern ESM-based fork that provides:
- Pure ESM modules instead of CommonJS
- Better tree shaking capabilities for smaller bundle sizes
- Modern JavaScript features and improved performance
- Active maintenance and bug fixes

The migration involves:
1. Replacing the blessed dependency with neo-neo-blessed
2. Updating all import statements from CJS to ESM syntax
3. Refactoring UI components to use the new API (if there are breaking changes)
4. Updating the build and bundling configuration
5. Simplifying CI/CD workflows by removing CJS-related workarounds
6. Testing all TUI functionality to ensure compatibility

**Resources:**
- GitHub: https://github.com/eirikb/neo-neo-blessed
- NPM: https://www.npmjs.com/package/neo-neo-blessed

## Acceptance Criteria

- [ ] Replace `blessed` with `neo-neo-blessed` in package.json
- [ ] Update all import statements to use ESM syntax
- [ ] All TUI components (board view, task viewer, etc.) work correctly
- [ ] Bundle size is reduced through proper tree shaking
- [ ] Build process uses ESM throughout (no CJS workarounds)
- [ ] CI/CD pipelines are simplified and all tests pass
- [ ] Binary releases work correctly on all platforms
- [ ] No regression in TUI functionality or performance
- [ ] Documentation updated to reflect the migration

## Technical Considerations

### Current Usage of Blessed
- Board view (`/src/ui/board.ts`)
- Task viewer (`/src/ui/task-viewer.ts`)
- List views and other UI components
- Screen management and event handling

### Migration Strategy
1. **Assessment Phase**
   - Identify all files using blessed
   - Document current blessed API usage
   - Check neo-neo-blessed API compatibility

2. **Migration Phase**
   - Create a feature branch for the migration
   - Replace dependency in package.json
   - Update imports systematically
   - Fix any API differences

3. **Build System Updates**
   - Update bundler configuration for ESM
   - Remove CJS-specific workarounds
   - Optimize tree shaking configuration

4. **Testing Phase**
   - Test all TUI functionality manually
   - Ensure automated tests pass
   - Verify binary builds on all platforms
   - Check bundle size improvements

### Potential Challenges
- API differences between blessed and neo-neo-blessed
- ESM compatibility with current tooling
- Binary packaging with ESM modules
- Ensuring backward compatibility for users

## Migration Decision: CANCELLED

### Critical Finding from Assessment (Task 76.1)

After thorough investigation, we discovered that **neo-neo-blessed does NOT provide ESM support**. The library still uses CommonJS modules, which means the primary goal of this migration cannot be achieved.

### Key Findings:
- neo-neo-blessed uses CommonJS (`require`/`module.exports`)
- No `"type": "module"` in package.json
- No tree shaking benefits
- Installation issues with native dependencies on modern Node.js

### Decision Rationale:
Since neo-neo-blessed does not provide the ESM support that was the primary motivation for this migration, we are cancelling this effort. The library offers no significant benefits over the current blessed implementation while potentially introducing stability issues.

### Alternative Approaches:
If ESM support remains a priority, consider:
1. Researching other TUI libraries with genuine ESM support (e.g., ink, terminal-kit)
2. Creating an ESM wrapper around blessed
3. Building a custom TUI implementation using ANSI escape codes
4. Continuing with current blessed + existing workarounds

### Subtasks Status:
- Task 76.1: ✅ Done (Assessment completed - found no ESM support)
- Task 76.2-76.6: Cancelled (not proceeding due to assessment findings)
