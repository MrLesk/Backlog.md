---
id: BACK-797
title: Reproduce Linux memory growth and closed-pipe hangs on the published binary
status: Done
assignee:
  - '@codex'
created_date: '2026-10-28T22:59:00Z'
updated_date: '2026-10-28T23:24:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1038'
  - 'https://github.com/MrLesk/Backlog.md/issues/1048'
  - >-
    https://github.com/MrLesk/Backlog.md/blob/97902e64909821bce72b943d97f8f42cf62e83aa/scripts/reproduce-linux-reliability.py
  - >-
    https://github.com/MrLesk/Backlog.md/blob/97902e64909821bce72b943d97f8f42cf62e83aa/.github/workflows/linux-reliability.yml
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/40784704212'
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/40784916641'
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
- [x] #1 Record the published version, asset checksum, Linux kernel and architecture, and whether execution is native or emulated.
- [x] #2 Run repeated task-detail request waves on one browser process with a separate load generator; record idle RSS and anonymous memory, request success counts, and controls needed to distinguish continued growth from warm-up.
- [x] #3 Run the closed-stderr reproduction and small-output/open-pipe controls with bounded process cleanup; record exit behavior, CPU use, and response to termination.
- [x] #4 State which reports reproduce, preserve runnable evidence, and choose a fix only from verified results; explain any environment limitations.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Run the reported scenarios against checksum-verified published Linux x64 binaries before choosing any fix. Use native Ubuntu GitHub runners after the local Docker engine fails to start. Measure the closed-stderr failure with small-output and open-pipe controls, CPU sampling, and bounded TERM/KILL cleanup. Measure six waves of 2,000 task-detail reads on one server PID with 60-second idle samples, a separate load-generator cgroup, and server-only RSS/anonymous memory and pressure events. Compare current 1.55.3 with reported 1.53.0 as a control. Record the results and limits, preserve immutable links to the exact harness and workflow, and remove one-off probe files from the final record-only proposal. Select no speculative product fix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Result and recommendation

- #1048: reproduced on the published 1.53.0 Linux x64 binary. With more than 6 KiB of stderr and a closed reader, two variants used about one CPU core, ignored TERM, and required KILL. The same variants exited naturally on 1.55.3. Recommend updating to 1.55.3; no new product fix is needed for this reproduction. The exact upstream fixing commit has not been established.
- #1038: not reproduced on either version with this synthetic corpus. Both reached a stable idle memory level after warm-up. Keep the issue open; obtain a sanitized reproducing corpus and Debian/LXC measurements on 1.55.3 before choosing a code change. These results do not establish that the original memory problem is fixed.

## Environment and binaries

Both runs used native x86_64 Ubuntu 24.04 with Linux 7.0.0-1017-azure. No emulation was used. Local Docker startup failed, so the tests ran on GitHub-hosted Linux runners; the local startup processes were stopped afterward.

- 1.55.3 release asset: backlog-bun-linux-x64; SHA-256 c20d5c51aa95b66d5c89428927bb0a16dc7beb9110683d66387e0514925f274a.
- 1.53.0 release asset: backlog-bun-linux-x64-baseline; SHA-256 4498537967de78a78c0df26f943145127584cb1404c484850b7c05adedafae00.
- Downloaded hashes matched the release metadata and were checked again in each runner. Each binary reported its expected version. The releases embed Bun 1.4.4 and 1.3.14 respectively.

## Memory protocol and results

One browser PID per version; six waves of 2,000 round-robin task-detail GETs at concurrency two, with a 60-second idle interval before baseline and after each wave. Synthetic corpus: 109 active and 188 completed tasks, 4,096 description bytes per file, 1,311,742 total Markdown bytes. Remote operations and active-branch checks were disabled. The server ran in its own systemd cgroup with a 3 GiB maximum and swap disabled. The Python load generator stayed outside that cgroup and discarded response bodies.

| Idle sample | 1.55.3 RSS MiB | 1.55.3 anonymous MiB | 1.53.0 RSS MiB | 1.53.0 anonymous MiB |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 57.84 | 17.71 | 78.82 | 32.62 |
| Wave 1 | 87.18 | 42.87 | 127.61 | 80.10 |
| Wave 2 | 87.09 | 42.65 | 125.75 | 78.24 |
| Wave 3 | 86.95 | 42.51 | 126.68 | 79.07 |
| Wave 4 | 87.09 | 42.59 | 120.19 | 72.69 |
| Wave 5 | 87.41 | 42.91 | 127.74 | 80.23 |
| Wave 6 | 87.06 | 42.56 | 120.86 | 73.25 |

All 24,000 requests returned HTTP 200, with no high/max/oom cgroup events. PID 2457 served every 1.55.3 wave; PID 2428 served every 1.53.0 wave. Waves took 76-79 and 77-82 seconds respectively. Anonymous memory follows the stable RSS floor. A lower-cap or cheap-endpoint control was unnecessary for classifying this flat floor. The synthetic corpus and Ubuntu kernel differ from the original Debian/LXC environment, which remains an important limit.

## Closed-pipe protocol and results

The fixture commits one task with YAML conflict markers on a separate active branch. The short-title open-pipe control produced 1,373 stderr bytes on 1.55.3 and 1,147 on 1.53.0. A 5,000-character title produced 6,415 and 6,139 bytes. All open-pipe commands exited successfully.

Closed stderr alone and closed merged stdout/stderr exited naturally on 1.55.3 in about 0.06-0.11 seconds. The 1.53.0 large-output variants stayed runnable at about one CPU-second per wall second, ignored TERM after five seconds, and were killed two seconds later. Small-output and closed-stdout controls exited promptly. The one-line-reader variant exited on both versions in this run; that timing-dependent variant is not claimed as reproduced.

## Reproduction evidence and verification

Current-release run: https://github.com/MrLesk/Backlog.md/actions/runs/40784704212

Reported-release control: https://github.com/MrLesk/Backlog.md/actions/runs/40784916641

The artifacts include raw JSONL samples, complete diagnostic text, and server logs. The exact runnable harness and workflow are retained in diagnostic commit 97902e64909821bce72b943d97f8f42cf62e83aa; the 1.53.0 download/checksum control is in a3c1ef92f2623df9c6282ced9c0119cf354b2cc9. Source links are in this task’s references. On native Linux with Python 3.11+, Git, systemd and sudo, run the script with --binary /absolute/path/backlog --mode pipe --output /absolute/path/results-pipe, then --mode memory --output /absolute/path/results-memory. Memory defaults reproduce the protocol above. Download the matching release asset and verify its checksum first.

Both Linux workflow runs completed successfully. An independent check of the result files verified six complete waves, one PID per version, 12,000 successful reads per version, and zero pressure/OOM events. Python syntax compilation and help output passed. The workflow parsed and its TLS bootstrap matched existing CI. The existing finite-pipe regression suite passed: two tests, 15 assertions. The final proposed diff keeps only this task record; temporary probe files remain available through their committed source links. No TypeScript or formatting-managed source remains changed, so the conditional type/Biome DoD items do not apply. Own specification and quality review is complete. No product change, release, issue closure, or public issue message was made.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tested published 1.55.3 and 1.53.0 on native Linux x64. The closed-stderr CPU hang reproduced on 1.53.0 and passed on 1.55.3. Memory plateaued after warm-up on both versions across 24,000 successful reads; #1038 remains unconfirmed and should stay open pending a matching corpus/environment. Preserved checksums, per-wave measurements, limits, and runnable evidence. No product fix selected.
<!-- SECTION:FINAL_SUMMARY:END -->
