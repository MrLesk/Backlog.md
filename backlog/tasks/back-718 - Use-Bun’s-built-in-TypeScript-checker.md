---
id: BACK-718
title: Use Bun’s built-in TypeScript checker
status: Done
assignee:
  - '@Codex'
created_date: '2026-10-11 10:20'
updated_date: '2026-10-11 10:21'
labels: []
dependencies:
  - BACK-715
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1075'
  - package.json
  - AGENTS.md
  - CLAUDE.md
  - .github/copilot-instructions.md
  - DEVELOPMENT.md
  - backlog/config.yml
modified_files:
  - package.json
  - AGENTS.md
  - .github/copilot-instructions.md
  - DEVELOPMENT.md
  - backlog/config.yml
type: chore
ordinal: 338000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use Bun 1.4.3's built-in TypeScript checker through check:types, retain strict project settings and TypeScript editor support, and align contributor commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 check:types invokes Bun's built-in checker explicitly without triggering the Biome check script.
- [x] #2 The upgraded repository passes with unchanged strict TypeScript settings and deliberate type errors fail the checker.
- [x] #3 Contributor commands and task verification guidance use the canonical check:types script; TypeScript remains available for editors.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check . passes when formatting/linting touched
- [x] #2 bun test (or scoped test) passes
- [x] #3 bun run check:types passes when TypeScript touched
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace check:types with bun --check, retaining TypeScript and the existing tsconfig.
2. Update contributor instructions and type-check verification guidance to the script; document why bun check is ambiguous here.
3. Verify clean repository checks and a deliberate TS2322 fixture; record a local checker timing comparison.
4. Simplify and open a separate draft PR based on the Bun upgrade.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
check:types now runs bun --check, which bypasses the existing package script named check (Biome). TypeScript 7.0.2 stays installed for editors. tsconfig.json is byte-for-byte unchanged. AGENTS.md (and its CLAUDE.md symlink), Copilot guidance, DEVELOPMENT.md, and the project task Definition of Done use the canonical script.
Validation: bun run check:types reports no errors across 507 files; Biome and git diff --check pass; frozen-lockfile install makes no changes; 21 existing Bun-options/instruction tests pass. An isolated strict TypeScript fixture with a string assigned to number fails with TS2322 and exit 1.
Local alternating checker timing comparison, one warmup and six measured runs: median tsc 613.90 ms, built-in Bun checker 157.67 ms. These are local measurements. Subtraction review kept one existing script, existing strict config, and no added checker dependency or wrapper.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Switched check:types to Bun 1.4.3's built-in checker, retained TypeScript for editors and the existing strict tsconfig, and aligned contributor/task verification guidance. Repository diagnostics, the deliberate TS2322 failure fixture, Biome, frozen install, and 21 existing tests pass. Local checker median improved from 614 ms to 158 ms.
<!-- SECTION:FINAL_SUMMARY:END -->
