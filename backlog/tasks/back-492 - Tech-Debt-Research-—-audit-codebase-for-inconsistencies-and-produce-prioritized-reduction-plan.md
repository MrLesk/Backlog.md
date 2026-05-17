---
id: BACK-492
title: >-
  Tech Debt Research — audit codebase for inconsistencies and produce
  prioritized reduction plan
status: In Progress
assignee:
  - '@claude'
created_date: '2026-05-13 10:14'
updated_date: '2026-05-17 21:12'
labels:
  - tech-debt
  - research
  - engineering-consistency
  - refactoring
milestone: m-13
dependencies: []
modified_files:
  - backlog/docs/doc-004 - Tech-Debt-Audit.md
priority: low
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

The codebase has grown organically across multiple contributors and sessions. Before investing in refactoring, conduct a structured research pass to identify: what static analysis tooling exists for this stack, what the highest-leverage improvements are, and what is already available in the community.

**Output**: A findings document at `docs/tech-debt-audit.md` and follow-up task stubs for the user to decide which to create.

**Research focus areas** (goal of the task — do not execute full research here, produce the findings in a single focused session):

1. **Static analysis tooling**: Evaluate tools suitable for TS/Bun codebases — Biome rule extensions, `knip` (dead exports), `dependency-cruiser` (architecture violations), `jscpd` (duplication), `ts-prune`; score by adoption, maintenance, integration effort with Bun
2. **Pattern consistency**: Identify divergence across similar stores/handlers — config loading, error patterns, YAML parsing, route registration patterns in `src/server/index.ts`
3. **DRY/KISS violations**: Identify duplicated logic across CLI/TUI/WebUI/MCP handlers that could share a core function (look especially at filter logic, status checks, label handling)
4. **GitHub ecosystem**: Find high-popularity, well-maintained GitHub Actions or scripts for TS code quality audits on this stack — evaluate by stars, recent activity, license
5. **Prioritization**: Rank findings by impact × effort; top 5 become follow-up task proposals

**No code changes in this task.** Implementation follows in separate tasks created after the user reviews the findings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/tech-debt-audit.md created with structured findings: tool evaluations table, top patterns to fix, prioritized follow-up task list
- [x] #2 At least 3 static analysis tool options evaluated in a pros/cons table (adoption, maintenance, Bun compatibility, integration effort)
- [x] #3 At least 3 concrete DRY/KISS violations or pattern inconsistencies identified with file paths / line references
- [x] #4 GitHub Actions / community tooling evaluated with at least 2 options scored by stars, activity, license
- [x] #5 Top 5 findings ranked by impact × effort with brief justification for each ranking
- [x] #6 Follow-up tasks proposed as stub descriptions (title + 2-3 line scope) — not created; user decides which to pursue
- [x] #7 If a tool is recommended for CI adoption, integration steps noted as a follow-up task stub
- [x] #8 No code changes in this task — research and documentation output only
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Pre-existing biome error on package.json (2-space vs tab indent) exists on upstream-master before changes. My changes introduce only docs/tech-debt-audit.md (a markdown file, not covered by biome includes). tsc --noEmit passes cleanly (no TypeScript touched). Biome error is unrelated to this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created backlog/docs/doc-004 - Tech-Debt-Audit.md with structured findings across 6 sections: 5 static analysis tools evaluated (knip and dependency-cruiser recommended), 2 pattern inconsistencies (duplicate route aliases, duplicated CSV param parsing), 3 DRY/KISS violations (dual applyTaskFilters, label normalization quadruplicated with a latent case-sensitivity bug, custom isDoneStatus bypassing status utilities), 4 GitHub Actions scored, top-5 impact×effort ranking, and 7 follow-up task stubs (A–G). No code changes. Commit: 3d8f551.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
