---
id: BACK-578
title: Stop the Rosetta sysctl probe from leaking stderr
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/803'
priority: medium
type: bug
ordinal: 219000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #803. The npm launcher probes for Rosetta with `execFileSync("/usr/sbin/sysctl", ["-in", "sysctl.proc_translated"], { encoding: "utf8" })` at scripts/resolveBinary.cjs:29 and passes no stdio option, so the child process inherits stderr. In restricted shells the child prints "Operation not permitted" to stderr before every otherwise-successful backlog command, which breaks output parsing for callers that read the combined streams. The thrown exception is already caught, so the only defect is the inherited stderr.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Rosetta probe suppresses the child inherited stderr (for example stdio ["ignore", "pipe", "ignore"])
- [ ] #2 No stderr output appears from the probe when sysctl is not permitted
- [ ] #3 Rosetta detection behavior is otherwise unchanged
- [ ] #4 src/test/resolveBinary.test.ts covers the stderr suppression
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
