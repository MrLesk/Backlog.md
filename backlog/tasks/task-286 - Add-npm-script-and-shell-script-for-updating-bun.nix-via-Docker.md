---
id: task-286
title: Add npm script and shell script for updating bun.nix via Docker
status: Done
assignee:
  - '@myself'
created_date: '2025-10-09 15:09'
updated_date: '2025-10-09 15:09'
labels:
  - tooling
  - nix
  - ci
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, bun.nix is regenerated via postinstall hook which can fail due to GitHub API rate limits (403 errors). Create a dedicated npm script and shell script to allow manual regeneration of bun.nix using bun2nix via Docker, avoiding GitHub API rate limit issues.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shell script created at scripts/update-nix.sh that runs bun2nix via Docker
- [x] #2 Script checks for Docker availability and provides helpful error messages
- [x] #3 npm script 'update-nix' added to package.json that executes the shell script
- [x] #4 Script successfully regenerates bun.nix without hitting GitHub API rate limits
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create shell script at scripts/update-nix.sh
2. Add Docker availability check with error handling
3. Implement bun2nix execution via Docker with Nix flakes
4. Add npm script in package.json to run the shell script
5. Test script execution to verify it avoids GitHub API rate limits
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Created a dedicated update script to regenerate bun.nix using Docker instead of relying on postinstall hooks, avoiding GitHub API rate limit issues (403 errors).

## Changes
- **scripts/update-nix.sh**: New shell script that runs bun2nix via Docker container
  - Uses nixos/nix:latest Docker image to run bun2nix
  - Checks for Docker availability before execution
  - Provides clear error messages and success feedback
- **package.json**: Added `update-nix` script for easy invocation

## Technical Details
- Script uses Docker volume mounting to access project files
- Runs bun2nix with Nix experimental features enabled
- Avoids GitHub API calls by using local package data via Docker

## Testing
Verified that running `bun run update-nix` successfully regenerates bun.nix without hitting GitHub API rate limits, even when switching networks (e.g., to mobile hotspot).
<!-- SECTION:NOTES:END -->
