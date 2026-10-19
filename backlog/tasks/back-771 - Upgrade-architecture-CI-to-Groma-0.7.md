---
id: BACK-771
title: Upgrade architecture CI to Groma 0.7
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-19 12:08'
updated_date: '2026-10-19 12:15'
labels: []
dependencies: []
references:
  - .github/workflows/architecture.yml
  - groma/scanners.json
  - groma/config.json
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/39224405955'
modified_files:
  - groma/config.json
  - groma/scanners.json
  - .github/workflows/architecture.yml
ordinal: 391000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The architecture workflow uses the moving Groma Action v1 with a 0.6.6 CLI pin and scanners.json. The released Action now expects config.json and the 0.7 plugin commands, so current-map publication fails before scanning. Upgrade this repository to the supported CLI/configuration while preserving its selected scanners, exclusions and authored architecture. The coordinated Action fix handles its own startup ordering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both architecture Action calls use Groma 0.7.0.
- [x] #2 Committed config.json replaces scanners.json through the existing Groma CLI conversion, preserving scanner selections, settings and exclusions.
- [x] #3 The current-map scan/export and committed comparison work with the upgraded configuration, with source files and authored architecture preserved.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Base the isolated checkout on main89041dad after the BACK-766 agent confirms the merge and no file overlap. Keep the primary Backlog checkout unchanged.
2. Use the published Groma0.7 CLI to convert scanners.json to config.json with the same tool availability as the prior CI runner: no Backlog CLI selected implicitly from this developer machine. Preserve the existing React/TypeScript sources, includes, excludes and global exclusions; do not add a new work source or rescan the tracked architecture. This is operational configuration, not an OKF/C4 model change.
3. Change both architecture Action calls from CLI0.6.6 to0.7.0. Keep the existing fork/manual comparison policy and workflow gates.
4. In a disposable checkout and empty home, run the actual public CLI/Action restore, update, scan and export, verifying source bytes and committed authored architecture remain unchanged. Exercise a committed comparison with the same CLI. No application source changes or new tests are required for these configuration-only edits.
5. Run relevant repository checks and direct diff verification, record objective results, then open a one-task PR. The current pull_request_target architecture workflow runs the old trusted base, so its existing config failure may persist on this PR until the fix reaches main; do not weaken that workflow or hide the failure. After merge, verify the new main architecture workflow succeeds and report the PR/results to the coordinated agent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Based on main89041dad confirmed by the BACK-766 agent. The published Groma0.7 CLI converted the old file with no Backlog CLI on PATH, matching prior CI tool availability; the committed workSources list is empty. Exact parsed comparison confirms both existing scanner sources, include/exclude arrays and global exclusions are unchanged. Both workflow pins are0.7.0; no gate, fork/manual policy or authored architecture file changed. Full-repository proof in a disposable checkout and empty HOME passes public plugin restore/update, scan and export: React0.2.2 and TypeScript0.2.3 run successfully. All1442 tracked non-architecture files are byte-identical after scanning. All43 existing Markdown records retain their authored title, description, status, hierarchy/group and overview. Isolated public0.7 comparison of d63c722d→89041dad succeeds (2 modified components, no relationship changes) and keeps current config unchanged. Receipts: /tmp/backlog-groma-07-proof-results.json and /tmp/backlog-groma-07-authored-results.json. TypeScript and Biome source checks are not applicable to this config/workflow-only diff; Groma-owned JSON is excluded by this repository’s Biome config. git diff --check passes. Repository CI remains required before merge; its existing main-based architecture failure cannot read this branch’s workflow/config until main is upgraded. Implementer specification, quality and simplicity reviews find no further change: configuration stays operational, the CLI owns conversion, and workflow owns the selected CLI version.
<!-- SECTION:NOTES:END -->
