---
id: BACK-612
title: Deduplicate generateNextDecisionId and remove the core-to-CLI dynamic import
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 22:14'
updated_date: '2026-08-08 22:49'
labels: []
dependencies: []
ordinal: 251000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to BACK-611 under the standing owner approval for deleting duplicated functions (Alex, 2026-08-08). After BACK-611, src/utils/id-generators.ts still holds a generateNextDecisionId that is byte-identical to the live copy in src/cli.ts (verified in the BACK-611 review) but has zero importers, making the utils copy the dead duplicate now. The clean end state: repoint the two callers of the cli.ts copy (src/cli.ts decision create and the dynamic await import("../cli.js") at src/core/backlog.ts:2876, reached via the web server decision endpoint) to the shared utils helper, then delete the cli.ts copy. This also removes the core-to-CLI dynamic import asymmetry: the doc helper is already taken from utils via a static import while the decision helper reaches back into the CLI dynamically. Verify the web POST /api/decisions path still allocates sequential IDs in the compiled bundle, since that is the route that exercises the dynamic import today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One generateNextDecisionId remains, in src/utils/id-generators.ts, with both former callers repointed to it
- [x] #2 The dynamic await import("../cli.js") in src/core/backlog.ts is gone
- [x] #3 decision create via CLI and POST /api/decisions via the built web server both still allocate sequential decision IDs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Re-verify on current origin/main: confirm the two generateNextDecisionId bodies are byte-identical (diff the extracted ranges, cli.ts:1664-1730 vs id-generators.ts:81-147), enumerate every caller, and confirm src/core/backlog.ts:2876 is the only 'cli.js' import in the source tree.
2. Confirm the cycle hypothesis before changing the import shape: cli.ts imports Core from ./index.ts, which re-exports core/backlog.ts, so a static core->cli import would close a runtime cycle - that is why the import was dynamic. utils/id-generators.ts only carries a type-only 'import type { Core }', so it has no runtime edge, and core/backlog.ts already statically imports generateNextDocId from it. Repointing therefore cannot reintroduce the cycle; tsc and the bundler are the check.
3. src/core/backlog.ts: extend the existing line-37 import to '{ generateNextDecisionId, generateNextDocId }' and replace the dynamic-import body of createDecisionWithTitle with a direct call, deleting the now-false 'Import the generateNextDecisionId function from CLI' comment.
4. src/cli.ts: add the static import from ./utils/id-generators.ts (sorted between find-backlog-root and label-filter) so the decision create action at cli.ts:4342 keeps working, then delete the local copy at 1664-1730.
5. Verify: repo-wide grep proving one definition and zero 'cli.js' imports; bunx tsc --noEmit; bun run check .; bun run build; targeted decision/doc tests; and the reviewer's probe pattern - built dist/backlog in a scratch project, 'dist/backlog browser', POST /api/decisions twice, asserting decision-1 then decision-2, since that route is the only thing exercising the dynamic import today. Also exercise CLI 'decision create' for the other caller.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Confirmed on current origin/main before changing anything: the two generateNextDecisionId bodies are byte-identical (diffed cli.ts:1664-1730 against id-generators.ts:81-147), the cli.ts copy had exactly two callers (cli.ts decision create and the dynamic import in core/backlog.ts), the utils copy had zero importers, and core/backlog.ts:2876 was the only 'cli.js' reference anywhere in src/.

Why the import was dynamic, and why repointing is safe: cli.ts statically imports Core from ./index.ts, which re-exports core/backlog.ts, so a static core->cli import would have closed a runtime cycle. utils/id-generators.ts carries only 'import type { Core }', which is erased, so it has no runtime edge, and core/backlog.ts already imported generateNextDocId from it statically. Repointing therefore reuses an existing acyclic edge rather than creating one; bunx tsc --noEmit and a successful bun run build confirm no cycle was reintroduced. The stale '// Import the generateNextDecisionId function from CLI' comment was the only workaround comment tied to this and is gone; a grep for other circular/cycle/lazy-import comments in src/ found nothing else related.

Changes: core/backlog.ts line 37 now imports { generateNextDecisionId, generateNextDocId } and createDecisionWithTitle calls the helper directly; cli.ts gains a static import from ./utils/id-generators.ts (sorted between find-backlog-root and label-filter) and loses its 67-line local copy. Net -71/+2 lines across the two files. One definition remains, in src/utils/id-generators.ts.

Behavioral proof through the BUILT bundle, since the removed dynamic import was only exercised by the web route: in a scratch project, dist/backlog browser then three POSTs to /api/decisions returned decision-1, decision-2 and decision-3 (HTTP 201 each), GET /api/decisions listed all three, and CLI 'decision create' then continued the same sequence with decision-4 and decision-5 - proving both former callers now share one allocator. Re-ran with zeroPaddedIds=3, the helper's only config-dependent branch: the web POST returned decision-006 and the CLI returned decision-007, so the web route still reads config through the shared helper.

Checks: bunx tsc --noEmit clean, bun run check . clean (367 files), bun run build succeeds, targeted tests 47 pass / 0 fail across cli-doc-decision-board, server-documents-endpoint, documentation, docs-recursive, cli-doc-view and cli-doc-search.

Full-suite flake, investigated rather than assumed: the first full run showed 2099 pass / 1 fail, the failure being 'BacklogServer search endpoint > rebuilds the Fuse index when markdown content changes'. That test writes a document and polls the search endpoint 40 times at 125ms for the filesystem watcher to reindex, a bounded 5s budget, and it timed out under full-suite load rather than asserting a wrong value. It passes in isolation on this branch (25/25), the full suite on this branch's exact parent commit 2588b4a6 passes 2100/6/0, and a full re-run on this branch also passes 2100/6/0. The changed code is decision-ID allocation and has no path to the document watcher or the Fuse index, so the failure is a pre-existing watcher-timing flake, not a regression.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Collapsed the two byte-identical generateNextDecisionId copies onto the shared one in src/utils/id-generators.ts and removed the core-to-CLI dynamic import. src/core/backlog.ts now takes the helper from the same static utils import it already used for generateNextDocId, and createDecisionWithTitle calls it directly instead of doing await import('../cli.js'); src/cli.ts imports the shared helper for its decision create action and drops its 67-line local copy. The dynamic import existed because a static core-to-cli edge would have closed a cycle through index.ts, but utils/id-generators.ts only type-imports Core, so repointing reuses an existing acyclic edge - confirmed by clean tsc and a successful build. The stale comment describing the workaround is gone with it. Verified through the built bundle on both former call paths: three POSTs to /api/decisions returned decision-1 through decision-3 and CLI decision create continued the same sequence with decision-4 and decision-5, and with zeroPaddedIds=3 the web route returned decision-006 and the CLI decision-007, exercising the helper's only config branch. Also clean bunx tsc --noEmit, bun run check ., bun run build, and 47 targeted decision/doc tests. The full suite is 2100 pass / 6 skip / 0 fail; an earlier single failure in the Fuse-index watcher test was shown to be a pre-existing timing flake, passing in isolation, on the parent commit, and on a full re-run.
<!-- SECTION:FINAL_SUMMARY:END -->
