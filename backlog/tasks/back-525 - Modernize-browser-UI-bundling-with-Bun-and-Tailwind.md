---
id: BACK-525
title: Modernize browser UI bundling with Bun and Tailwind
status: Done
assignee:
  - '@codex'
created_date: '2026-07-08 20:30'
updated_date: '2026-07-08 21:39'
labels:
  - build
  - web
  - bun
  - tailwind
dependencies: []
references:
  - src/server/index.ts
  - src/web/index.html
  - src/web/styles/source.css
  - package.json
  - DEVELOPMENT.md
  - 'https://bun.com/docs/bundler/executables'
  - 'https://bun.com/docs/runtime/http/server'
  - 'https://bun.com/blog/bun-v1.3.5'
priority: medium
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the browser UI build path with a Bun-native full-stack build so the compiled Backlog binary embeds the React app, Tailwind CSS, JavaScript, and static assets directly from source. Remove obsolete generated CSS and favicon fallback workarounds, and refresh stale Bun runtime guidance now that the upstream socket CPU issue has been fixed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The production build compiles a single Backlog binary with the browser UI assets embedded from source CSS, without relying on committed generated CSS.
- [x] #2 The browser shell references the source Tailwind CSS entry and Bun serves hashed JavaScript, CSS, and favicon assets from the HTML bundle.
- [x] #3 Obsolete favicon serving fallback and stale Bun 1.2.23 runtime guidance are removed or updated.
- [x] #4 Regression coverage and build smoke checks verify browser asset serving, no-store HTML headers, and compiled binary behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the CSS prebuild with a Bun.build script using bun-plugin-tailwind.
2. Serve the React shell from source.css and remove the committed generated style.css artifact.
3. Remove the obsolete favicon fallback and let Bun serve hashed assets from the HTML bundle.
4. Align CI, release, Nix, and development docs with the shared build script and Bun 1.3.14.
5. Verify install, build, typecheck, lint, full tests, and compiled/dev browser serving.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation passed on 2026-07-08: bun install --frozen-lockfile --linker=isolated; bun run build; bunx tsc --noEmit; bun run check .; bun test (1434 pass, 2 skipped interactive TUI tests, 0 fail). Manual smoke tests served the compiled binary on port 17625 and development source mode on port 17626; the compiled HTML returned no-store and hashed CSS, JS, and favicon assets with 200 responses, while /favicon.png returned 404 after removing the fallback.

CI follow-up: fixed Windows baseline build failure when BACKLOG_BUILD_OUTFILE is a bare filename by skipping parent directory creation for dirname('.'). Verified with a local bun-windows-x64-baseline compile using backlog-test.exe plus build, typecheck, Biome, and packaging test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Modernized the browser UI build around Bun.build and bun-plugin-tailwind, so React, Tailwind CSS, JS, and favicon assets are embedded from source into the compiled binary. Removed the generated style.css path and favicon fallback, updated CI/release/Nix/docs to the shared build script and Bun 1.3.14, and added compiled browser asset/no-store coverage to the packaging test. Verified with frozen install, build, typecheck, Biome, full bun test, and manual compiled/dev browser smoke tests.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
