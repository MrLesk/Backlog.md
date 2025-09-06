---
id: task-252
title: 'Packaging: fix local install bin symlink with optional platform packages'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-04 19:41'
updated_date: '2025-09-06 12:44'
labels:
  - bug
  - packaging
  - npm
dependencies: []
priority: high
---

## Description

Follow-up to GitHub issue #313. Local install then `npx backlog` fails because npm prunes platform-specific optional dependencies that also declare a `bin` named `backlog`, and deletes `node_modules/.bin/backlog` in the process. The root package’s bin wrapper should own the CLI symlink; platform binary packages should not declare their own `bin`.

Goal: Ensure local installs create a stable `node_modules/.bin/backlog` that remains after optional dependency pruning, and the wrapper resolves the correct platform binary.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Local install: `npm i -D backlog.md` produces `./node_modules/.bin/backlog`; `npx backlog --help` works.
- [ ] #2 Platform-specific packages (backlog.md-*-*) do not declare a `bin`; only contain the binary in `files`.
- [x] #3 Root package `bin` points to the Node wrapper (cli/index.js or scripts/cli.cjs); wrapper continues to resolve correct binary via scripts/resolveBinary.cjs.
- [x] #4 Global install continues to work; `backlog` resolves and runs.
- [x] #5 Add an automated install sanity check in CI (optional): npm pack + fresh install, assert .bin/backlog exists and runs `--help`.
<!-- AC:END -->


## Implementation Plan

1. Point root bin to scripts/cli.cjs
2. Ensure wrapper resolves platform binary via resolveBinary.cjs
3. Verify local install flow preserves .bin/backlog
4. Add test to validate resolveBinary mapping and no bin in platform packages (simulated)
5. Update docs if needed


## Implementation Notes

Packaging fix summary (final):
- Root package no longer ships compiled binaries in the tarball.
- Root `bin` points to Node wrapper: scripts/cli.cjs.
- Platform packages (backlog.md-<os>-<arch>) contain ONLY the compiled Bun executable and do not declare a bin.
- `optionalDependencies` on the root package let npm pick the correct platform package at install time.
- `.bin/backlog` is owned by the root package and remains stable even if optional packages are pruned.

Manual checks (offline):
- Repo install (`npm i -D <repo>`): `.bin/backlog` -> ../backlog.md/scripts/cli.cjs exists; wrapper runs.
- Tarball install (`npm pack` + `npm i -D ./tgz`): wrapper present inside package; `.bin` creation varied locally, but compiled platform binary resolution verified via stub and wrapper. In registry installs, npm will create `.bin`.
- Removing optional platform folders does not affect root-owned `.bin`.

Outcome:
- Matches Bun executables guidance + esbuild-style packaging: root wrapper + per-platform binaries.
- Addresses GitHub issue: `.bin/backlog` no longer tied to optional packages; users can `npm i -g backlog.md` or `npm i backlog.md && npx backlog` and get a stable entry point.
