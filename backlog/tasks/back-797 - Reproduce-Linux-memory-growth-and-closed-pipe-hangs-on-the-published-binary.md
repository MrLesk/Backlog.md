---
id: BACK-797
title: Reproduce Linux memory growth and closed-pipe hangs on the published binary
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-28T22:59:00Z'
updated_date: '2026-10-28T23:03:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1038'
  - 'https://github.com/MrLesk/Backlog.md/issues/1048'
  - scripts/reproduce-linux-reliability.py
  - .github/workflows/linux-reliability.yml
modified_files:
  - scripts/reproduce-linux-reliability.py
  - .github/workflows/linux-reliability.yml
priority: high
type: spike
ordinal: 403000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issues #1038 and #1048 report Linux-only reliability failures that a macOS review cannot confirm. The memory follow-up provides six controlled request waves and server-only memory readings; the pipe report provides a branch-conflict fixture and an output-size threshold. Alex requested reproduction with the current published Linux binary before choosing any fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Record the published version, asset checksum, Linux kernel and architecture, and whether execution is native or emulated.
- [ ] #2 Run repeated task-detail request waves on one browser process with a separate load generator; record idle RSS and anonymous memory, request success counts, and controls needed to distinguish continued growth from warm-up.
- [ ] #3 Run the closed-stderr reproduction and small-output/open-pipe controls with bounded process cleanup; record exit behavior, CPU use, and response to termination.
- [ ] #4 State which reports reproduce, preserve runnable evidence, and choose a fix only from verified results; explain any environment limitations.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reproduce before selecting a fix, as requested by Alex. Download the current published Linux x64 and ARM64 assets and verify their release digests. Use an isolated Docker Linux runtime and record kernel, architecture and emulation. For #1048, create the reported side-branch conflict fixture, compare open and closed stderr at small and large diagnostic sizes, sample CPU and bound every run with TERM then KILL cleanup. For #1038, use a synthetic 109-active/188-completed corpus, remote operations and active-branch checks disabled, one server process for six waves of 2,000 task-detail reads at concurrency two with 60-second idle samples. Keep the load generator outside the server container and discard responses. Record process RSS, anonymous memory and cgroup events. Add a cheap endpoint control and lower-cap run only if the observed result needs them. Store commands and results as reviewable investigation evidence. No product fix is selected or authorized by an external report alone.

Local Docker startup failed before a Linux engine became available, including two UI inspection timeouts. Use a native Ubuntu x64 GitHub Actions runner instead. Add only a bounded diagnostic script and branch-scoped workflow, preserving the existing workflow trust bootstrap. The published binary runs directly on the Linux runner; a separate systemd service gives the browser its own cgroup with 3 GiB maximum and swap disabled. The Python load generator stays in the runner job cgroup and discards response bodies. Product code is unchanged.
<!-- SECTION:PLAN:END -->
