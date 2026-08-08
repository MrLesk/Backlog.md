---
id: BACK-612
title: Deduplicate generateNextDecisionId and remove the core-to-CLI dynamic import
status: To Do
assignee: []
created_date: '2026-08-08 22:14'
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
- [ ] #1 One generateNextDecisionId remains, in src/utils/id-generators.ts, with both former callers repointed to it
- [ ] #2 The dynamic await import("../cli.js") in src/core/backlog.ts is gone
- [ ] #3 decision create via CLI and POST /api/decisions via the built web server both still allocate sequential decision IDs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
