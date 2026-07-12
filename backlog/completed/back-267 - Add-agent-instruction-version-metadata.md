---
id: BACK-267
title: Add agent instruction version metadata
status: Done
assignee:
  - '@alex-agent'
created_date: '2025-09-17 19:19'
updated_date: '2026-07-04 17:50'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Embed a manually maintained version identifier in each agent instruction file that we ship, so users can tell which revision they have locally. Update the guideline embedding pipeline to preserve the version marker when the single-file binary is built.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version header or comment exists in every bundled agent instruction file
- [x] #2 Backlog init writes the version marker when generating agent instruction files
- [x] #3 backlog agents --update-instructions preserves/updates the version marker
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inject a machine-readable HTML comment marker (<!-- backlog.md-instructions-version: X.Y.Z -->) into every managed instruction block at write time in src/agent-instructions.ts (wrapWithMarkers), deriving the version from getVersion() (build-time embedded version in binaries, package.json in dev) instead of hardcoding versions in src/guidelines files.
2. Apply the marker to CLI nudge blocks (addAgentInstructions), MCP nudge blocks (ensureMcpGuidelines), and the installed .claude/agents/project-manager-backlog.md (installClaudeAgent).
3. Markers live inside the managed START/END blocks so the existing strip-and-reinsert update flow refreshes them automatically.
4. Tests: marker present after install, version matches package.json, update flow refreshes marker, idempotency preserved.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chose write-time injection over manually maintained per-file versions: versionMarkerLine() in src/agent-instructions.ts emits '<!-- backlog.md-instructions-version: X.Y.Z -->' derived from getVersion() (build-time __EMBEDDED_VERSION__ in compiled binaries, package.json in dev). Marker is written as the first line inside every managed CLI/MCP guideline block and appended to the installed .claude/agents/project-manager-backlog.md. Because it lives inside the START/END block, the existing strip-and-reinsert flow (init re-run, agents --update-instructions, CLI/MCP mode switch) refreshes it automatically; same-version re-runs stay 'unchanged'. This avoids any release-time maintenance and cannot drift from the binary that wrote it. BACK-268 can compare via regex /<!-- backlog\.md-instructions-version: (\S+) -->/ against getVersion().

Validation: bunx tsc --noEmit clean; bunx biome check src scripts package.json biome.json clean; full test-file coverage run in chunks (162 files): 1326 pass, 2 skip, 0 new failures. Only failures are 11 in cli-priority-filtering.test.ts, reproduced identically on clean origin/main (pre-existing environment flake, unrelated).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a machine-readable version marker ('<!-- backlog.md-instructions-version: X.Y.Z -->') to every agent instruction surface Backlog.md installs into user projects: first line inside the managed CLI and MCP guideline blocks (addAgentInstructions/ensureMcpGuidelines) and appended to the installed .claude/agents/project-manager-backlog.md (installClaudeAgent). Version is injected at install/update time from getVersion() (build-time embedded version in compiled binaries, package.json in dev) rather than hardcoded in src/guidelines sources, so it can never drift from the binary and needs no release-time maintenance. Because the marker lives inside the START/END block, backlog init re-runs and 'backlog agents --update-instructions' refresh it automatically via the existing strip-and-reinsert flow; same-version re-runs remain 'unchanged'. Verified with new unit tests (marker present after install, version matches package.json, stale marker refreshed on update, MCP block covered, Claude agent file covered) plus tsc/biome/test gates.
<!-- SECTION:FINAL_SUMMARY:END -->
