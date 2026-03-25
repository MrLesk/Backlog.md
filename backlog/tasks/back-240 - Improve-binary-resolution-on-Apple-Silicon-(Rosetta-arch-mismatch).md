---
id: BACK-240
title: Improve binary resolution on Apple Silicon (Rosetta/arch mismatch)
status: To Do
assignee:
  - '@codex'
created_date: '2025-08-17 17:00'
labels:
  - packaging
  - bug
  - macos
dependencies: []
priority: high
---

## Description

On M1/M2 Macs, users can have Node/Bun running under Rosetta (x64) while the OS/CPU is arm64. This can cause the wrapper to resolve the wrong platform package or for the package manager to install only one variant, leading to errors like "illegal hardware instruction" or "Binary package not installed..." (see #265).

Goals:
- Make the binary resolver more robust on macOS by detecting Rosetta and falling back to available variants.
- Provide clear, actionable error messages with guidance.
- Add install docs for Apple Silicon (brew paths, Rosetta, arch checks).

Scope (MVP):
- In scripts/resolveBinary.cjs: if require.resolve fails, try both `backlog.md-darwin-arm64` and `backlog.md-darwin-x64` and spawn the one that exists.
- Detect Rosetta (e.g., `sysctl -in sysctl.proc_translated` returns 1) and include a hint in the error/help output.
- Improve error message: show detected `process.platform/process.arch`, Rosetta status, and which package name was looked up; suggest reinstalling via the matching arch tool (e.g., /opt/homebrew vs /usr/local, or `arch -arm64 npm i -g backlog.md`).
- README note: Apple Silicon troubleshooting steps and how to verify/install matching architecture for Node/Bun/Homebrew.

Out of scope: universal binaries.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Resolver: on macOS, if default resolution fails, attempt both darwin-arm64 and darwin-x64 package names and run whichever exists
- [ ] #2 Detect Rosetta and include it in error/help output (Rosetta: yes/no)
- [ ] #3 Error/help output explains how to fix: verify brew path, reinstall with correct arch, commands to check process.arch/uname -m
- [ ] #4 Add README troubleshooting section for Apple Silicon installs (brew/npx/bun)
<!-- AC:END -->
