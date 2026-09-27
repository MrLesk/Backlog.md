---
id: BACK-578
title: Stop the Rosetta sysctl probe from leaking stderr
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 18:20'
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
- [x] #1 The Rosetta probe suppresses the child inherited stderr (for example stdio ["ignore", "pipe", "ignore"])
- [x] #2 No stderr output appears from the probe when sysctl is not permitted
- [x] #3 Rosetta detection behavior is otherwise unchanged
- [x] #4 src/test/resolveBinary.test.ts covers the stderr suppression
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add stdio ["ignore", "pipe", "ignore"] to the sysctl execFileSync call in scripts/resolveBinary.cjs so the child never inherits the parent's stdin/stderr; keep encoding utf8 and the existing try/catch so detection behavior is unchanged.
2. Make the probe's child_process dependency injectable the same way resolveBinaryPath already injects its resolver (isRosettaTranslated(platform, exec = execFileSync)) so tests can pin the options without mutating the node:child_process builtin globally.
3. Scan the rest of scripts/*.cjs for sibling probes: cli.cjs spawns the real binary with stdio inherit (intentional passthrough) and postuninstall.cjs already uses stdio pipe, so no other call sites need changes.
4. Extend src/test/resolveBinary.test.ts with a stub exec that records the options: assert stdio is exactly ["ignore", "pipe", "ignore"], assert the argv/encoding are unchanged, assert '1' means true and other output means false, assert a throwing exec returns false, and assert non-darwin never shells out.
5. Verify with bunx tsc --noEmit, bun run check ., the scoped test file, and one full bun test run.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed scripts/resolveBinary.cjs: the sysctl probe now passes stdio ["ignore", "pipe", "ignore"] alongside encoding utf8, so the child inherits neither stdin nor stderr while stdout stays piped for the return value. The try/catch and the '1' comparison are untouched, so detection results are identical.

Made the probe's child_process call injectable (isRosettaTranslated(platform, exec = execFileSync)), mirroring the existing resolveBinaryPath(platform, arch, resolver = require.resolve) convention in the same file. This lets the tests pin the exact options object without mutating the node:child_process builtin globally, which would leak across the shared bun test process.

Scanned the other scripts/*.cjs call sites for the same pattern: cli.cjs:86 spawns the real backlog binary with stdio inherit (intentional passthrough of the user's command output) and postuninstall.cjs:24 already uses stdio pipe. No other silent probe inherits stderr, so no further changes were needed. grep for sysctl/proc_translated across src, scripts, and tools confirms resolveBinary.cjs is the only Rosetta probe.

Verification. Unit: bun test --timeout=10000 src/test/resolveBinary.test.ts -> 20 pass / 0 fail, including an assertion that options.stdio equals exactly ["ignore", "pipe", "ignore"] and that argv plus encoding are unchanged.

End-to-end stderr proof (Node, real child_process, denied-sysctl simulation that keeps the options object the fix builds and points execFileSync at a command printing 'sysctl: Operation not permitted' to stderr with exit 1): parent stderr captured to a file was 0 bytes, and the probe still returned false. The same simulation with the pre-fix options ({ encoding: 'utf8' } only) wrote 32 bytes, 'sysctl: Operation not permitted', to the parent stderr. Same return value in both cases, so only the leak changed. Real unsimulated probe on this native arm64 Mac still returns false, and the non-darwin early return still shells out zero times.

Full checks: bunx tsc --noEmit clean, bun run check . checked 357 files with no fixes applied, bun run test 1901 pass / 5 skip / 0 fail across 213 files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Rosetta probe in scripts/resolveBinary.cjs now passes stdio ["ignore", "pipe", "ignore"] to its sysctl execFileSync call, so a restricted macOS shell that denies sysctl can no longer print 'Operation not permitted' into the launcher's stderr before every otherwise-successful backlog command. stdout stays piped and the existing try/catch and '1' comparison are unchanged, so detection results are identical; only the leak is gone. The call was made injectable (isRosettaTranslated(platform, exec = execFileSync)), matching the resolveBinaryPath resolver convention already in the file, so tests can pin the options without globally mutating node:child_process.

Verified by a real-child_process simulation of a denied sysctl: parent stderr was 0 bytes with the fix versus 32 bytes ('sysctl: Operation not permitted') with the previous options, with the same false return in both cases. src/test/resolveBinary.test.ts gained five assertions covering the exact stdio array, the unchanged argv/encoding, the 1-means-true mapping, the throw-means-false fallback, and the non-darwin path never shelling out: 20 pass / 0 fail. bunx tsc --noEmit clean, bun run check . clean over 357 files, bun run test 1901 pass / 5 skip / 0 fail. The other scripts/*.cjs spawn sites were checked: cli.cjs inherits stdio intentionally to pass the real binary's output through, and postuninstall.cjs already pipes.
<!-- SECTION:FINAL_SUMMARY:END -->
