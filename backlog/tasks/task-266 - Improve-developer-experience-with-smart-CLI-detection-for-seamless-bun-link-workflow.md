---
id: task-266
title: >-
  Improve developer experience with smart CLI detection for seamless bun link
  workflow
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-19 12:37'
updated_date: '2025-09-19 13:04'
labels:
  - developer-experience
  - mcp
  - architecture
dependencies: []
priority: high
---

## Description

The current developer experience is broken when using 'bun link' because the cli.cjs wrapper expects platform-specific binaries that don't exist in development. This causes the linked backlog command to run an old version (0.3.3) instead of the current development code. We need to make cli.cjs intelligent enough to detect when it's running from a development installation and automatically use the TypeScript source files directly with Bun, without requiring any configuration from developers.
## Problem Analysis

### Current Architecture Issues
1. **Production-First Design**: The `scripts/cli.cjs` wrapper was designed for npm distribution with platform-specific binaries (`backlog.md-linux-x64`, etc.)
2. **Development Friction**: When developers run `bun install`, it installs old platform packages from npm (v0.3.3), which the wrapper finds and uses instead of the local development code
3. **Conflicting Layers**: Three separate execution contexts (production binaries, development TypeScript, compiled dist) without clear detection logic
4. **MCP Integration Complexity**: The MCP setup requires separate scripts and manual configuration, not integrated into the main development flow

### Root Cause
The wrapper script (`cli.cjs`) uses `resolveBinary.cjs` which looks for platform-specific packages in node_modules. During development, these packages either don't exist (causing errors) or contain old versions (causing confusion).

## Reasoning

### Why This Needs Fixing
1. **Developer Productivity**: Current setup requires complex workarounds and manual configuration
2. **Onboarding Friction**: New contributors face immediate obstacles when trying to test their changes
3. **MCP Development**: The MCP integration in this branch needs seamless testing across projects
4. **Industry Standards**: Modern CLI tools (Vite, ESBuild, etc.) detect development mode automatically

### Design Principles
1. **Zero Configuration**: `bun link` should "just work" without environment variables or config files
2. **Transparent Operation**: Other projects shouldn't need to know they're using a development version
3. **Smart Fallbacks**: Gracefully handle different installation scenarios
4. **No Global Pollution**: Don't require global NODE_ENV or other environment changes that affect other projects

## Implementation Plan

### Phase 1: Smart Detection in cli.cjs

Replace the current `cli.cjs` with intelligent context detection:

```javascript
#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { existsSync, realpathSync } = require("node:fs");
const { resolve } = require("node:path");

function detectExecutionMode() {
  // Get the real path of this script (follows symlinks)
  const scriptRealPath = realpathSync(__filename);
  const projectRoot = resolve(scriptRealPath, '../..');

  // Check 1: Do we have TypeScript source files?
  const hasSrcCli = existsSync(resolve(projectRoot, 'src/cli.ts'));

  // Check 2: Do we have a built binary?
  const hasDistBinary = existsSync(resolve(projectRoot, 'dist/backlog'));

  // Check 3: Do we have platform binaries (production install)?
  const hasPlatformBinary = (() => {
    try {
      const { resolveBinaryPath } = require("./resolveBinary.cjs");
      resolveBinaryPath();
      return true;
    } catch {
      return false;
    }
  })();

  // Decision logic:
  // 1. If we have src files and no platform binary -> DEV MODE
  // 2. If we have src files and user built it (dist exists) -> Use dist
  // 3. If we have platform binary -> Use platform binary
  // 4. If only src files exist -> DEV MODE (fresh clone)

  if (hasSrcCli && !hasPlatformBinary) {
    if (hasDistBinary) {
      return { mode: 'built', command: resolve(projectRoot, 'dist/backlog'), args: [] };
    } else {
      return { mode: 'source', command: 'bun', args: [resolve(projectRoot, 'src/cli.ts')] };
    }
  }

  if (hasPlatformBinary) {
    const { resolveBinaryPath } = require("./resolveBinary.cjs");
    return { mode: 'production', command: resolveBinaryPath(), args: [] };
  }

  if (hasSrcCli) {
    return { mode: 'source', command: 'bun', args: [resolve(projectRoot, 'src/cli.ts')] };
  }

  throw new Error('No valid backlog installation found');
}

// Main execution logic continues...
```

### Phase 2: Clean Development Environment

Add postinstall script to remove conflicting packages:

```json
// package.json
{
  "scripts": {
    "postinstall": "node -e \"['darwin', 'linux', 'windows'].forEach(os => ['x64', 'arm64'].forEach(arch => {const p = 'node_modules/backlog.md-' + os + '-' + arch; try { require('fs').rmSync(p, {recursive: true}); console.log('Removed', p); } catch {} }))\""
  }
}
```

### Phase 3: Update Documentation

1. **DEVELOPMENT.md**: Simplify to just `bun install && bun link`
2. **CLAUDE.md**: Add section on development workflow
3. **docs/mcp/dev-setup.md**: Update with new simplified process

### Phase 4: Test & Validate

1. Test fresh clone workflow
2. Test `bun link` in multiple projects
3. Test MCP setup with new workflow
4. Test production npm install still works


## Implementation Notes

## Synthesized Implementation Plan

**Problem**: CLI wrapper always uses platform binaries, causing `bun link` to run outdated versions.

**Solution**: Smart context detection in cli.cjs with these phases:

### Phase 1: Smart Detection
- Create `/scripts/detection.cjs` with intelligent execution mode detection
- Modify `/scripts/cli.cjs` with security checks and fallback logic
- Support dev/built/production modes automatically
- Add debug logging and error handling

### Phase 2: Environment Safety
- Environment-aware postinstall (skip in CI/production)
- Feature flag support (`BACKLOG_SMART_CLI`)
- Cross-platform compatibility testing
- Performance optimization

### Phase 3: Documentation
- Update DEVELOPMENT.md with simplified workflow
- Enhance docs/mcp/dev-setup.md with CLI detection section
- Add troubleshooting guides and before/after scenarios

### Phase 4: Testing
- Fresh clone → bun link workflow validation
- Cross-platform compatibility matrix
- Container/CI environment testing
- MCP development workflow verification

**Key Safety Features**:
- Backward compatibility with current resolveBinary.cjs
- Feature flag for gradual rollout
- Comprehensive error handling
- Security validation of execution context


## Success Criteria

- [ ] `bun install && bun link` creates a working global command
- [ ] `backlog` command in any project uses development TypeScript
- [ ] No environment variables required
- [ ] MCP commands work immediately after linking
- [ ] Production npm installs remain unaffected
- [ ] Clear documentation for contributors

## Related Files

- `scripts/cli.cjs` - Main wrapper to modify
- `scripts/resolveBinary.cjs` - Binary resolution logic
- `package.json` - Add postinstall cleanup
- `DEVELOPMENT.md` - Update setup instructions
- `docs/mcp/dev-setup.md` - Simplify MCP development docs

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI automatically detects development environment and uses TypeScript source files with bun
- [x] #2 Fresh clone workflow (git clone → bun install → bun link) works seamlessly without configuration
- [x] #3 Production npm installs continue to work with platform-specific binaries
- [x] #4 Clear error messages guide users when runtime requirements are not met
- [x] #5 Feature flag (BACKLOG_SMART_CLI=false) allows disabling smart detection
- [x] #6 Documentation updated to reflect new seamless workflow
<!-- AC:END -->
