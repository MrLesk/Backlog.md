---
id: task-196
title: Add NixOS packaging support
status: Done
assignee: []
created_date: '2025-07-17'
updated_date: '2025-07-17'
labels: []
dependencies: []
---

## Description

Enable NixOS users to install backlog.md through the NixOS package manager by creating Nix flake packaging

## Acceptance Criteria

- [x] Create flake.nix with proper derivation for building backlog.md
- [x] Package builds successfully in NixOS environment using nix build
- [x] CLI tool works correctly when run via nix run
- [x] Documentation includes NixOS installation instructions
- [x] Flake follows Nix community best practices

## Implementation Plan

1. Research NixOS flake structure and best practices for Bun projects
2. Create flake.nix with proper inputs and derivation
3. Configure build process for Bun compilation
4. Set up proper install phase and meta information
5. Generate flake.lock via nix flake lock
6. Test package builds and functionality
7. Update documentation with NixOS installation instructions

## Implementation Notes

Successfully implemented NixOS packaging support using Nix flakes. Created a complete flake.nix that:

**Approach taken:**
- Used `stdenv.mkDerivation` with Bun and Node.js 20 as build inputs
- Dynamically reads version from package.json using `builtins.fromJSON`
- Follows Nix community best practices with proper meta information
- Includes dev shell for development environment

**Features implemented:**
- Complete Nix flake with nixpkgs and flake-utils inputs
- Proper build process that runs CSS build and CLI compilation
- Version embedding using `--define` flag during build
- Development shell with all necessary dependencies
- Package available via `nix run` and `nix build`

**Technical decisions:**
- Used `--frozen-lockfile` for reproducible builds
- Embedded version at build time using `__EMBEDDED_VERSION__` define
- Updated package.json version to 1.5.0 for proper versioning
- Added NixOS installation command to README.md

**Modified files:**
- `flake.nix` - Created complete Nix flake definition
- `flake.lock` - Generated lockfile for reproducible builds
- `package.json` - Updated version to 1.5.0
- `README.md` - Added NixOS installation instructions
