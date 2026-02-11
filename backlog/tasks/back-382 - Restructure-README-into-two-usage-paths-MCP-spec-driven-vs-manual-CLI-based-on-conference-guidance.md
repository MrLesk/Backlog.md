---
id: BACK-382
title: >-
  Restructure README into two usage paths (MCP spec-driven vs manual CLI) based
  on conference guidance
status: Done
assignee:
  - '@codex'
created_date: '2026-02-11 20:26'
updated_date: '2026-02-11 21:49'
labels: []
dependencies: []
references:
  - README.md
  - /Users/alex/projects/mrlesk.com/talks/voxxed/backlog-presentation/pages
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use the Voxxed backlog presentation slide content to simplify README guidance after the main project introduction/features section. Introduce two explicit use cases: (1) Spec-driven development with AI agents via MCP and (2) Manual CLI mode, with concise step-by-step flows aligned with presenter guidance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README keeps the core product introduction/features and then clearly separates guidance into two sections: MCP spec-driven flow and manual CLI flow.
- [x] #2 MCP section reflects the intended workflow: idea -> split into tasks -> add plan right before implementation -> review plan/code -> iterate by resetting plan/notes/final summary and refining task instructions when needed.
- [x] #3 Manual CLI section includes a simple command-first workflow and key commands (`task create`, `task edit`, `task list`, `task search`) with clear when-to-use framing.
- [x] #4 Wording is simplified to reduce cognitive load and improve first-read comprehension.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read all slide markdown files under `/Users/alex/projects/mrlesk.com/talks/voxxed/backlog-presentation/pages` to extract the intended user story and usage narrative.
2. Inspect current `README.md` structure and identify the insertion point after core intro/features.
3. Rewrite the workflow portion into two explicit tracks: (a) Spec-driven development via MCP agents and (b) Manual CLI mode.
4. Keep examples concise and action-oriented, emphasizing plan timing guidance and restart loop when output does not match expectations.
5. Run formatting/lint checks scoped to README as applicable and update BACK-382 completion state.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read all slide pages in `/Users/alex/projects/mrlesk.com/talks/voxxed/backlog-presentation/pages` and aligned README workflow language with the conference narrative (spec-driven loop, one task at a time, plan timing, review checkpoints, restart loop).

Replaced the previous 'Five-minute tour' section with a clearer 'Two ways to use Backlog.md' section: MCP spec-driven flow and manual CLI flow.

Validation run: `bun run check README.md`.

Workflow correction: moving delivery to a dedicated git branch per user request before final task completion.

Finalized on dedicated branch `back-382-readme-two-usage-paths` per workflow requirement.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restructured `README.md` onboarding after the core features into two explicit use-case paths: (1) Spec-driven development with AI agents via MCP, and (2) Manual CLI mode. The MCP section now follows the conference guidance flow: idea -> task decomposition -> plan right before implementation -> human review checkpoints -> code review and restart loop by resetting plan/notes/final summary and refining description/AC/instructions when needed. The CLI section now presents a concise command-first workflow (`task create`, `task edit`, `task list`, `search`, `board`) with clear framing.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
