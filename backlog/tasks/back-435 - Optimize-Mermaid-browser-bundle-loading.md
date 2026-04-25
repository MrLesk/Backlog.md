---
id: BACK-435
title: Optimize Mermaid browser bundle loading
status: In Progress
assignee:
  - '@alex-agent'
created_date: '2026-04-25 17:10'
updated_date: '2026-04-25 17:10'
labels:
  - web
  - dependencies
dependencies: []
references:
  - >-
    /Users/alex/projects/Backlog.md-main-mess-backup-20260425-1708/remaining-mermaid-package-against-origin-main.patch
documentation:
  - backlog/completed/back-317 - Add-Mermaid-diagram-rendering-in-web-UI.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web UI currently lazy-loads Mermaid through the package entry point, which can make the browser bundle traverse Mermaid's parser dependency graph. Use Mermaid's prebuilt browser ESM bundle instead, and refresh only the package/build artifacts needed for that optimization. This work should stay separate from the already-merged MCP roots changes and should not include unrelated feature work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Mermaid rendering in the web UI loads the prebuilt browser ESM bundle instead of the generic package entry point.
- [ ] #2 TypeScript has an explicit declaration for the prebuilt Mermaid bundle import.
- [ ] #3 Package, lockfile, and generated Nix dependency artifacts are consistent with the Mermaid/package refresh.
- [ ] #4 Generated web CSS is updated only as required by the package refresh.
- [ ] #5 Existing Mermaid markdown/rendering tests continue to pass.
- [ ] #6 The PR does not reintroduce the already-merged MCP roots server/test changes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Commit the BACK-435 task file directly to main so the task id is reserved before code work.
2. Create a feature branch from current origin/main.
3. Apply the saved clean Mermaid/package patch from the backup folder.
4. Verify the diff contains only the task, Mermaid import/type shim, package/lock/Nix refresh, and generated CSS.
5. Run focused Mermaid tests, typecheck, Biome check, and relevant build validation.
6. Finalize the task, open a PR titled `BACK-435 - Optimize Mermaid browser bundle loading`, wait for checks/Codex review, and merge if green.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
