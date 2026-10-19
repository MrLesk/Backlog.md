---
id: BACK-771
title: Upgrade architecture CI to Groma 0.7
status: Done
assignee:
  - '@codex'
created_date: '2026-10-19 12:08'
updated_date: '2026-10-19 12:27'
labels: []
dependencies: []
references:
  - .github/workflows/architecture.yml
  - groma/scanners.json
  - groma/config.json
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/39224405955'
  - README.md
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
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Base the isolated checkout on main 89041dad after coordination with the BACK-766 agent. Keep the primary checkout unchanged.
2. Convert scanners.json with the published Groma 0.7 CLI and preserve all scanner options/exclusions. Register the existing Backlog work source with groma plugin add backlog so the task pins promised by README.md:196-210 remain enabled. No new OKF/C4 concept or authored architecture change.
3. Change both architecture Action calls to CLI 0.7.0 and preserve existing workflow gates and fork/manual policy.
4. Test from an empty home with no Backlog tool on PATH: restore the configured Backlog CLI and scanners, then scan/export. Verify the Backlog work source is ready and existing task context is readable, source bytes and authored Markdown meaning remain unchanged, and committed comparison stays isolated. This extra assertion detects the valid Codex finding that empty workSources disables the documented task integration; the prior source-only export proof could not detect it.
5. Run required repository CI, assess Codex feedback, then merge the scoped fix. The old trusted-main architecture workflow can fail before the fix reaches main; verify the new main publication afterwards without weakening any gate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Based on main89041dad confirmed by the BACK-766 agent. The published Groma0.7 CLI converted the old file with no Backlog CLI on PATH, matching prior CI tool availability; the committed workSources list is empty. Exact parsed comparison confirms both existing scanner sources, include/exclude arrays and global exclusions are unchanged. Both workflow pins are0.7.0; no gate, fork/manual policy or authored architecture file changed. Full-repository proof in a disposable checkout and empty HOME passes public plugin restore/update, scan and export: React0.2.2 and TypeScript0.2.3 run successfully. All1442 tracked non-architecture files are byte-identical after scanning. All43 existing Markdown records retain their authored title, description, status, hierarchy/group and overview. Isolated public0.7 comparison of d63c722d→89041dad succeeds (2 modified components, no relationship changes) and keeps current config unchanged. Receipts: /tmp/backlog-groma-07-proof-results.json and /tmp/backlog-groma-07-authored-results.json. TypeScript and Biome source checks are not applicable to this config/workflow-only diff; Groma-owned JSON is excluded by this repository’s Biome config. git diff --check passes. Repository CI remains required before merge; its existing main-based architecture failure cannot read this branch’s workflow/config until main is upgraded. Implementer specification, quality and simplicity reviews find no further change: configuration stays operational, the CLI owns conversion, and workflow owns the selected CLI version.

Scoped integration tests satisfy the task test requirement: the actual public Groma0.7/Action restore-update-scan-export and two-commit comparison assertions pass, plus the43-record authored-content and1442-file source-preservation assertions. This is a configuration/workflow-only change with no Backlog application source or unit-test change. Full repository CI on the final PR head remains a required merge gate; the known architecture failure is from the unchanged trusted main workflow until this fix merges. The Action fix is now released as v1.2.1, with v1 at ea7042367a573e3b07ae00437767df04bcf284f2. Its final PR, main and both release-tag checks pass all three operating systems; real public npm smoke passes.

Accepted Codex P2 finding on groma/config.json: README.md:196-210 promises Backlog task pins/context in the local Groma map. Empty workSources preserved prior CI tool availability but disabled this documented local integration. The correction is to register the bundled Backlog source through the existing CLI, then verify its fresh restoration and task context. No new product capability or source-code change is needed.

Corrected the Codex finding using groma plugin add backlog: config.json now selects the bundled Backlog work source at minimum1.54.0. A fresh CI-style proof with empty HOME, no Backlog/Bun on PATH and an isolated npm global prefix restores all3 plugins, including the actual public Backlog CLI1.54.0. Plugin list confirms Backlog found, and full scan/export succeeds. All1443 tracked non-architecture files and authored meaning in43 Markdown records stay unchanged. Receipts: /tmp/backlog-groma-07-worksource-results.json and /tmp/backlog-groma-07-worksource-authored-results.json. The prior two-commit comparison proof remains valid because its isolated export does not load project config. Existing product CI39251117390 atcec9706 passes all3OS, all build smokes and Nix; the corrected configuration must pass final CI before merge. A separate existing data problem blocks live task reads: the public Backlog1.54 CLI rejects task list --json because10 duplicate ID groups exist across completed/archive records. This was also observed on clean main before this task, and no task data was changed here. The finding and logs were handed to the coordinated Backlog agent for separate assessment; static architecture export deliberately excludes live work context and passes. The corrected config preserves the documented work-source selection without bypassing Backlog identity validation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Upgraded both architecture CLI pins to Groma0.7.0 and used its CLI to replace scanners.json with config.json. Scanner declarations/exclusions and authored architecture are preserved. Backlog remains selected at minimum1.54.0 so the documented task integration is enabled. Fresh restoration of Backlog and both scanners, full scan/export, source/authored-content preservation and isolated committed comparison are verified. Full repository CI gates merge, followed by main architecture publication. A separate pre-existing duplicate-task-ID problem blocks local task ingestion and was reported to the Backlog agent; no task records or workflow protections changed.
<!-- SECTION:FINAL_SUMMARY:END -->
