---
id: BACK-435
title: Optimize Mermaid browser bundle loading
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 17:10'
updated_date: '2026-04-25 17:18'
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
- [x] #1 Mermaid rendering in the web UI loads the prebuilt browser ESM bundle instead of the generic package entry point.
- [x] #2 TypeScript has an explicit declaration for the prebuilt Mermaid bundle import.
- [x] #3 Package, lockfile, and generated Nix dependency artifacts are consistent with the Mermaid/package refresh.
- [x] #4 Generated web CSS is updated only as required by the package refresh.
- [x] #5 Existing Mermaid markdown/rendering tests continue to pass.
- [x] #6 The PR does not reintroduce the already-merged MCP roots server/test changes.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Applied the saved Mermaid/package patch onto a clean branch from current main, keeping the diff limited to the Mermaid dynamic import, a type declaration for Mermaid's prebuilt ESM bundle, package/lock/Nix dependency artifacts, Biome schema, and generated Tailwind CSS. Verified the patch does not include any MCP roots server or test changes. The dependency refresh is broader than Mermaid alone because the saved package bump updates related web/tooling packages; package.json, bun.lock, bun.nix, and generated CSS are internally consistent.

Validation passed: bun install --frozen-lockfile, bun test src/test/mermaid.test.ts src/test/mermaid-markdown.test.tsx, bunx tsc --noEmit, bun run check ., bun run build, full bun test, and bun run update-nix through the repo's Docker-based bun2nix path. Biome 2.4.12 reports existing optional-chain warnings in unrelated files but exits successfully. A full nix build was not run in this environment.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Switched the web Mermaid loader to import Mermaid's prebuilt browser ESM bundle (`mermaid/dist/mermaid.esm.mjs`) so the CLI browser build does not traverse Mermaid's parser dependency graph through the generic package entry point.
- Added a local TypeScript declaration for the prebuilt Mermaid bundle import.
- Refreshed Mermaid and related package/tooling artifacts, including package.json, bun.lock, bun.nix, Biome schema, and generated Tailwind CSS.

Validation:
- bun install --frozen-lockfile
- bun test src/test/mermaid.test.ts src/test/mermaid-markdown.test.tsx
- bunx tsc --noEmit
- bun run check .
- bun run build
- bun test
- bun run update-nix

Note: bun.nix was regenerated through the repo's Docker-based bun2nix script. A full nix build was not run locally.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
