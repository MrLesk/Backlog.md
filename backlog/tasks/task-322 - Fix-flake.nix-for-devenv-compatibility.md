---
id: task-322
title: Fix flake.nix for devenv compatibility
status: Done
assignee: []
created_date: '2025-11-29 18:50'
updated_date: '2025-11-29 21:16'
labels:
  - nix
  - bug-fix
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the Nix flake so the `backlog` command works correctly when used as a devenv.sh input.

**Problem:**
PR #419 reported that when using the flake package in devenv.sh, running `backlog` executes the bare `bun` binary instead of the actual CLI tool. This happens because the package name (`pname`) doesn't match the binary name.

**Solution:**
- Change `pname` from `"backlog-md"` to `"backlog"` to match the output binary name
- Remove unnecessary `bun run build:css` step (CSS is pre-compiled and committed to git)

**Reference:**
- [PR #419](https://github.com/MrLesk/Backlog.md/pull/419)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The `pname` in flake.nix is set to `"backlog"` to match the binary name
- [x] #2 The unnecessary `bun run build:css` step is removed from buildPhase
- [x] #3 The x86_64-linux baseline Bun overlay for older CPUs (issue #412) is preserved
- [x] #4 `nix build` produces a working `backlog` binary
- [x] #5 The flake package works correctly when used as a devenv input
- [x] #6 `nix develop` shell continues to work with all expected tooling
- [x] #7 All existing tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Changes

### flake.nix

1. Change `pname` to match binary name:
```nix
pname = "backlog";  # was "backlog-md"
```

2. Remove CSS build step (already pre-compiled in git):
```nix
buildPhase = ''
  runHook preBuild

  # Build the CLI tool with embedded version
  # Note: CSS is pre-compiled and committed to git, no need to build here
  bun build --compile --minify --define "__EMBEDDED_VERSION__=${version}" --outfile=dist/backlog src/cli.ts

  runHook postBuild
'';
```

## Testing

1. `nix build` - verify binary works: `./result/bin/backlog --version`
2. `nix develop` - verify dev shell has bun, git, biome
3. `bun test` - ensure no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->

<!-- SECTION:NOTES:END -->
